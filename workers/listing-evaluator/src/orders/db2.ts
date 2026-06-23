// orders/db2.ts — overflow from orders/db.ts (extracted from index.ts during incremental split).
// This file is re-exported by orders/db.ts via `export * from './db2.js'`.

import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { numberOrZero, parseOptionalPositiveInt, dbGetColumnNames } from '../utils/misc.js';
import { toPublicShopImageUrl } from '../utils/image.js';
import { getStripeRuntimeConfigForLivemode } from '../system/runtime.js';
import { generateUniqueCcgNumber } from '../inventory/db-write.js';
import { SHOP_SALES_TAX_RATE } from '../constants.js';
import type { ShopCheckoutLineItem, ShopCheckoutInventoryRow } from '../types/orders.js';

// ---------------------------------------------------------------------------
// Stripe session helpers
// ---------------------------------------------------------------------------

export async function dbGetOrderIdByStripeCheckoutSessionId(
  checkoutSessionId: string,
  env: Env,
): Promise<string | null> {
  const id = normalizeText(checkoutSessionId, '');
  if (!id) return null;
  const row = await env.DB.prepare(
    'SELECT id FROM orders WHERE stripe_checkout_session_id = ? LIMIT 1'
  ).bind(id).first<{ id: string | null }>();
  return normalizeText(row?.id, '') || null;
}

export async function dbGetOrderStatus(orderId: string, env: Env): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT status FROM orders WHERE id = ? LIMIT 1'
  ).bind(orderId).first<{ status: string | null }>();
  return normalizeText(row?.status, '') || null;
}

// ---------------------------------------------------------------------------
// Payment-link checkout helpers
// ---------------------------------------------------------------------------

export function parseStripeInventoryItemIds(session: any): number[] {
  const raw = normalizeText(session?.metadata?.inventory_item_ids, '');
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => parseOptionalPositiveInt(value.trim()))
        .filter((value): value is number => value != null),
    ),
  );
}

