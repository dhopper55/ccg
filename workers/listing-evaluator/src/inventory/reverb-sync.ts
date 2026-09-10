import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { dbListReverbLinkedUnsoldItems } from './db-core.js';
import { dbMarkInventorySoldFromReverb, dbSetInventorySoldAvailability } from './db-write.js';
import { fetchReverbSellingOrders, endReverbListing } from './reverb-listing.js';

// Order statuses (of the 11 Reverb documents) that count as a completed sale — triggers as soon
// as payment clears, not waiting for shipment. Excludes unpaid/payment_pending/pending_review/
// blocked (not yet real money) and refunded/cancelled (reversed).
const SOLD_ORDER_STATUSES = new Set(['paid', 'shipped', 'picked_up', 'received']);

function extractOrderProductId(order: Record<string, unknown>): string | null {
  const productId = order.product_id
    ?? order.productId
    ?? (order.listing as Record<string, unknown> | undefined)?.id
    ?? (order.product as Record<string, unknown> | undefined)?.id;
  return productId == null ? null : String(productId);
}

function extractPayoutAmount(order: Record<string, unknown>): number | null {
  const payout = order.direct_checkout_payout as { amount?: unknown } | undefined;
  if (!payout || payout.amount == null) return null;
  const parsed = Number.parseFloat(String(payout.amount));
  return Number.isFinite(parsed) ? parsed : null;
}

// Dry-run only: fetches Reverb's sold/order data and reports which of our locally-unsold,
// Reverb-linked items appear to have sold — without writing anything to D1. The exact field
// name Reverb uses to link an order back to a listing (product_id, per the docs' prose
// description) isn't confirmed against a real response yet, so this tries a couple of plausible
// keys AND always returns a raw sample order so a wrong guess is immediately visible and fixable
// rather than silently matching nothing.
export async function handleReverbSyncSoldDryRun(_request: Request, env: Env): Promise<Response> {
  const candidates = await dbListReverbLinkedUnsoldItems(env);
  if (!candidates.length) {
    return jsonResponse({
      ok: true,
      dryRun: true,
      candidateCount: 0,
      matches: [],
      message: 'No locally-unsold items are currently linked to a Reverb listing.',
    });
  }

  const candidatesByListingId = new Map(candidates.map((candidate) => [candidate.reverbListingId, candidate]));

  const ordersResult = await fetchReverbSellingOrders(env);
  if (!ordersResult.ok) {
    const status = ordersResult.status >= 400 && ordersResult.status < 600 ? ordersResult.status : 502;
    return jsonResponse({ message: `Unable to fetch Reverb orders: ${ordersResult.message}` }, status);
  }

  const matches: Array<Record<string, unknown>> = [];
  for (const order of ordersResult.orders) {
    const productId = extractOrderProductId(order);
    if (productId == null) continue;

    const candidate = candidatesByListingId.get(productId);
    if (!candidate) continue;

    matches.push({
      inventoryId: candidate.id,
      ccgNumber: candidate.ccgNumber,
      title: candidate.title,
      reverbListingId: candidate.reverbListingId,
      orderStatus: order.status ?? null,
      rawOrder: order,
    });
  }

  return jsonResponse({
    ok: true,
    dryRun: true,
    candidateCount: candidates.length,
    candidates: candidates.map((c) => ({ inventoryId: c.id, ccgNumber: c.ccgNumber, title: c.title, reverbListingId: c.reverbListingId })),
    ordersFetched: ordersResult.orders.length,
    matchCount: matches.length,
    matches,
    // Always included so a wrong product_id-field guess is visible immediately, even with zero
    // matches, instead of just silently reporting "0 matches" with no way to tell why.
    sampleOrderKeys: ordersResult.orders[0] ? Object.keys(ordersResult.orders[0]) : [],
    sampleOrder: ordersResult.orders[0] ?? null,
  });
}

