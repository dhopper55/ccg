import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { dbListReverbLinkedUnsoldItems, dbGetInventoryItem } from './db-core.js';
import {
  dbMarkInventorySoldFromReverb,
  dbSetInventorySoldAvailability,
  dbCreateInventoryItems,
  dbUpdateInventoryById,
  dbReplaceInventoryImagesByItemIds,
  dbReplaceInventoryTagsByItemIds,
  generateUniqueCcgNumber,
} from './db-write.js';
import { fetchReverbSellingOrders, endReverbListing, extractShippingLabelFee } from './reverb-listing.js';

function extractOrderQuantity(order: Record<string, unknown>): number {
  const raw = order.quantity;
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? '1'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

// Splits off `soldQuantity` units of the source item into a new sold row (copying its full
// details, images, and tags — mirrors exactly what the manual "Qty Sold" partial-sale path on
// the item edit form already does), and decrements the original row's quantity, leaving it
// for_sale and still linked to Reverb (a multi-unit listing likely stays live with the reduced
// count rather than ending — only a full sale ends the listing, handled by the caller).
async function splitAndMarkPartialReverbSale(
  sourceId: string,
  soldQuantity: number,
  fields: { soldDate: string; soldAmount: number; sellNotes: string; soldShipCostAccounted?: boolean },
  env: Env,
): Promise<{ ok: true; newInventoryId: string } | { ok: false; message: string }> {
  const source = await dbGetInventoryItem(sourceId, env);
  if (!source) return { ok: false, message: 'Could not load the source item to split.' };
  const s = source as Record<string, unknown>;

  const quantity = Number(s.quantity ?? 0);
  const remainingQuantity = quantity - soldQuantity;
  if (remainingQuantity < 1) return { ok: false, message: 'Sold quantity leaves nothing remaining — expected a full sale, not a split.' };

  const imageUrls = Array.isArray(s.imageUrls) ? (s.imageUrls as string[]) : [];
  const primaryImageUrl = imageUrls[0] || (s.imageUrl as string) || '';
  const imageRecords = Array.isArray(s.images)
    ? (s.images as Array<{ url: string; isPrivate?: boolean }>).map((image) => ({ url: image.url, isPrivate: Boolean(image.isPrivate) }))
    : imageUrls.map((url) => ({ url, isPrivate: false }));
  const tags = Array.isArray(s.tags) ? (s.tags as string[]) : [];
  const recordIdNum = Number.parseInt(sourceId, 10);

  const commonFields = {
    brand: (s.brand as string) || null,
    year_range: (s.yearRange as string) || null,
    model: (s.model as string) || null,
    finish: (s.finish as string) || null,
    repair_notes: (s.repairNotes as string) || null,
    original_listing_desc: (s.originalListingDesc as string) || null,
    video_url: (s.videoUrl as string) || null,
    sale_title: (s.saleTitle as string) || null,
    regular_price: s.regularPrice != null ? Number(s.regularPrice) : null,
    sale_price: s.salePrice != null ? Number(s.salePrice) : 0,
    condition: (s.condition as string) || null,
    allow_shipping: s.allowShipping ? 1 : 0,
    sales_tax_included: s.salesTaxIncluded ? 1 : 0,
    sale_description: (s.saleDescription as string) || null,
    clearance: s.clearance ? 1 : 0,
    bullet_1_text: (s.bullet1Text as string) || null,
    bullet_1_danger: s.bullet1Danger ? 1 : 0,
    bullet_1_highlight: s.bullet1Highlight ? 1 : 0,
    bullet_2_text: (s.bullet2Text as string) || null,
    bullet_2_danger: s.bullet2Danger ? 1 : 0,
    bullet_2_highlight: s.bullet2Highlight ? 1 : 0,
    bullet_3_text: (s.bullet3Text as string) || null,
    bullet_3_danger: s.bullet3Danger ? 1 : 0,
    bullet_3_highlight: s.bullet3Highlight ? 1 : 0,
    bullet_4_text: (s.bullet4Text as string) || null,
    bullet_4_danger: s.bullet4Danger ? 1 : 0,
    bullet_4_highlight: s.bullet4Highlight ? 1 : 0,
    bullet_5_text: (s.bullet5Text as string) || null,
    bullet_5_danger: s.bullet5Danger ? 1 : 0,
    bullet_5_highlight: s.bullet5Highlight ? 1 : 0,
    bullet_6_text: (s.bullet6Text as string) || null,
    bullet_6_danger: s.bullet6Danger ? 1 : 0,
    bullet_6_highlight: s.bullet6Highlight ? 1 : 0,
    barcode: (s.barcode as string) || null,
    purchased_date: (s.purchasedDate as string) || new Date().toISOString().slice(0, 10),
    unit_purchase_price: s.unitPurchasePrice != null ? Number(s.unitPurchasePrice) : null,
    map_price: s.mapPrice != null ? Number(s.mapPrice) : null,
    private_party_value: s.privatePartyValue != null ? Number(s.privatePartyValue) : 0,
    miles: Number(s.miles || 0),
    minutes_spent: Number(s.minutesSpent || 0),
    ship_cost: Number(s.shipCost || 0),
    purchase_notes: (s.purchaseNotes as string) || null,
    ai_analysis_text: (s.aiAnalysisText as string) || null,
    serial_number: (s.serialNumber as string) || null,
    weight_lbs: (s.weightLbs as string) || null,
    neck_profile: (s.neckProfile as string) || null,
    neck_thickness: (s.neckThickness as string) || null,
    nut_width: (s.nutWidth as string) || null,
    width_12_fret: (s.width12Fret as string) || null,
    fretboard_radius: (s.fretboardRadius as string) || null,
    twelve_fret_action: (s.twelveFretAction as string) || null,
    merchant_center_cat_code: (s.merchantCenterCatCode as string) || null,
  };

  // Remaining row: unchanged except quantity — stays for_sale and stays linked to Reverb
  // (reverb_listing_id isn't part of dbUpdateInventoryById's column set, so it's untouched).
  const remainingUpdateOk = await dbUpdateInventoryById(sourceId, {
    ...commonFields,
    image_url: primaryImageUrl,
    image_urls: imageUrls.join('\n'),
    title: String(s.title || ''),
    quantity: remainingQuantity,
    category_id: Number(s.categoryId),
    secondary_category_id: s.secondaryCategoryId != null ? Number(s.secondaryCategoryId) : null,
    purchase_lot_id: s.purchaseLotId != null ? Number(s.purchaseLotId) : null,
    queue: 'For Sale',
    storage_location: (s.storageLocation as string) || null,
    is_active: s.isActive ? 1 : 0,
    is_marked: s.isMarked ? 1 : 0,
    is_personal: s.isPersonal ? 1 : 0,
    is_consignment: s.isConsignment ? 1 : 0,
    is_rented: s.isRented ? 1 : 0,
    is_custom: s.isCustom ? 1 : 0,
    for_sale: 1,
    only_in_store: s.onlyInStore ? 1 : 0,
    sales_channel_ccg: s.salesChannelCcg ? 1 : 0,
    sales_channel_fbm: s.salesChannelFbm ? 1 : 0,
    sales_channel_cl: s.salesChannelCl ? 1 : 0,
    sales_channel_reverb: s.salesChannelReverb ? 1 : 0,
    sales_channel_gear_exchange: s.salesChannelGearExchange ? 1 : 0,
    sales_channel_offerup: s.salesChannelOfferUp ? 1 : 0,
    sales_channel_ebay: s.salesChannelEbay ? 1 : 0,
    sales_channel_nextdoor: s.salesChannelNextdoor ? 1 : 0,
    sales_channel_other: s.salesChannelOther ? 1 : 0,
    for_sale_date: (s.forSaleDate as string) || null,
    source_listing_id: s.sourceListingId != null ? Number(s.sourceListingId) : null,
    is_sold: 0,
    sold_date: null,
    sold_amount: null,
    sell_notes: null,
    sold_ship_cost_accounted: 0,
    subscription_id: s.subscriptionId != null ? Number(s.subscriptionId) : null,
    sale_url: (s.saleUrl as string) || null,
    sale_zip: (s.saleZip as string) || null,
    sold_channel: null,
    tag_reprint: 0,
  }, env);
  if (!remainingUpdateOk) return { ok: false, message: 'Unable to update the remaining inventory item.' };
  if (!(await dbReplaceInventoryImagesByItemIds([recordIdNum], imageRecords, env))) {
    return { ok: false, message: 'Unable to update the remaining inventory item images.' };
  }
  if (!(await dbReplaceInventoryTagsByItemIds([recordIdNum], tags, env))) {
    return { ok: false, message: 'Unable to update the remaining inventory item tags.' };
  }

  const soldCcgNumber = await generateUniqueCcgNumber(env);
  if (!soldCcgNumber) return { ok: false, message: 'Unable to generate a CCG number for the split-off sold item.' };

  const soldInsert = await dbCreateInventoryItems({
    ...commonFields,
    source_listing_id: null,
    ccg_number: soldCcgNumber,
    image_url: primaryImageUrl,
    image_urls: imageUrls.join('\n'),
    title: String(s.title || ''),
    quantity: soldQuantity,
    category_id: Number(s.categoryId),
    secondary_category_id: s.secondaryCategoryId != null ? Number(s.secondaryCategoryId) : null,
    purchase_lot_id: s.purchaseLotId != null ? Number(s.purchaseLotId) : null,
    queue: 'Sold',
    is_active: s.isActive ? 1 : 0,
    is_marked: 0,
    is_personal: s.isPersonal ? 1 : 0,
    is_consignment: s.isConsignment ? 1 : 0,
    is_rented: s.isRented ? 1 : 0,
    is_custom: s.isCustom ? 1 : 0,
    for_sale: 0,
    only_in_store: s.onlyInStore ? 1 : 0,
    sales_channel_ccg: 0,
    sales_channel_fbm: 0,
    sales_channel_cl: 0,
    sales_channel_reverb: 0,
    sales_channel_gear_exchange: 0,
    sales_channel_offerup: 0,
    sales_channel_ebay: 0,
    sales_channel_nextdoor: 0,
    sales_channel_other: 0,
    for_sale_date: null,
    is_sold: 1,
    sold_date: fields.soldDate,
    sold_amount: fields.soldAmount,
    sell_notes: fields.sellNotes,
    sold_ship_cost_accounted: fields.soldShipCostAccounted ? 1 : 0,
    sale_url: null,
    sale_zip: (s.saleZip as string) || null,
  }, env);
  if (!soldInsert?.firstId) return { ok: false, message: 'Unable to create the split-off sold item.' };

  const soldCloneOk = await dbUpdateInventoryById(soldInsert.firstId, {
    ...commonFields,
    image_url: primaryImageUrl,
    image_urls: imageUrls.join('\n'),
    title: String(s.title || ''),
    quantity: soldQuantity,
    category_id: Number(s.categoryId),
    secondary_category_id: s.secondaryCategoryId != null ? Number(s.secondaryCategoryId) : null,
    purchase_lot_id: s.purchaseLotId != null ? Number(s.purchaseLotId) : null,
    queue: 'Sold',
    storage_location: (s.storageLocation as string) || null,
    is_active: s.isActive ? 1 : 0,
    is_marked: 0,
    is_personal: s.isPersonal ? 1 : 0,
    is_consignment: s.isConsignment ? 1 : 0,
    is_rented: s.isRented ? 1 : 0,
    for_sale: 0,
    only_in_store: s.onlyInStore ? 1 : 0,
    sales_channel_ccg: 0,
    sales_channel_fbm: 0,
    sales_channel_cl: 0,
    sales_channel_reverb: 0,
    sales_channel_gear_exchange: 0,
    sales_channel_offerup: 0,
    sales_channel_ebay: 0,
    sales_channel_nextdoor: 0,
    sales_channel_other: 0,
    for_sale_date: null,
    source_listing_id: null,
    is_sold: 1,
    sold_date: fields.soldDate,
    sold_amount: fields.soldAmount,
    sell_notes: fields.sellNotes,
    sold_ship_cost_accounted: fields.soldShipCostAccounted ? 1 : 0,
    subscription_id: s.subscriptionId != null ? Number(s.subscriptionId) : null,
    sale_url: null,
    sale_zip: (s.saleZip as string) || null,
    sold_channel: 'Reverb',
    tag_reprint: 0,
  }, env);
  if (!soldCloneOk) return { ok: false, message: 'Split-off sold item was created, but failed to fully update.' };

  await dbSetInventorySoldAvailability(sourceId, false, env);
  await dbSetInventorySoldAvailability(soldInsert.firstId, true, env);
  if (!(await dbReplaceInventoryImagesByItemIds([Number(soldInsert.firstId)], imageRecords, env))) {
    return { ok: false, message: 'Split-off sold item was created, but its images failed to save.' };
  }
  if (!(await dbReplaceInventoryTagsByItemIds([Number(soldInsert.firstId)], tags, env))) {
    return { ok: false, message: 'Split-off sold item was created, but its tags failed to save.' };
  }

  return { ok: true, newInventoryId: soldInsert.firstId };
}

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
    const baseSellNotes = [
      `Sold via Reverb${orderNumber ? ` (order #${orderNumber})` : ''}${buyerName ? ` to ${buyerName}` : ''}.`,
      amountProduct != null ? `$${amountProduct} item` : null,
      shippingAmount != null ? `+ $${shippingAmount} shipping` : null,
      sellingFee != null ? `- $${sellingFee} selling fee` : null,
      checkoutFee != null ? `- $${checkoutFee} checkout fee` : null,
      `= $${payoutAmount.toFixed(2)} payout.`,
    ].filter(Boolean).join(' ');

    // If a shipping label was already bought through Reverb by the time we're syncing, account
    // for it right away instead of leaving it for the manual "Check Reverb Shipping" button.
    // Same unverified field-name caveat as that button — see extractShippingLabelFee.
    const labelFee = extractShippingLabelFee(order);
    const soldShipCostAccounted = labelFee != null && labelFee > 0;
    const finalSoldAmount = soldShipCostAccounted ? Math.max(0, payoutAmount - labelFee) : payoutAmount;
    const sellNotes = soldShipCostAccounted
      ? `${baseSellNotes} Reverb shipping label: -$${labelFee.toFixed(2)}. Adjusted payout: $${finalSoldAmount.toFixed(2)}.`
      : baseSellNotes;

    const orderQuantity = extractOrderQuantity(order);

    if (candidate.quantity > orderQuantity) {
      // Partial sale: more units remain locally than this order covers. Split off just the sold
      // unit(s) into a new row and decrement the original — leave the original for_sale and
      // still linked to Reverb, since a multi-unit listing likely stays live with the reduced
      // inventory count rather than ending.
      const split = await splitAndMarkPartialReverbSale(candidate.id, orderQuantity, {
        soldDate,
        soldAmount: finalSoldAmount,
        sellNotes,
        soldShipCostAccounted,
      }, env);
      if (!split.ok) {
        skipped.push({
          inventoryId: candidate.id,
          ccgNumber: candidate.ccgNumber,
          title: candidate.title,
          reason: `Matched a partial sale (${orderQuantity} of ${candidate.quantity}) but the split failed: ${split.message}`,
        });
        continue;
      }
      processed.push({
        inventoryId: candidate.id,
        newInventoryId: split.newInventoryId,
        ccgNumber: candidate.ccgNumber,
        title: candidate.title,
        reverbListingId: candidate.reverbListingId,
        soldAmount: finalSoldAmount,
        soldDate,
        orderNumber,
        soldQuantity: orderQuantity,
        remainingQuantity: candidate.quantity - orderQuantity,
        partial: true,
        shipCostAccounted: soldShipCostAccounted,
      });
      continue;
    }

    let endListingWarning: string | null = null;
    const ended = await endReverbListing(candidate.reverbListingId, env);
    if (!ended.ok) {
      // Very likely already ended/sold on Reverb's side — non-fatal, still mark sold locally.
      endListingWarning = ended.message;
    }

    const marked = await dbMarkInventorySoldFromReverb(candidate.id, {
      soldDate,
      soldAmount: finalSoldAmount,
      sellNotes,
      soldShipCostAccounted,
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
      soldAmount: finalSoldAmount,
      soldDate,
      orderNumber,
      endListingWarning,
      shipCostAccounted: soldShipCostAccounted,
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
