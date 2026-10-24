// Manual orders: an item marked sold in admin (FBM, Reverb, in-store, ...) can be put on
// a new order or added to an existing one, together with how it was paid. One order can
// hold several payments (e.g. guitar paid on FBM, case paid by Stripe link), each with its
// own fees, so the order can show a net payout. Checkout orders (Stripe / Terminal / cash)
// also record their payment here once paid, so every new order has a net.
import type { Env } from '../env.js';
import { normalizeText, normalizeEmailAddress } from '../utils/text.js';
import { dbGetColumnNames, dbInsertFiltered, jsonResponse, numberOrZero, parseOptionalPositiveInt } from '../utils/misc.js';
import { buildOrderNumber, dbRecordOrderEvent, dbUpdateTableById } from './db.js';


const ORDER_CHANNELS = new Set([
  'fbm', 'reverb', 'ebay', 'cl', 'offerup', 'nextdoor', 'gear_exchange', 'ccg_web', 'in_store', 'other',
]);
const PAYMENT_METHODS = new Set([
  'fbm', 'reverb', 'ebay', 'stripe_link', 'stripe_checkout', 'stripe_terminal', 'cash', 'venmo', 'zelle', 'paypal', 'other',
]);
// Money that is in hand at the time of sale; everything else waits for a payout.
const IMMEDIATE_PAYOUT_METHODS = new Set(['cash']);

type SoldItemRow = {
  id: number;
  ccg_number: string | null;
  title: string | null;
  sale_title: string | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  image_url: string | null;
  sale_url: string | null;
  quantity: number | null;
  sold_amount: number | null;
  sold_date: string | null;
  sold_channel: string | null;
  unit_purchase_price: number | null;
  allow_shipping: number | null;
  is_sold: number | null;
};

type PaymentInput = {
  method: string;
  grossCents: number;
  shippingChargedCents: number;
  taxCents: number;
  feeCents: number;
  feeIsEstimate: boolean;
  externalRef: string;
  paidAt: string;
  notes: string;
};

function centsInput(value: unknown): number {
  return numberOrZero(value);
}

function parsePaymentInput(raw: unknown, fallbackPaidAt: string): PaymentInput | { error: string } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const method = normalizeText(body.method, '').toLowerCase();
  if (!PAYMENT_METHODS.has(method)) return { error: 'Choose how this payment was made.' };
  const grossCents = centsInput(body.grossCents);
  if (grossCents <= 0) return { error: 'Payment amount must be greater than $0.' };
  const shippingChargedCents = centsInput(body.shippingChargedCents);
  const taxCents = centsInput(body.taxCents);
  const feeCents = centsInput(body.feeCents);
  if (taxCents + feeCents > grossCents) return { error: 'Tax plus fees cannot be more than the payment amount.' };
  if (shippingChargedCents > grossCents) return { error: 'Shipping charged cannot be more than the payment amount.' };
  return {
    method,
    grossCents,
    shippingChargedCents,
    taxCents,
    feeCents,
    feeIsEstimate: body.feeIsEstimate !== false,
    externalRef: normalizeText(body.externalRef, '').slice(0, 200),
    paidAt: normalizeText(body.paidAt, '') || fallbackPaidAt,
    notes: normalizeText(body.notes, '').slice(0, 2000),
  };
}

async function dbGetSoldItem(itemId: number, env: Env): Promise<SoldItemRow | null> {
  return env.DB.prepare(
    `SELECT id, ccg_number, title, sale_title, brand, model, condition, image_url, sale_url, quantity,
            sold_amount, sold_date, sold_channel, unit_purchase_price, allow_shipping, is_sold
     FROM ccg_inventory_items WHERE id = ? LIMIT 1`
  ).bind(itemId).first<SoldItemRow>();
}