// Real commit: for every locally for-sale, Reverb-linked, not-yet-sold item that Reverb shows as
// sold (order status in SOLD_ORDER_STATUSES), this ends the Reverb listing (best-effort — an
// already-ended listing is not treated as an error, since it likely auto-ended when it sold),
// then marks the item sold locally: for_sale off, is_sold on, sold_channel 'Reverb', sold_amount
// set to Reverb's direct_checkout_payout (the actual net payout, not the gross sale price — see
// sell_notes for the breakdown), and locks the public-shop availability so it can't double-sell.
// Items with no qualifying order, or that don't match anything, are left untouched.
export async function handleReverbSyncSoldCommit(_request: Request, env: Env): Promise<Response> {
  const candidates = await dbListReverbLinkedUnsoldItems(env);
  if (!candidates.length) {
    return jsonResponse({ ok: true, processed: [], skipped: [], message: 'No locally for-sale items are linked to a Reverb listing.' });
  }

  const candidatesByListingId = new Map(candidates.map((candidate) => [candidate.reverbListingId, candidate]));

  const ordersResult = await fetchReverbSellingOrders(env);
  if (!ordersResult.ok) {
    const status = ordersResult.status >= 400 && ordersResult.status < 600 ? ordersResult.status : 502;
    return jsonResponse({ message: `Unable to fetch Reverb orders: ${ordersResult.message}` }, status);
  }

  const processed: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  const handledInventoryIds = new Set<string>();

  for (const order of ordersResult.orders) {
    const productId = extractOrderProductId(order);
    if (productId == null) continue;
    const candidate = candidatesByListingId.get(productId);
    if (!candidate || handledInventoryIds.has(candidate.id)) continue;

    const status = typeof order.status === 'string' ? order.status : '';
    if (!SOLD_ORDER_STATUSES.has(status)) continue;

    handledInventoryIds.add(candidate.id);

    const payoutAmount = extractPayoutAmount(order);
    if (payoutAmount == null) {
      skipped.push({
        inventoryId: candidate.id,
        ccgNumber: candidate.ccgNumber,
        title: candidate.title,
        reason: 'Matched a sold order but could not read direct_checkout_payout from it.',
      });
      continue;
    }

    const orderNumber = typeof order.order_number === 'string' ? order.order_number : null;
    const buyerName = typeof order.buyer_name === 'string' ? order.buyer_name : null;
    const amountProduct = (order.amount_product as { amount?: unknown } | undefined)?.amount;
    const shippingAmount = (order.shipping as { amount?: unknown } | undefined)?.amount;
    const sellingFee = (order.selling_fee as { amount?: unknown } | undefined)?.amount;
    const checkoutFee = (order.direct_checkout_fee as { amount?: unknown } | undefined)?.amount;
    const soldDate = typeof order.paid_at === 'string' ? order.paid_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const sellNotes = [
      `Sold via Reverb${orderNumber ? ` (order #${orderNumber})` : ''}${buyerName ? ` to ${buyerName}` : ''}.`,
      amountProduct != null ? `$${amountProduct} item` : null,
      shippingAmount != null ? `+ $${shippingAmount} shipping` : null,
      sellingFee != null ? `- $${sellingFee} selling fee` : null,
      checkoutFee != null ? `- $${checkoutFee} checkout fee` : null,
      `= $${payoutAmount.toFixed(2)} payout.`,
    ].filter(Boolean).join(' ');

    let endListingWarning: string | null = null;
    const ended = await endReverbListing(candidate.reverbListingId, env);
    if (!ended.ok) {
      // Very likely already ended/sold on Reverb's side — non-fatal, still mark sold locally.
      endListingWarning = ended.message;
    }

    const marked = await dbMarkInventorySoldFromReverb(candidate.id, {
      soldDate,
      soldAmount: payoutAmount,
      sellNotes,
    }, env);
    if (!marked) {
      skipped.push({
        inventoryId: candidate.id,
        ccgNumber: candidate.ccgNumber,
        title: candidate.title,
        reason: 'Matched a sold order but the local update failed.',
      });
      continue;
    }
    await dbSetInventorySoldAvailability(candidate.id, true, env);

    processed.push({
      inventoryId: candidate.id,
      ccgNumber: candidate.ccgNumber,
      title: candidate.title,
      reverbListingId: candidate.reverbListingId,
      soldAmount: payoutAmount,
      soldDate,
      orderNumber,
      endListingWarning,
    });
  }

  return jsonResponse({
    ok: true,
    candidateCount: candidates.length,
    ordersFetched: ordersResult.orders.length,
    processedCount: processed.length,
    processed,
    skippedCount: skipped.length,
    skipped,
  });
}
