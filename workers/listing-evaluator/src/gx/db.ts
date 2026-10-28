import type { Env } from '../env.js';

// ccg_inventory_gx_listings: one row per CCG item listed on GX (see d1-add-gx-listings.sql).
// sales_channel_gear_exchange on the item is kept in step with whether a row exists.

export type GxListingLink = {
  inventory_item_id: number;
  gx_listing_id: number;
  gx_status: string | null;
  gx_category_id: number | null;
  gx_condition_id: number | null;
  payout_method: string | null;
  options_json: string | null;
  images_pending: number;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const LINK_COLUMNS = `inventory_item_id, gx_listing_id, gx_status, gx_category_id, gx_condition_id, payout_method,
  options_json, images_pending, last_error, created_at, updated_at`;

export async function dbGetGxLinkForItem(inventoryItemId: number, env: Env): Promise<GxListingLink | null> {
  if (!Number.isFinite(inventoryItemId)) return null;
  const row = await env.DB.prepare(
    `SELECT ${LINK_COLUMNS} FROM ccg_inventory_gx_listings WHERE inventory_item_id = ? LIMIT 1`
  ).bind(inventoryItemId).first<GxListingLink>();
  return row ?? null;
}

export async function dbGetGxLinkByListingId(gxListingId: number, env: Env): Promise<GxListingLink | null> {
  if (!Number.isFinite(gxListingId)) return null;
  const row = await env.DB.prepare(
    `SELECT ${LINK_COLUMNS} FROM ccg_inventory_gx_listings WHERE gx_listing_id = ? LIMIT 1`
  ).bind(gxListingId).first<GxListingLink>();
  return row ?? null;
}

export async function dbListGxLinks(env: Env): Promise<GxListingLink[]> {
  const result = await env.DB.prepare(`SELECT ${LINK_COLUMNS} FROM ccg_inventory_gx_listings`).all<GxListingLink>();
  return result.results ?? [];
}

export async function dbInsertGxLink(
  link: {
    inventoryItemId: number;
    gxListingId: number;
    gxStatus: string | null;
    gxCategoryId: number;
    gxConditionId: number;
    payoutMethod: string;
    optionsJson: string;
  },
  env: Env,
): Promise<boolean> {
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO ccg_inventory_gx_listings (
           inventory_item_id, gx_listing_id, gx_status, gx_category_id, gx_condition_id, payout_method,
           options_json, images_pending, last_error, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        link.inventoryItemId,
        link.gxListingId,
        link.gxStatus,
        link.gxCategoryId,
        link.gxConditionId,
        link.payoutMethod,
        link.optionsJson,
      ),
      env.DB.prepare(
        'UPDATE ccg_inventory_items SET sales_channel_gear_exchange = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(link.inventoryItemId),
    ]);
    return true;
  } catch (error) {
    console.error('GX link insert failed', { error, inventoryItemId: link.inventoryItemId });
    return false;
  }
}

export async function dbDeleteGxLink(inventoryItemId: number, env: Env): Promise<boolean> {
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ccg_inventory_gx_listings WHERE inventory_item_id = ?').bind(inventoryItemId),
      env.DB.prepare(
        'UPDATE ccg_inventory_items SET sales_channel_gear_exchange = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(inventoryItemId),
    ]);
    return true;
  } catch (error) {
    console.error('GX link delete failed', { error, inventoryItemId });
    return false;
  }
}

export async function dbUpdateGxLink(
  inventoryItemId: number,
  fields: { gxStatus?: string | null; gxCategoryId?: number | null; imagesPending?: boolean; lastError?: string | null },
  env: Env,
): Promise<void> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (fields.gxStatus !== undefined) { sets.push('gx_status = ?'); binds.push(fields.gxStatus); }
  if (fields.gxCategoryId !== undefined) { sets.push('gx_category_id = ?'); binds.push(fields.gxCategoryId); }
  if (fields.imagesPending !== undefined) { sets.push('images_pending = ?'); binds.push(fields.imagesPending ? 1 : 0); }
  if (fields.lastError !== undefined) { sets.push('last_error = ?'); binds.push(fields.lastError); }
  if (!sets.length) return;
  try {
    await env.DB.prepare(
      `UPDATE ccg_inventory_gx_listings SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE inventory_item_id = ?`
    ).bind(...binds, inventoryItemId).run();
  } catch (error) {
    console.error('GX link update failed', { error, inventoryItemId });
  }
}