// The order an item belongs to (ignoring cancelled orders), if any.
export async function dbFindOrderIdForInventoryItem(itemId: number, env: Env): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT oi.order_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.inventory_item_id = ?
       AND o.status NOT IN ('cancelled', 'canceled', 'expired', 'checkout_open', 'refunded')
     ORDER BY oi.id DESC
     LIMIT 1`
  ).bind(itemId).first<{ order_id: string }>();
  return row ? normalizeText(row.order_id, '') || null : null;
}

function soldLineTotalCents(item: SoldItemRow): number {
  const amount = Number(item.sold_amount ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

async function dbInsertOrderItemForSoldItem(orderId: string, item: SoldItemRow, env: Env): Promise<void> {
  const cols = await dbGetColumnNames('order_items', env);
  const quantity = Math.max(1, Number(item.quantity ?? 1) || 1);
  const lineTotalCents = soldLineTotalCents(item);
  const unitCents = Math.round(lineTotalCents / quantity);
  const title = normalizeText(item.sale_title, '') || normalizeText(item.title, 'Item');
  const now = new Date().toISOString();
  await dbInsertFiltered('order_items', {
    order_id: orderId,
    inventory_item_id: item.id,
    quantity,
    item_title_snapshot: title,
    title_snapshot: title,
    item_brand_snapshot: item.brand || '',
    brand_snapshot: item.brand || '',
    item_model_snapshot: item.model || '',
    model_snapshot: item.model || '',
    item_condition_snapshot: item.condition || '',
    condition_snapshot: item.condition || '',
    item_image_url_snapshot: item.image_url || '',
    image_url_snapshot: item.image_url || '',
    sku_snapshot: item.ccg_number || '',
    unit_amount_cents: unitCents,
    unit_price_cents: unitCents,
    unit_tax_cents: 0,
    subtotal_cents: lineTotalCents,
    total_cents: lineTotalCents,
    line_total_cents: lineTotalCents,
    line_tax_cents: 0,
    tax_cents: 0,
    discount_cents: 0,
    sale_url_slug: item.sale_url || '',
    sale_url: item.sale_url || '',
    allow_shipping_snapshot: Number(item.allow_shipping || 0) === 1 ? 1 : 0,
    currency: 'usd',
    created_at: now,
    updated_at: now,
  }, cols, env);
}

async function dbInsertOrderPayment(
  orderId: string,
  inventoryItemId: number | null,
  payment: PaymentInput,
  env: Env,
): Promise<void> {
  const netCents = payment.grossCents - payment.taxCents - payment.feeCents;
  const immediate = IMMEDIATE_PAYOUT_METHODS.has(payment.method);
  await env.DB.prepare(
    `INSERT INTO order_payments (
       order_id, inventory_item_id, method, status, gross_cents, shipping_charged_cents, tax_cents,
       fee_cents, fee_is_estimate, net_cents, external_ref, paid_at, payout_status, payout_received_at, notes
     ) VALUES (?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    orderId,
    inventoryItemId,
    payment.method,
    payment.grossCents,
    payment.shippingChargedCents,
    payment.taxCents,
    payment.feeCents,
    payment.feeIsEstimate ? 1 : 0,
    netCents,
    payment.externalRef || null,
    payment.paidAt,
    immediate ? 'received' : 'pending',
    immediate ? payment.paidAt : null,
    payment.notes || null,
  ).run();
}

