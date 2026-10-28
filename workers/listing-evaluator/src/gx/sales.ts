import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { dbGetInventoryItem } from '../inventory/db-core.js';
import { dbMarkInventorySoldFromGx, dbSetInventorySoldAvailability, dbSetInventoryReverbListingId } from '../inventory/db-write.js';
import { endReverbListing, updateReverbListing } from '../inventory/reverb-listing.js';
import { splitAndMarkPartialReverbSale } from '../inventory/reverb-sync.js';
import { dbCreateOrderFromGxSale, dbFindGxOrder, estimateGxFeeCents, logOrderError, describeError } from '../orders/manual.js';
import { deleteGxListing, getGxOrder, type GxOrder } from './api.js';
import { dbClaimGxSale, dbDeleteGxLink, dbFindGxSoldRow, dbReleaseGxSale, dbGetGxLinkByListingId, dbGetGxLinkForItem, type GxListingLink } from './db.js';
import { createGxListingForItem, parseGxListingOptions } from './listing.js';

const GX_SOLD_CHANNEL = 'Sweetwater Gear Exchange';

// GX order statuses that mean the sale was reversed; everything else (Awaiting Shipping through
// Payout Complete, plus Label Created seen live) is a completed sale.
const GX_REVERSED_ORDER_STATUSES = new Set(['Canceled', 'Refund Completed']);

export type GxSaleResult = {
  result: 'processed' | 'ignored' | 'failed';
  message: string;
  inventoryItemId?: string;
  orderNumber?: string | null;
  warnings?: string[];
  // Worth GX retrying the webhook (GX unreachable, unexpected error) vs. needs a person.
  retryable?: boolean;
};

// Records a GX sale in CCG and creates the CCG order. A GX listing is always one unit:
//   - single-unit item: marked sold, its Reverb listing ended;
//   - multi-unit item: one unit is split off into its own sold row (like a partial Reverb sale),
//     the rest stays for sale, Reverb's stock is lowered to match, and with autoRelist a new GX
//     listing goes up for the next unit.
// Safe to call repeatedly for the same GX order (webhook retries, the Sold + Awaiting Shipping
// pair, the manual sync): a recorded order is a no-op, and a sold row already made for this GX
// order is reused rather than splitting off another unit.
export async function processGxSale(
  env: Env,
  input: { gxOrderId: number; order?: GxOrder },
): Promise<GxSaleResult> {
  const existingOrder = await dbFindGxOrder(input.gxOrderId, env);
  if (existingOrder) {
    return { result: 'ignored', message: `Already recorded as order ${existingOrder.order_number}.`, orderNumber: existingOrder.order_number };
  }
  // Another webhook for this order is mid-way through recording it: back off and let GX retry
  // this one, by which time the order exists and the retry is a no-op.
  if (!(await dbClaimGxSale(input.gxOrderId, env))) {
    return { result: 'failed', retryable: true, message: `GX order ${input.gxOrderId} is already being recorded by another webhook.` };
  }
  const outcome = await recordGxSale(env, input);
  // A failed attempt gives the claim back so a retry (or the sync) can try again.
  if (outcome.result === 'failed') await dbReleaseGxSale(input.gxOrderId, env);
  return outcome;
}