async function dbListCheckoutInventoryItems(
  itemIds: number[],
  env: Env,
): Promise<ShopCheckoutInventoryRow[]> {
  const uniqueIds = Array.from(new Set(itemIds)).filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT
       id,
       title,
       sale_title,
       brand,
       model,
       "condition",
       image_url,
      regular_price,
      sale_price,
      unit_purchase_price,
      allow_shipping,
      quantity,
       for_sale,
       only_in_store,
       is_sold,
       is_active,
       is_rented,
       availability_status,
       active_order_id,
       reserved_until
     FROM ccg_inventory_items
     WHERE id IN (${placeholders})`
  ).bind(...uniqueIds).all<ShopCheckoutInventoryRow>();
  return result.results ?? [];
}

async function listStripeCheckoutSessionLineItems(
  checkoutSessionId: string,
  livemode: boolean,
  env: Env,
): Promise<any[]> {
  const { secretKey } = await getStripeRuntimeConfigForLivemode(livemode, env);
  if (!secretKey || !checkoutSessionId) return [];

  const params = new URLSearchParams();
  params.set('limit', '100');
  params.append('expand[]', 'data.price.product');

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}/line_items?${params.toString()}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const data = await response.json<any>();
    if (!response.ok) {
      console.warn('Stripe checkout session line items lookup failed', {
        checkoutSessionId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
      return [];
    }
    return Array.isArray(data?.data) ? data.data : [];
  } catch (error) {
    console.warn('Stripe checkout session line items lookup failed', { checkoutSessionId, error });
    return [];
  }
}

function getStripeLineItemInventoryItemId(lineItem: any): number | null {
  const product = lineItem?.price?.product;
  return parseOptionalPositiveInt(lineItem?.metadata?.inventory_item_id)
    ?? parseOptionalPositiveInt(lineItem?.price?.metadata?.inventory_item_id)
    ?? parseOptionalPositiveInt(typeof product === 'object' ? product?.metadata?.inventory_item_id : null);
}

function getStripeLineItemTitle(lineItem: any): string {
  const product = lineItem?.price?.product;
  return normalizeText(
    lineItem?.description
      ?? (typeof product === 'object' ? product?.name : '')
      ?? lineItem?.price?.nickname,
    'Item',
  );
}

function buildMissingPaymentLinkInventoryRow(
  inventoryItemId: number,
  title: string,
): ShopCheckoutInventoryRow {
  return {
    id: inventoryItemId,
    title,
    sale_title: title,
    brand: '',
    model: '',
    condition: '',
    image_url: '',
    regular_price: 0,
    sale_price: 0,
    unit_purchase_price: 0,
    allow_shipping: 0,
    quantity: 1,
    for_sale: 0,
    only_in_store: 0,
    is_sold: 0,
    is_active: 0,
    is_rented: 0,
    availability_status: '',
    active_order_id: null,
    reserved_until: null,
  };
}

function getCheckoutItemTitle(row: ShopCheckoutInventoryRow): string {
  return normalizeText(row.sale_title, '') || normalizeText(row.title, '') || `Inventory item ${row.id}`;
}

export async function buildPaymentLinkCheckoutOrderItems(
  session: any,
  event: any,
  env: Env,
): Promise<ShopCheckoutLineItem[]> {
  const sessionId = normalizeText(session?.id, '');
  const fallbackIds = parseStripeInventoryItemIds(session);
  const stripeLineItems = sessionId
    ? await listStripeCheckoutSessionLineItems(sessionId, event?.livemode === true, env)
    : [];
  const byInventoryId = new Map<number, {
    quantity: number;
    subtotalCents: number;
    title: string;
  }>();

  for (const lineItem of stripeLineItems) {
    const inventoryItemId = getStripeLineItemInventoryItemId(lineItem);
    if (!inventoryItemId) continue;
    const quantity = parseOptionalPositiveInt(lineItem?.quantity) ?? 1;
    const subtotalCents = numberOrZero(lineItem?.amount_subtotal)
      || numberOrZero(lineItem?.amount_total);
    const existing = byInventoryId.get(inventoryItemId);
    byInventoryId.set(inventoryItemId, {
      quantity: (existing?.quantity ?? 0) + quantity,
      subtotalCents: (existing?.subtotalCents ?? 0) + subtotalCents,
      title: existing?.title || getStripeLineItemTitle(lineItem),
    });
  }

  for (const inventoryItemId of fallbackIds) {
    if (!byInventoryId.has(inventoryItemId)) {
      byInventoryId.set(inventoryItemId, {
        quantity: 1,
        subtotalCents: 0,
        title: '',
      });
    }
  }

  const inventoryItemIds = Array.from(byInventoryId.keys());
  if (inventoryItemIds.length === 0) return [];

  const rows = await dbListCheckoutInventoryItems(inventoryItemIds, env);
  const rowsById = new Map(rows.map((row) => [Number(row.id), row]));

  return inventoryItemIds.map((inventoryItemId) => {
    const line = byInventoryId.get(inventoryItemId);
    const row = rowsById.get(inventoryItemId) || buildMissingPaymentLinkInventoryRow(inventoryItemId, line?.title || 'Item');
    const quantity = Math.max(1, line?.quantity ?? 1);
    const lineSubtotalCents = Math.max(0, line?.subtotalCents ?? 0);
    const currentPriceCents = Math.round(Number(row.sale_price || row.regular_price || 0) * 100);
    const unitAmountCents = lineSubtotalCents > 0
      ? Math.round(lineSubtotalCents / quantity)
      : Number.isFinite(currentPriceCents) && currentPriceCents > 0
        ? currentPriceCents
        : 0;
    return {
      inventoryItemId,
      quantity,
      row,
      title: line?.title || getCheckoutItemTitle(row),
      unitAmountCents,
      imageUrl: toPublicShopImageUrl(row.image_url, 'thumb'),
    };
  });
}

// ---------------------------------------------------------------------------
// Inventory adjustment helpers (called after order is paid)
// ---------------------------------------------------------------------------

export async function dbListOrderInventoryQuantities(
  orderId: string,
  env: Env,
): Promise<Array<{ inventoryItemId: number; quantity: number; subtotalCents: number }>> {
  let result: { results: Record<string, unknown>[] };
  try {
    result = await env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    ).bind(orderId).all<Record<string, unknown>>();
  } catch {
    return [];
  }

  return (result.results ?? [])
    .map((row) => {
      const inventoryItemId = parseOptionalPositiveInt(
        row.inventory_item_id ?? row.item_id ?? row.inventory_id,
      );
      if (!inventoryItemId) return null;
      const quantity = parseOptionalPositiveInt(row.quantity ?? row.qty) ?? 1;
      const subtotalCents = Number(row.subtotal_cents ?? row.total_cents ?? 0);
      return {
        inventoryItemId,
        quantity,
        subtotalCents: Number.isFinite(subtotalCents) ? subtotalCents : 0,
      };
    })
    .filter((item): item is { inventoryItemId: number; quantity: number; subtotalCents: number } => item != null);
}

export async function dbApplyPaidOrderInventoryAdjustments(
  orderId: string,
  fallbackInventoryItemIds: number[],
  session: any,
  env: Env,
): Promise<void> {
  const orderItems = await dbListOrderInventoryQuantities(orderId, env);
  const items = orderItems.length > 0
    ? orderItems
    : fallbackInventoryItemIds.map((inventoryItemId) => ({
      inventoryItemId,
      quantity: 1,
      subtotalCents: 0,
    }));

  await dbApplyPaidInventoryItems(orderId, items, session, env);
}

export async function dbApplyPaidInventoryItems(
  orderId: string,
  items: Array<{ inventoryItemId: number; quantity: number; subtotalCents: number }>,
  session: any,
  env: Env,
): Promise<void> {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizeText(orderId, ''))
    .first<Record<string, unknown>>();
  const paidChannel = getPaidInventoryChannel(session, normalizeText(order?.channel, ''));
  let totalImplicitTaxCents = 0;
  for (const item of items) {
    totalImplicitTaxCents += await dbApplyPaidInventoryItemAdjustment(orderId, item, session, paidChannel, env);
  }
  if (totalImplicitTaxCents > 0) {
    await env.DB.prepare(
      `UPDATE orders
       SET tax_cents = COALESCE(tax_cents, 0) + ?,
           subtotal_cents = COALESCE(subtotal_cents, 0) - ?,
           updated_at = ?
       WHERE id = ?`,
    ).bind(totalImplicitTaxCents, totalImplicitTaxCents, new Date().toISOString(), normalizeText(orderId, '')).run();
  }
}

export function getPaidInventoryChannel(session: any, orderChannel = ''): string {
  if (orderChannel === 'online') return 'CCG External Web';
  if (orderChannel === 'in_store') return 'CCG In-Store';
  const manualProvider = normalizeText(session?.manual_provider, '');
  return manualProvider || 'stripe';
}

function getPaidInventorySellNote(session: any): string {
  const manualProvider = normalizeText(session?.manual_provider, '');
  if (manualProvider === 'cash') return 'Cash checkout';
  return `Stripe checkout ${normalizeText(session?.id, '')}`.trim();
}

export async function dbUpdateInventoryColumns(
  inventoryItemId: number,
  orderId: string,
  values: Map<string, unknown>,
  env: Env,
): Promise<void> {
  const existingCols = await dbGetColumnNames('ccg_inventory_items', env);
  const setColumns = Array.from(values.keys()).filter((col) => existingCols.has(col));
  if (setColumns.length === 0) return;
  const bindValues = setColumns.map((columnName) => values.get(columnName));
  bindValues.push(inventoryItemId);
  await env.DB.prepare(
    `UPDATE ccg_inventory_items
     SET ${setColumns.map((columnName) => `${columnName} = ?`).join(', ')}
     WHERE id = ?`
  ).bind(...bindValues).run();
}

async function dbUpdateOriginalInventoryAfterPartialSale(
  inventoryItemId: number,
  remainingQuantity: number,
  orderId: string,
  env: Env,
): Promise<void> {
  const values = new Map<string, unknown>([
    ['quantity', remainingQuantity],
    ['is_sold', 0],
    ['for_sale', 1],
    ['availability_status', 'available'],
    ['active_order_id', null],
    ['reserved_until', null],
    ['sold_date', null],
    ['sold_amount', null],
    ['sell_notes', null],
    ['updated_at', new Date().toISOString()],
  ]);
  await dbUpdateInventoryColumns(inventoryItemId, orderId, values, env);
}

async function dbUpdateOriginalInventoryAfterFullSale(
  inventoryItemId: number,
  soldQuantity: number,
  orderId: string,
  soldAmount: number,
  soldDate: string,
  session: any,
  paidChannel: string,
  env: Env,
): Promise<void> {
  const paidNote = getPaidInventorySellNote(session);
  const values = new Map<string, unknown>([
    ['quantity', soldQuantity],
    ['is_sold', 1],
    ['for_sale', 0],
    ['availability_status', 'sold'],
    ['active_order_id', null],
    ['reserved_until', null],
    ['sold_date', soldDate],
    ['sold_amount', soldAmount],
    ['sell_notes', paidNote],
    ['sold_channel', paidChannel],
    ['updated_at', new Date().toISOString()],
  ]);
  await dbUpdateInventoryColumns(inventoryItemId, orderId, values, env);
}

async function dbCopyInventoryImages(
  sourceInventoryItemId: number,
  targetInventoryItemId: number,
  env: Env,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO ccg_inventory_item_images (inventory_item_id, image_url, display_order, is_private)
       SELECT ?, image_url, display_order, is_private
       FROM ccg_inventory_item_images
       WHERE inventory_item_id = ?
       ORDER BY display_order ASC, id ASC`
    ).bind(targetInventoryItemId, sourceInventoryItemId).run();
  } catch (error) {
    console.warn('Sold clone image copy skipped', { sourceInventoryItemId, targetInventoryItemId, error });
  }
}