// Manual orders' header totals are derived from their items and payments.
export async function dbRecalculateManualOrderTotals(orderId: string, env: Env): Promise<void> {
  const items = await env.DB.prepare(
    `SELECT oi.inventory_item_id, oi.quantity, oi.line_total_cents, oi.item_title_snapshot, oi.title_snapshot,
            oi.item_image_url_snapshot, oi.item_brand_snapshot, oi.item_model_snapshot, oi.item_condition_snapshot,
            i.unit_purchase_price
     FROM order_items oi
     LEFT JOIN ccg_inventory_items i ON i.id = oi.inventory_item_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`
  ).bind(orderId).all<Record<string, unknown>>();
  const rows: Array<Record<string, unknown>> = items.results ?? [];
  const payments = await env.DB.prepare(
    `SELECT COALESCE(SUM(gross_cents), 0) AS gross, COALESCE(SUM(shipping_charged_cents), 0) AS shipping,
            COALESCE(SUM(tax_cents), 0) AS tax, COALESCE(SUM(fee_cents), 0) AS fees
     FROM order_payments WHERE order_id = ? AND status <> 'refunded'`
  ).bind(orderId).first<{ gross: number; shipping: number; tax: number; fees: number }>();

  const subtotalCents = rows.reduce((sum, row) => sum + numberOrZero(row.line_total_cents), 0);
  const costBasis = rows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.unit_purchase_price || 0)) * Math.max(1, Number(row.quantity || 1)),
    0,
  );
  const order = await env.DB.prepare('SELECT fulfillment_type FROM orders WHERE id = ? LIMIT 1')
    .bind(orderId).first<{ fulfillment_type: string | null }>();
  const shippingChargedCents = numberOrZero(payments?.shipping);
  const shippingLabel = shippingChargedCents > 0
    ? `$${(shippingChargedCents / 100).toFixed(2)}`
    : normalizeText(order?.fulfillment_type, '') === 'ship' ? '$0.00' : 'PICKUP';
  const first = rows[0];
  const firstTitle = normalizeText(first?.item_title_snapshot ?? first?.title_snapshot, 'Item');
  await dbUpdateTableById('orders', orderId, {
    inventory_item_id: first ? Number(first.inventory_item_id) || null : null,
    item_title_snapshot: rows.length > 1 ? `${firstTitle} + ${rows.length - 1} more` : firstTitle,
    item_image_url_snapshot: normalizeText(first?.item_image_url_snapshot, ''),
    item_brand_snapshot: normalizeText(first?.item_brand_snapshot, ''),
    item_model_snapshot: normalizeText(first?.item_model_snapshot, ''),
    item_condition_snapshot: normalizeText(first?.item_condition_snapshot, ''),
    subtotal_cents: subtotalCents,
    shipping_cents: shippingChargedCents,
    shipping_label: shippingLabel,
    tax_cents: numberOrZero(payments?.tax),
    fee_cents: numberOrZero(payments?.fees),
    total_cents: numberOrZero(payments?.gross),
    cost_basis_adjusted: Number(costBasis.toFixed(2)),
    updated_at: new Date().toISOString(),
  }, env);
}

function normalizeChannel(value: unknown): string {
  const channel = normalizeText(value, '').toLowerCase();
  return ORDER_CHANNELS.has(channel) ? channel : 'other';
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    return null;
  }
}

async function loadAttachableItem(body: Record<string, unknown>, env: Env): Promise<SoldItemRow | Response> {
  const itemId = parseOptionalPositiveInt(body.inventoryItemId);
  if (!itemId) return jsonResponse({ message: 'Missing inventory item.' }, 400);
  const item = await dbGetSoldItem(itemId, env);
  if (!item) return jsonResponse({ message: 'Inventory item not found.' }, 404);
  if (Number(item.is_sold || 0) !== 1) return jsonResponse({ message: 'Mark the item sold before adding it to an order.' }, 400);
  const existingOrderId = await dbFindOrderIdForInventoryItem(itemId, env);
  if (existingOrderId) return jsonResponse({ message: 'This item is already on an order.', orderId: existingOrderId }, 409);
  return item;
}