// The sold row a GX order already produced, found by the sell-notes sentence processGxSale writes.
// Lets a retried sale reuse it instead of splitting off a second unit.
export async function dbFindGxSoldRow(gxOrderId: number, env: Env): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT id FROM ccg_inventory_items
     WHERE sold_channel = 'Sweetwater Gear Exchange' AND COALESCE(is_sold, 0) = 1
       AND sell_notes LIKE ?
     ORDER BY id DESC LIMIT 1`
  ).bind(`Sold via Gear Exchange (order #${gxOrderId}).%`).first<{ id: number }>();
  return row ? String(row.id) : null;
}

// ---- Sale claims (one webhook at a time per GX order) -----------------------------------

const GX_SALE_CLAIM_STALE_MS = 5 * 60 * 1000;

// True if this call now holds the claim: no claim existed, or the existing one is abandoned.
export async function dbClaimGxSale(gxOrderId: number, env: Env): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - GX_SALE_CLAIM_STALE_MS).toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO gx_sale_claims (gx_order_id, claimed_at) VALUES (?, ?)
     ON CONFLICT(gx_order_id) DO UPDATE SET claimed_at = excluded.claimed_at
     WHERE gx_sale_claims.claimed_at < ?`
  ).bind(gxOrderId, now.toISOString(), staleBefore).run();
  return Number(result.meta?.changes || 0) > 0;
}

export async function dbReleaseGxSale(gxOrderId: number, env: Env): Promise<void> {
  try {
    await env.DB.prepare('DELETE FROM gx_sale_claims WHERE gx_order_id = ?').bind(gxOrderId).run();
  } catch (error) {
    console.error('GX sale claim release failed', { error, gxOrderId });
  }
}

// ---- CCG category -> GX category defaults ----------------------------------------------

export async function dbGetCcgCategoryGxDefault(ccgCategoryId: number, env: Env): Promise<number | null> {
  if (!Number.isFinite(ccgCategoryId)) return null;
  const row = await env.DB.prepare(
    'SELECT gx_category_id FROM ccg_inventory_categories WHERE id = ? LIMIT 1'
  ).bind(ccgCategoryId).first<{ gx_category_id: number | null }>();
  return row?.gx_category_id ?? null;
}

export async function dbSetCcgCategoryGxDefault(ccgCategoryId: number, gxCategoryId: number, env: Env): Promise<void> {
  if (!Number.isFinite(ccgCategoryId)) return;
  try {
    await env.DB.prepare('UPDATE ccg_inventory_categories SET gx_category_id = ? WHERE id = ?')
      .bind(gxCategoryId, ccgCategoryId).run();
  } catch (error) {
    console.error('GX category default update failed', { error, ccgCategoryId });
  }
}

// ---- Webhook event log -----------------------------------------------------------------

export async function dbInsertGxWebhookEvent(
  event: {
    eventType: string;
    status: string;
    gxListingId: number | null;
    gxOrderId: number | null;
    productId: string | null;
    payloadJson: string;
  },
  env: Env,
): Promise<number | null> {
  try {
    const result = await env.DB.prepare(
      `INSERT INTO gx_webhook_events (event_type, status, gx_listing_id, gx_order_id, product_id, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(event.eventType, event.status, event.gxListingId, event.gxOrderId, event.productId, event.payloadJson).run();
    return Number(result.meta?.last_row_id || 0) || null;
  } catch (error) {
    console.error('GX webhook event insert failed', { error });
    return null;
  }
}

export async function dbFinishGxWebhookEvent(eventId: number | null, result: 'processed' | 'ignored' | 'failed', message: string, env: Env): Promise<void> {
  if (!eventId) return;
  try {
    await env.DB.prepare('UPDATE gx_webhook_events SET result = ?, result_message = ? WHERE id = ?')
      .bind(result, message.slice(0, 2000), eventId).run();
  } catch (error) {
    console.error('GX webhook event update failed', { error, eventId });
  }
}

export async function dbListGxWebhookEvents(limit: number, env: Env): Promise<Array<Record<string, unknown>>> {
  const result = await env.DB.prepare(
    `SELECT id, event_type, status, gx_listing_id, gx_order_id, product_id, payload_json, result, result_message, received_at
     FROM gx_webhook_events ORDER BY id DESC LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>();
  return result.results ?? [];
}