async function dbCreateSoldInventoryCloneFromSource(input: {
  sourceRow: Record<string, unknown>;
  soldQuantity: number;
  soldAmount: number;
  soldDate: string;
  orderId: string;
  session: any;
  paidChannel: string;
  env: Env;
}): Promise<number | null> {
  const sourceId = Number(input.sourceRow.id);
  if (!Number.isFinite(sourceId) || sourceId <= 0) return null;

  const ccgNumber = await generateUniqueCcgNumber(input.env);
  if (!ccgNumber) return null;

  const sourceValues = new Map(Object.entries(input.sourceRow));
  const paidNote = getPaidInventorySellNote(input.session);
  const overrideValues = new Map<string, unknown>([
    ['ccg_number', ccgNumber],
    ['quantity', input.soldQuantity],
    ['is_sold', 1],
    ['for_sale', 0],
    ['availability_status', 'sold'],
    ['active_order_id', null],
    ['reserved_until', null],
    ['sold_date', input.soldDate],
    ['sold_amount', input.soldAmount],
    ['sell_notes', paidNote],
    ['sold_channel', input.paidChannel],
    ['is_marked', 0],
    ['source_listing_id', null],
    ['sale_url_slug', null],
    ['for_sale_date', null],
    ['created_at', input.soldDate],
    ['updated_at', input.soldDate],
  ]);
  const insertColumns = Object.keys(input.sourceRow)
    .filter((columnName) => columnName !== 'id');
  const insertValues = insertColumns.map((columnName) =>
    overrideValues.has(columnName) ? overrideValues.get(columnName) : sourceValues.get(columnName)
  );

  const result = await input.env.DB.prepare(
    `INSERT INTO ccg_inventory_items (${insertColumns.join(', ')})
     VALUES (${insertColumns.map(() => '?').join(', ')})`
  ).bind(...insertValues).run();
  const cloneId = Number(result.meta?.last_row_id || 0);
  if (!Number.isFinite(cloneId) || cloneId <= 0) return null;

  await dbCopyInventoryImages(sourceId, cloneId, input.env);
  return cloneId;
}