// POST /api/admin-v2/orders/manual
export async function handleAdminV2ManualOrderCreate(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  const item = await loadAttachableItem(body, env);
  if (item instanceof Response) return item;

  const paidAt = normalizeText(item.sold_date, '') || new Date().toISOString();
  const payment = parsePaymentInput(body.payment, paidAt);
  if ('error' in payment) return jsonResponse({ message: payment.error }, 400);

  const fulfillmentType = normalizeText(body.fulfillmentType, '') === 'ship' ? 'ship' : 'pickup';
  const shipping = (body.shipping && typeof body.shipping === 'object' ? body.shipping : {}) as Record<string, unknown>;
  const customerName = normalizeText(body.customerName, '').slice(0, 200);
  const shipName = normalizeText(shipping.name, '').slice(0, 200) || customerName;
  if (fulfillmentType === 'ship') {
    const missing = ['line1', 'city', 'state', 'postalCode'].filter((key) => !normalizeText(shipping[key], ''));
    if (!shipName || missing.length > 0) {
      return jsonResponse({ message: 'Shipping orders need a name, street, city, state and ZIP.' }, 400);
    }
  }

  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const now = new Date().toISOString();
  const orderCols = await dbGetColumnNames('orders', env);
  await dbInsertFiltered('orders', {
    id: orderId,
    order_number: orderNumber,
    status: 'paid',
    channel: normalizeChannel(body.channel),
    channel_order_ref: normalizeText(body.channelOrderRef, '').slice(0, 200) || null,
    checkout_type: 'manual',
    checkout_provider: 'manual',
    checkout_mode: 'manual',
    fulfillment_type: fulfillmentType,
    customer_name: customerName || null,
    customer_email: normalizeEmailAddress(body.customerEmail) || null,
    customer_phone: normalizeText(body.customerPhone, '').slice(0, 50) || null,
    item_title_snapshot: normalizeText(item.sale_title, '') || normalizeText(item.title, 'Item'),
    subtotal_cents: 0,
    total_cents: 0,
    currency: 'usd',
    shipping_status: fulfillmentType === 'ship' ? 'ship' : 'in_store',
    shipping_address_required: fulfillmentType === 'ship' ? 1 : 0,
    shipping_name: fulfillmentType === 'ship' ? shipName : null,
    shipping_phone: fulfillmentType === 'ship' ? (normalizeText(shipping.phone, '') || normalizeText(body.customerPhone, '') || null) : null,
    shipping_address_line1: fulfillmentType === 'ship' ? normalizeText(shipping.line1, '') : null,
    shipping_address_line2: fulfillmentType === 'ship' ? (normalizeText(shipping.line2, '') || null) : null,
    shipping_address_city: fulfillmentType === 'ship' ? normalizeText(shipping.city, '') : null,
    shipping_address_state: fulfillmentType === 'ship' ? normalizeText(shipping.state, '').toUpperCase() : null,
    shipping_address_postal_code: fulfillmentType === 'ship' ? normalizeText(shipping.postalCode, '') : null,
    shipping_address_country: fulfillmentType === 'ship' ? (normalizeText(shipping.country, '') || 'US').toUpperCase() : null,
    notes: normalizeText(body.notes, '').slice(0, 4000) || null,
    paid_at: paidAt,
    listings_updated: 1,
    settled: 0,
    money_accounted: 0,
    is_sandbox: 0,
    created_at: now,
    updated_at: now,
  }, orderCols, env);

  await dbInsertOrderItemForSoldItem(orderId, item, env);
  await dbInsertOrderPayment(orderId, item.id, payment, env);
  await dbRecalculateManualOrderTotals(orderId, env);
  await dbRecordOrderEvent(orderId, {
    eventType: 'manual_order_created',
    fromStatus: null,
    toStatus: 'paid',
    source: 'admin_v2',
    sourceId: String(item.id),
    message: `Manual order created for ${item.ccg_number || `item ${item.id}`}.`,
    payloadJson: JSON.stringify({ inventoryItemId: item.id, payment }),
  }, env);

  return jsonResponse({ ok: true, orderId, orderNumber });
}