async function recordGxSale(
  env: Env,
  input: { gxOrderId: number; order?: GxOrder },
): Promise<GxSaleResult> {
  try {

    let order = input.order;
    if (!order) {
      const fetched = await getGxOrder(env, input.gxOrderId);
      // A 404 won't change on retry (e.g. the dashboard's Test button sends a made-up order #100).
      if (!fetched.ok && fetched.status === 404) {
        return { result: 'ignored', message: `GX order ${input.gxOrderId} doesn't exist on GX (test event?).` };
      }
      if (!fetched.ok) return { result: 'failed', retryable: true, message: `Could not load GX order ${input.gxOrderId}: ${fetched.message}` };
      order = fetched.order;
    }
    if (GX_REVERSED_ORDER_STATUSES.has(order.status)) {
      return { result: 'ignored', message: `GX order ${order.orderId} is ${order.status}; nothing to record.` };
    }

    // The link is the normal way back to the item; productId (our inventory id) covers a link
    // that was already removed, e.g. a retry after the first attempt got partway.
    const link = await dbGetGxLinkByListingId(Number(order.listingId), env);
    const inventoryItemId = link
      ? String(link.inventory_item_id)
      : /^\d+$/.test(normalizeText(order.productId, '')) ? normalizeText(order.productId, '') : '';
    if (!inventoryItemId) {
      return { result: 'ignored', message: `GX listing ${order.listingId} isn't linked to a CCG item.` };
    }
    const item = await dbGetInventoryItem(inventoryItemId, env);
    if (!item) return { result: 'failed', message: `CCG item ${inventoryItemId} not found for GX listing ${order.listingId}.` };
    const ccgLabel = normalizeText(item.ccgNumber, '') || `item ${inventoryItemId}`;

    const warnings: string[] = [];
    const payoutMethod = link?.payout_method ?? null;
    const quantity = Math.max(1, Number(item.quantity ?? 1));
    let soldItemId = await dbFindGxSoldRow(order.orderId, env);
    let unitsLeft = 0;

    if (!soldItemId) {
      const soldChannel = normalizeText(item.soldChannel, '');
      if (item.isSold && soldChannel !== GX_SOLD_CHANNEL) {
        // Sold somewhere else first: a double sale. Don't touch the item; this needs a person.
        return {
          result: 'failed',
          inventoryItemId,
          message: `${ccgLabel} sold on Gear Exchange (order ${order.orderId}) but was already sold via ${soldChannel || 'another channel'}. Cancel the GX order or resolve by hand.`,
        };
      }
      if (item.isSold) {
        soldItemId = inventoryItemId;
      } else {
        const grossCents = Math.round((Number.parseFloat(order.soldPrice) || 0) * 100)
          + Math.round((Number.parseFloat(order.shippingAmount) || 0) * 100);
        const feeCents = estimateGxFeeCents(grossCents, payoutMethod);
        const soldAmount = Number(((grossCents - feeCents) / 100).toFixed(2));
        // dbFindGxSoldRow finds the sold row by this opening sentence — keep it stable.
        const sellNotes = [
          `Sold via Gear Exchange (order #${order.orderId}).`,
          `$${order.soldPrice} item`,
          Number.parseFloat(order.shippingAmount) > 0 ? `+ $${order.shippingAmount} shipping` : null,
          feeCents > 0 ? `- ~$${(feeCents / 100).toFixed(2)} payout fee (est.)` : null,
          `= ~$${soldAmount.toFixed(2)} payout.`,
        ].filter(Boolean).join(' ');
        const soldDate = normalizeText(order.soldAt, '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        const reverbListingId = normalizeText(item.reverbListingId, '');

        if (quantity > 1) {
          const split = await splitAndMarkPartialReverbSale(inventoryItemId, 1, {
            soldDate,
            soldAmount,
            sellNotes,
            soldChannel: GX_SOLD_CHANNEL,
          }, env);
          if (!split.ok) return { result: 'failed', inventoryItemId, message: `Could not split the sold unit off ${ccgLabel}: ${split.message}` };
          soldItemId = split.newInventoryId;
          unitsLeft = quantity - 1;
          if (reverbListingId) {
            const stock = await updateReverbListing(reverbListingId, { has_inventory: true, inventory: unitsLeft }, env);
            if (!stock.ok) warnings.push(`Reverb still shows the old quantity — set it to ${unitsLeft} by hand: ${stock.message}`);
          }
        } else {
          const marked = await dbMarkInventorySoldFromGx(inventoryItemId, { soldDate, soldAmount, sellNotes }, env);
          if (!marked) return { result: 'failed', inventoryItemId, message: `Could not mark ${ccgLabel} sold.` };
          await dbSetInventorySoldAvailability(inventoryItemId, true, env);
          soldItemId = inventoryItemId;
          if (reverbListingId) {
            const ended = await endReverbListing(reverbListingId, env);
            if (ended.ok) await dbSetInventoryReverbListingId(inventoryItemId, null, env);
            else warnings.push(`The Reverb listing is still live — end it by hand: ${ended.message}`);
          }
          if (normalizeText(item.fbListingId, '')) warnings.push('The FBM listing is still live — mark it sold on Facebook.');
        }
      }
    }
    // A retry that found the unit already split off: the item's current quantity is what's left.
    if (soldItemId !== inventoryItemId && unitsLeft === 0 && !item.isSold) unitsLeft = quantity;
    // The GX listing is sold either way; only the first pass through has the link (so only it relists).
    if (link) await dbDeleteGxLink(link.inventory_item_id, env);

    const created = await dbCreateOrderFromGxSale(Number(soldItemId), order, payoutMethod, env);
    if (!created.ok) {
      warnings.push(`Item marked sold, but the order wasn't created: ${created.message}`);
      return { result: 'failed', inventoryItemId, message: warnings.join(' '), warnings };
    }

    let relistedAs: number | null = null;
    if (link && unitsLeft > 0) {
      const relist = await relistGxItem(inventoryItemId, link, env);
      if (relist.ok) relistedAs = relist.gxListingId;
      else if (relist.message) warnings.push(`Not relisted on Gear Exchange: ${relist.message}`);
    }

    const soldLabel = soldItemId === inventoryItemId ? ccgLabel : `1 unit of ${ccgLabel} (${unitsLeft || 'some'} left)`;
    return {
      result: 'processed',
      inventoryItemId: soldItemId,
      orderNumber: created.orderNumber,
      message: `${soldLabel} marked sold from GX order ${order.orderId}; CCG order ${created.orderNumber}.`
        + `${relistedAs ? ` Relisted on GX as listing ${relistedAs}.` : ''}${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
      warnings,
    };
  } catch (error) {
    logOrderError('gx.sale_failed', { gxOrderId: input.gxOrderId, ...describeError(error) });
    return { result: 'failed', retryable: true, message: error instanceof Error ? error.message : String(error) };
  }
}

// Takes an item off GX (it sold elsewhere, or it's being removed). Deleting rather than
// deactivating, so no orphan draft is left on GX that CCG has lost track of. A listing GX no
// longer has (404) counts as done.
export async function endGxListingForItem(
  inventoryItemId: string | number,
  env: Env,
): Promise<{ status: 'ended' | 'skipped' | 'failed'; message: string }> {
  const id = Number(inventoryItemId);
  const link = await dbGetGxLinkForItem(id, env);
  if (!link) return { status: 'skipped', message: 'Not listed on Gear Exchange.' };
  if (link.gx_status === 'sold') return { status: 'skipped', message: 'Already sold on Gear Exchange.' };

  const deleted = await deleteGxListing(env, link.gx_listing_id);
  if (!deleted.ok && deleted.status !== 404) {
    return { status: 'failed', message: deleted.message };
  }
  if (!(await dbDeleteGxLink(id, env))) {
    return { status: 'failed', message: 'Deleted the Gear Exchange listing, but failed to clear the local link.' };
  }
  return { status: 'ended', message: `Removed Gear Exchange listing ${link.gx_listing_id}.` };
}

// After a GX sale of a multi-unit item: put the next unit up on GX with the same answers as the
// listing that sold. It was live when it sold, so the new one is published straight away.
async function relistGxItem(
  inventoryItemId: string,
  soldLink: GxListingLink,
  env: Env,
): Promise<{ ok: true; gxListingId: number } | { ok: false; message: string }> {
  let stored: Record<string, unknown> = {};
  try {
    stored = soldLink.options_json ? JSON.parse(soldLink.options_json) as Record<string, unknown> : {};
  } catch {
    stored = {};
  }
  if (stored.autoRelist !== true) return { ok: false, message: '' };

  const item = await dbGetInventoryItem(inventoryItemId, env);
  if (!item || item.isSold || Number(item.quantity ?? 0) < 1) return { ok: false, message: 'no units left to list.' };
  const record = item as Record<string, unknown>;
  const parsed = parseGxListingOptions({
    ...stored,
    conditionId: stored.conditionId ?? soldLink.gx_condition_id,
    categoryId: stored.categoryId ?? soldLink.gx_category_id,
    saveCategoryDefault: false,
    publish: true,
  }, {
    allowShipping: Boolean(record.allowShipping),
    fixedShippingAmount: Number(record.fixedShippingAmount || 0),
    quantity: Number(record.quantity ?? 1),
  });
  if (!parsed.value) return { ok: false, message: parsed.error };
  const created = await createGxListingForItem(record, parsed.value, env);
  if (!created.ok) return { ok: false, message: created.message };
  return { ok: true, gxListingId: Number(created.listing.id) };
}