export async function dbApplyPaidInventoryItemAdjustment(
  orderId: string,
  item: { inventoryItemId: number; quantity: number; subtotalCents: number },
  session: any,
  paidChannel: string,
  env: Env,
): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT * FROM ccg_inventory_items WHERE id = ? LIMIT 1'
  ).bind(item.inventoryItemId).first<Record<string, unknown>>();
  if (!row) return 0;

  const purchasedQuantity = Math.max(1, item.quantity);
  const currentQuantity = Math.max(0, Number(row.quantity ?? 1));
  const remainingQuantity = Math.max(0, currentQuantity - purchasedQuantity);
  const soldDate = new Date().toISOString();

  const effectiveSubtotalCents = item.subtotalCents > 0
    ? item.subtotalCents
    : Math.round(Number(row.sale_price || row.regular_price || 0) * purchasedQuantity * 100);
  const salesTaxIncluded = Number(row.sales_tax_included) === 1;
  const implicitTaxCents = salesTaxIncluded && effectiveSubtotalCents > 0
    ? Math.round(effectiveSubtotalCents * SHOP_SALES_TAX_RATE / (1 + SHOP_SALES_TAX_RATE))
    : 0;
  const soldAmount = (effectiveSubtotalCents - implicitTaxCents) / 100;

  if (remainingQuantity > 0) {
    await dbUpdateOriginalInventoryAfterPartialSale(
      item.inventoryItemId,
      remainingQuantity,
      orderId,
      env,
    );
    await dbCreateSoldInventoryCloneFromSource({
      sourceRow: row,
      soldQuantity: purchasedQuantity,
      soldAmount,
      soldDate,
      orderId,
      session,
      paidChannel,
      env,
    });
    return implicitTaxCents;
  }

  await dbUpdateOriginalInventoryAfterFullSale(
    item.inventoryItemId,
    purchasedQuantity,
    orderId,
    soldAmount,
    soldDate,
    session,
    paidChannel,
    env,
  );
  return implicitTaxCents;
}