// POST /api/admin-v2/orders/:id/items
export async function handleAdminV2OrderAttachItem(request: Request, orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  const order = await env.DB.prepare('SELECT id, order_number, status, checkout_type FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId).first<{ id: string; order_number: string; status: string; checkout_type: string }>();
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);
  if (order.status !== 'paid') return jsonResponse({ message: 'Items can only be added to a paid order.' }, 400);

  const body = await readJson(request);
  if (!body) return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  const item = await loadAttachableItem(body, env);
  if (item instanceof Response) return item;

  let payment: PaymentInput | null = null;
  if (body.payment) {
    const parsed = parsePaymentInput(body.payment, normalizeText(item.sold_date, '') || new Date().toISOString());
    if ('error' in parsed) return jsonResponse({ message: parsed.error }, 400);
    payment = parsed;
  }

  await dbInsertOrderItemForSoldItem(order.id, item, env);
  if (payment) await dbInsertOrderPayment(order.id, item.id, payment, env);
  if (order.checkout_type === 'manual') {
    await dbRecalculateManualOrderTotals(order.id, env);
  }
  await dbRecordOrderEvent(order.id, {
    eventType: 'manual_item_added',
    fromStatus: order.status,
    toStatus: order.status,
    source: 'admin_v2',
    sourceId: String(item.id),
    message: `Added ${item.ccg_number || `item ${item.id}`} to the order${payment ? ' with a new payment' : ''}.`,
    payloadJson: JSON.stringify({ inventoryItemId: item.id, payment }),
  }, env);

  return jsonResponse({ ok: true, orderId: order.id, orderNumber: order.order_number });
}

// GET /api/admin-v2/orders/picker?q=  — paid orders, newest first (last 30 days unless searching).
export async function handleAdminV2OrderPicker(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = normalizeText(url.searchParams.get('q'), '').slice(0, 100);
  const binds: unknown[] = [];
  let where = "o.status = 'paid'";
  if (q) {
    where += ` AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.item_title_snapshot LIKE ? OR o.channel_order_ref LIKE ?)`;
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  } else {
    where += " AND COALESCE(o.paid_at, o.created_at) >= datetime('now', '-30 days')";
  }
  const result = await env.DB.prepare(
    `SELECT o.id, o.order_number, o.channel, o.customer_name, o.item_title_snapshot,
            COALESCE(o.paid_at, o.created_at) AS order_date,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o
     WHERE ${where}
     ORDER BY order_date DESC
     LIMIT 50`
  ).bind(...binds).all<Record<string, unknown>>();
  return jsonResponse({
    records: (result.results ?? []).map((row: Record<string, unknown>) => ({
      id: normalizeText(row.id, ''),
      orderNumber: normalizeText(row.order_number, ''),
      channel: normalizeText(row.channel, ''),
      customerName: normalizeText(row.customer_name, ''),
      itemTitle: normalizeText(row.item_title_snapshot, ''),
      itemCount: Number(row.item_count || 0),
      date: normalizeText(row.order_date, ''),
    })),
  });
}

// GET /api/admin-v2/inventory/:id/order
export async function handleAdminV2InventoryItemOrder(itemId: string, env: Env): Promise<Response> {
  const id = parseOptionalPositiveInt(itemId);
  if (!id) return jsonResponse({ message: 'Missing inventory item.' }, 400);
  const orderId = await dbFindOrderIdForInventoryItem(id, env);
  if (!orderId) return jsonResponse({ order: null });
  const order = await env.DB.prepare('SELECT id, order_number, channel, status FROM orders WHERE id = ? LIMIT 1')
    .bind(orderId).first<Record<string, unknown>>();
  return jsonResponse({
    order: order ? {
      id: normalizeText(order.id, ''),
      orderNumber: normalizeText(order.order_number, ''),
      channel: normalizeText(order.channel, ''),
      status: normalizeText(order.status, ''),
    } : null,
  });
}

// Called after an inventory save. Keeps manual orders in step with the item:
// unsold -> item leaves its manual order (order cancelled if empty, payment flagged);
// sold amount changed -> order item price + order totals follow.
export async function dbSyncManualOrderAfterInventorySave(
  itemId: number,
  change: { becameUnsold: boolean; isSold: boolean },
  env: Env,
): Promise<void> {
  try {
    const link = await env.DB.prepare(
      `SELECT oi.id AS order_item_id, oi.order_id, oi.line_total_cents, oi.quantity
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.inventory_item_id = ? AND o.checkout_type = 'manual' AND o.status = 'paid'
       ORDER BY oi.id DESC LIMIT 1`
    ).bind(itemId).first<{ order_item_id: number; order_id: string; line_total_cents: number; quantity: number }>();
    if (!link) return;

    if (change.becameUnsold) {
      await env.DB.prepare('DELETE FROM order_items WHERE id = ?').bind(link.order_item_id).run();
      await env.DB.prepare(
        `UPDATE order_payments SET status = 'refund_needed', updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ? AND inventory_item_id = ? AND status = 'received'`
      ).bind(link.order_id, itemId).run();
      const remaining = await env.DB.prepare('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?')
        .bind(link.order_id).first<{ n: number }>();
      const now = new Date().toISOString();
      if (Number(remaining?.n || 0) === 0) {
        await dbUpdateTableById('orders', link.order_id, { status: 'cancelled', cancelled_at: now, updated_at: now }, env);
      } else {
        await dbRecalculateManualOrderTotals(link.order_id, env);
      }
      await dbRecordOrderEvent(link.order_id, {
        eventType: 'manual_item_removed',
        fromStatus: 'paid',
        toStatus: Number(remaining?.n || 0) === 0 ? 'cancelled' : 'paid',
        source: 'admin_v2',
        sourceId: String(itemId),
        message: 'Item was marked unsold and removed from the order. Its payment is flagged for refund.',
        payloadJson: JSON.stringify({ inventoryItemId: itemId }),
      }, env);
      return;
    }

    if (!change.isSold) return;
    const item = await dbGetSoldItem(itemId, env);
    if (!item) return;
    const lineTotalCents = soldLineTotalCents(item);
    if (lineTotalCents === Number(link.line_total_cents || 0)) return;
    const quantity = Math.max(1, Number(link.quantity || 1));
    const unitCents = Math.round(lineTotalCents / quantity);
    const cols = await dbGetColumnNames('order_items', env);
    const values: Record<string, unknown> = {
      unit_amount_cents: unitCents,
      unit_price_cents: unitCents,
      subtotal_cents: lineTotalCents,
      total_cents: lineTotalCents,
      line_total_cents: lineTotalCents,
      updated_at: new Date().toISOString(),
    };
    const setCols = Object.keys(values).filter((col) => cols.has(col));
    await env.DB.prepare(
      `UPDATE order_items SET ${setCols.map((col) => `${col} = ?`).join(', ')} WHERE id = ?`
    ).bind(...setCols.map((col) => values[col]), link.order_item_id).run();
    await dbRecalculateManualOrderTotals(link.order_id, env);
  } catch (error) {
    console.error('Manual order sync after inventory save failed', { itemId, error });
  }
}

// Order payments for display, plus the order's net.
export async function dbListOrderPayments(orderId: string, env: Env): Promise<Array<Record<string, unknown>>> {
  const result = await env.DB.prepare(
    `SELECT p.*, i.ccg_number
     FROM order_payments p
     LEFT JOIN ccg_inventory_items i ON i.id = p.inventory_item_id
     WHERE p.order_id = ?
     ORDER BY p.paid_at ASC, p.id ASC`
  ).bind(orderId).all<Record<string, unknown>>();
  return (result.results ?? []).map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    inventoryItemId: row.inventory_item_id == null ? null : Number(row.inventory_item_id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    method: normalizeText(row.method, ''),
    status: normalizeText(row.status, ''),
    grossCents: numberOrZero(row.gross_cents),
    shippingChargedCents: numberOrZero(row.shipping_charged_cents),
    taxCents: numberOrZero(row.tax_cents),
    feeCents: numberOrZero(row.fee_cents),
    feeIsEstimate: Number(row.fee_is_estimate || 0) === 1,
    netCents: Number(row.net_cents || 0),
    externalRef: normalizeText(row.external_ref, ''),
    paidAt: normalizeText(row.paid_at, ''),
    payoutStatus: normalizeText(row.payout_status, ''),
    payoutReceivedAt: normalizeText(row.payout_received_at, ''),
    notes: normalizeText(row.notes, ''),
  }));
}

export type OrderPaymentTotals = { grossCents: number; feeCents: number; netCents: number; payoutPending: boolean; paymentCount: number };

export async function dbGetOrderPaymentTotals(orderIds: string[], env: Env): Promise<Map<string, OrderPaymentTotals>> {
  const totals = new Map<string, OrderPaymentTotals>();
  if (orderIds.length === 0) return totals;
  try {
    const result = await env.DB.prepare(
      `SELECT order_id,
              COUNT(*) AS payment_count,
              COALESCE(SUM(gross_cents), 0) AS gross,
              COALESCE(SUM(fee_cents), 0) AS fees,
              COALESCE(SUM(net_cents), 0) AS net,
              SUM(CASE WHEN payout_status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM order_payments
       WHERE order_id IN (${orderIds.map(() => '?').join(', ')}) AND status <> 'refunded'
       GROUP BY order_id`
    ).bind(...orderIds).all<Record<string, unknown>>();
    for (const row of result.results ?? []) {
      totals.set(normalizeText(row.order_id, ''), {
        grossCents: numberOrZero(row.gross),
        feeCents: numberOrZero(row.fees),
        netCents: Number(row.net || 0),
        payoutPending: Number(row.pending || 0) > 0,
        paymentCount: Number(row.payment_count || 0),
      });
    }
  } catch (error) {
    console.error('Order payment totals lookup failed', { error });
  }
  return totals;
}

// Stripe fee estimate (2.9% + 30¢), used until the real fee is confirmed.
function estimateStripeFeeCents(amountCents: number): number {
  return amountCents > 0 ? Math.round(amountCents * 0.029) + 30 : 0;
}

// Records the payment(s) for a checkout order once it is paid. Best-effort and idempotent:
// a failure here must never break the payment webhook.
export async function dbRecordCheckoutOrderPayments(
  orderId: string,
  input: { cardMethod: 'stripe_checkout' | 'stripe_link' | 'stripe_terminal' | 'cash'; externalRef: string },
  env: Env,
): Promise<void> {
  try {
    const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM order_payments WHERE order_id = ?')
      .bind(orderId).first<{ n: number }>();
    if (Number(existing?.n || 0) > 0) return;
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1').bind(orderId).first<Record<string, unknown>>();
    if (!order) return;

    const totalCents = numberOrZero(order.total_cents);
    const taxCents = numberOrZero(order.tax_cents) + numberOrZero(order.shipping_tax_cents);
    const shippingCents = numberOrZero(order.shipping_cents);
    const paidAt = normalizeText(order.paid_at, '') || new Date().toISOString();
    let cardCents = numberOrZero(order.card_amount_cents);
    let cashCents = numberOrZero(order.cash_amount_cents ?? order.cash_due_cents);
    if (cardCents + cashCents <= 0) {
      if (input.cardMethod === 'cash') cashCents = totalCents;
      else cardCents = totalCents;
    }
    const cardMethod = input.cardMethod === 'cash'
      ? 'stripe_terminal'
      : input.cardMethod === 'stripe_checkout' && normalizeText(order.checkout_mode, '') === 'payment_link'
        ? 'stripe_link'
        : input.cardMethod;
    const parts: Array<{ method: string; cents: number }> = [];
    if (cardCents > 0) parts.push({ method: cardMethod, cents: cardCents });
    if (cashCents > 0) parts.push({ method: 'cash', cents: cashCents });
    const partsTotal = parts.reduce((sum, part) => sum + part.cents, 0) || 1;

    for (const part of parts) {
      const share = part.cents / partsTotal;
      const partTax = Math.round(taxCents * share);
      const fee = part.method === 'cash' ? 0 : estimateStripeFeeCents(part.cents);
      await dbInsertOrderPayment(orderId, null, {
        method: part.method,
        grossCents: part.cents,
        shippingChargedCents: Math.round(shippingCents * share),
        taxCents: Math.min(partTax, part.cents),
        feeCents: Math.min(fee, Math.max(0, part.cents - partTax)),
        feeIsEstimate: part.method !== 'cash',
        externalRef: part.method === 'cash' ? '' : input.externalRef,
        paidAt,
        notes: '',
      }, env);
    }
  } catch (error) {
    console.error('Recording checkout order payment failed', { orderId, error });
  }
}
