import type { Env } from '../env.js';
import { normalizeText, normalizeEmailAddress } from '../utils/text.js';
import { dbGetColumnNames, dbInsertFiltered, numberOrZero, stripeTimestampToIso, parseOptionalPositiveInt } from '../utils/misc.js';
import { parseCurrencyAmount } from '../utils/money.js';
import type { ShopCheckoutLineItem } from '../types/orders.js';
import { SHOP_BASE_PATH, ACTIVITY_BASE_URL } from '../constants.js';

import { toPublicShopImageUrl } from '../utils/image.js';
import { sendBrevoOrderConfirmationEmailForOrder } from './email.js';
import {
  dbGetOrderStatus,
  dbGetOrderIdByStripeCheckoutSessionId,
  parseStripeInventoryItemIds,
  buildPaymentLinkCheckoutOrderItems,
  dbListOrderInventoryQuantities,
  dbApplyPaidOrderInventoryAdjustments,
  dbApplyPaidInventoryItems,
  dbUpdateInventoryColumns,
} from './db2.js';

export async function dbCountOrderItems(orderIds: string[], env: Env): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (orderIds.length === 0) return counts;
  try {
    const placeholders = orderIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `SELECT order_id, COUNT(*) AS item_count
       FROM order_items
       WHERE order_id IN (${placeholders})
       GROUP BY order_id`
    ).bind(...orderIds).all<{ order_id: string | null; item_count: number | null }>();
    for (const row of result.results ?? []) {
      const id = normalizeText(row.order_id, '');
      if (id) counts.set(id, Number(row.item_count || 0));
    }
  } catch (error) {
    console.warn('Order item count lookup failed', { error });
  }
  return counts;
}

export async function dbListOrderEvents(orderId: string, env: Env): Promise<Array<Record<string, unknown>>> {
  try {
    const result = await env.DB.prepare(
      `SELECT *
       FROM order_events
       WHERE order_id = ?
       ORDER BY COALESCE(created_at, '') DESC`
    ).bind(orderId).all<Record<string, unknown>>();
    return (result.results ?? []).map((row, index) => ({
      id: normalizeText(row.id, '') || index + 1,
      eventType: normalizeText(row.event_type, ''),
      fromStatus: normalizeText(row.from_status, ''),
      toStatus: normalizeText(row.to_status, ''),
      message: normalizeText(row.message, ''),
      createdAt: normalizeText(row.created_at, ''),
    }));
  } catch (error) {
    console.warn('Order events lookup failed', { orderId, error });
    return [];
  }
}

export function buildOrderNumber(): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CCG-${stamp}-${suffix}`;
}

export function parseOrderBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeText(value, '').toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
}

export async function dbUpdateTableById(
  tableName: string,
  id: string,
  values: Record<string, unknown>,
  env: Env,
): Promise<void> {
  const existingCols = await dbGetColumnNames(tableName, env);
  const setColumns = Object.keys(values).filter((col) => existingCols.has(col));
  if (setColumns.length === 0) return;
  await env.DB.prepare(
    `UPDATE ${tableName}
     SET ${setColumns.map((columnName) => `${columnName} = ?`).join(', ')}
     WHERE id = ?`
  ).bind(...setColumns.map((columnName) => values[columnName]), id).run();
}

export async function dbRecordOrderEvent(
  orderId: string,
  event: {
    eventType: string;
    fromStatus: string | null;
    toStatus: string;
    source: string;
    sourceId: string;
    message: string;
    payloadJson: string;
  },
  env: Env,
): Promise<void> {
  try {
    const existingCols = await dbGetColumnNames('order_events', env);
    await dbInsertFiltered('order_events', {
      order_id: orderId,
      event_type: event.eventType,
      from_status: event.fromStatus,
      to_status: event.toStatus,
      source: event.source,
      source_id: event.sourceId,
      message: event.message,
      payload_json: event.payloadJson,
      created_at: new Date().toISOString(),
    }, existingCols, env);
  } catch (error) {
    console.error('Failed to record order event', { orderId, error });
  }
}

export async function dbGetOrderFundsAccountingTotals(
  orderId: string,
  env: Env,
): Promise<{ usedLocalFunds: number; mfrWholesaleFunds: number }> {
  const result = await env.DB.prepare(
    `SELECT payload_json
     FROM order_events
     WHERE order_id = ?
       AND event_type IN ('order_money_accounted', 'order_money_accounting_adjusted')`
  ).bind(orderId).all<{ payload_json: string | null }>();

  let usedLocalFunds = 0;
  let mfrWholesaleFunds = 0;
  for (const row of result.results ?? []) {
    if (!row.payload_json) continue;
    try {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      usedLocalFunds += parseCurrencyAmount(payload.usedLocalFunds) ?? 0;
      mfrWholesaleFunds += parseCurrencyAmount(payload.mfrWholesaleFunds) ?? 0;
    } catch {
      // Ignore malformed historical payloads; they should not block order detail or refund.
    }
  }

  return {
    usedLocalFunds: Number(Math.max(0, usedLocalFunds).toFixed(2)),
    mfrWholesaleFunds: Number(Math.max(0, mfrWholesaleFunds).toFixed(2)),
  };
}

export async function dbApplyOrderFundsAccounting(
  orderId: string,
  usedLocalFundsDelta: number,
  mfrWholesaleFundsDelta: number,
  adjustedCostBasis: number,
  env: Env,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE sys_info
       SET current_used_local_funds = ROUND(COALESCE(current_used_local_funds, 0) + ?, 2),
           current_mfr_wholesale_funds = ROUND(COALESCE(current_mfr_wholesale_funds, 0) + ?, 2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM sys_info ORDER BY id LIMIT 1)`
    ).bind(Number(usedLocalFundsDelta.toFixed(2)), Number(mfrWholesaleFundsDelta.toFixed(2))),
    env.DB.prepare(
      `UPDATE orders
       SET money_accounted = 1,
           cost_basis_adjusted = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(Number(adjustedCostBasis.toFixed(2)), orderId),
  ]);
}

export async function dbCalculateOrderCostBasis(orderId: string, env: Env): Promise<number> {
  const items = await dbListOrderInventoryQuantities(orderId, env);
  if (items.length === 0) return 0;

  let total = 0;
  for (const item of items) {
    const row = await env.DB.prepare(
      'SELECT unit_purchase_price FROM ccg_inventory_items WHERE id = ? LIMIT 1'
    ).bind(item.inventoryItemId).first<{ unit_purchase_price: number | null }>();
    total += Math.max(0, Number(row?.unit_purchase_price || 0)) * Math.max(1, item.quantity);
  }
  return Number(total.toFixed(2));
}

export async function dbUnwindRefundedOrderInventory(
  orderId: string,
  order: Record<string, unknown>,
  env: Env,
): Promise<void> {
  const items = await dbListOrderInventoryQuantities(orderId, env);
  const provider = normalizeText(order.checkout_provider, '') || (normalizeText(order.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const paidAt = normalizeText(order.paid_at ?? order.updated_at ?? order.created_at, '');
  const checkoutSessionId = normalizeText(order.stripe_checkout_session_id, '');

  for (const item of items) {
    const row = await env.DB.prepare(
      'SELECT * FROM ccg_inventory_items WHERE id = ? LIMIT 1'
    ).bind(item.inventoryItemId).first<Record<string, unknown>>();
    if (!row) continue;

    const purchasedQuantity = Math.max(1, item.quantity);
    const currentQuantity = Math.max(0, Number(row.quantity ?? 0));
    const rowIsSold = Number(row.is_sold || 0) === 1;
    const wasPartialSale = !rowIsSold && currentQuantity > 0;
    const restoredQuantity = rowIsSold
      ? Math.max(currentQuantity, purchasedQuantity)
      : currentQuantity + purchasedQuantity;
    const values = new Map<string, unknown>([
      ['quantity', restoredQuantity],
      ['is_sold', 0],
      ['for_sale', 1],
      ['availability_status', 'available'],
      ['active_order_id', null],
      ['reserved_until', null],
      ['sold_date', null],
      ['sold_amount', null],
      ['sell_notes', null],
      ['sold_channel', null],
      ['updated_at', new Date().toISOString()],
    ]);
    await dbUpdateInventoryColumns(item.inventoryItemId, orderId, values, env);

    if (wasPartialSale) {
      await dbDeactivateRefundedPartialSaleClone({
        sourceRow: row,
        item,
        provider,
        paidAt,
        checkoutSessionId,
        orderId,
        env,
      });
    }
  }
}

export async function dbReverseOrderFundsAccounting(
  orderId: string,
  env: Env,
): Promise<{ usedLocalFunds: number; mfrWholesaleFunds: number } | null> {
  const totals = await dbGetOrderFundsAccountingTotals(orderId, env);
  if (totals.usedLocalFunds <= 0 && totals.mfrWholesaleFunds <= 0) return null;

  const reversal = {
    usedLocalFunds: Number(Math.max(0, totals.usedLocalFunds).toFixed(2)),
    mfrWholesaleFunds: Number(Math.max(0, totals.mfrWholesaleFunds).toFixed(2)),
  };

  await env.DB.prepare(
    `UPDATE sys_info
     SET current_used_local_funds = ROUND(MAX(0, COALESCE(current_used_local_funds, 0) - ?), 2),
         current_mfr_wholesale_funds = ROUND(MAX(0, COALESCE(current_mfr_wholesale_funds, 0) - ?), 2),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = (SELECT id FROM sys_info ORDER BY id LIMIT 1)`
  ).bind(reversal.usedLocalFunds, reversal.mfrWholesaleFunds).run();

  await dbRecordOrderEvent(orderId, {
    eventType: 'order_money_accounting_reversed',
    fromStatus: 'paid',
    toStatus: 'refunded',
    source: 'admin_v2',
    sourceId: '',
    message: 'Order money accounting reversed. Funds removed from buckets.',
    payloadJson: JSON.stringify(reversal),
  }, env);

  return reversal;
}

export async function dbCreateCheckoutOrder(
  input: {
    orderId: string;
    orderNumber: string;
    status: string;
    channel: string;
    fulfillmentType: string;
    checkoutType: string;
    checkoutProvider: string;
    checkoutMode: string;
    subtotalCents: number;
    discountCents: number;
    couponCode: string | null;
    shippingStatus: string;
    shippingLabel: string;
    shippingCents: number;
    shippingTaxCents: number;
    taxCents: number;
    totalCents: number;
    cardAmountCents?: number | null;
    cashAmountCents?: number | null;
    successUrl: string;
    cancelUrl: string;
    createdAt: string;
    customerName?: string;
    customerEmail?: string;
    isSandbox?: boolean;
    items: ShopCheckoutLineItem[];
  },
  env: Env,
): Promise<void> {
  const firstItem = input.items[0];
  const orderTitleSnapshot = input.items.length === 1
    ? firstItem.title
    : `${firstItem.title} + ${input.items.length - 1} more`;
  const costBasisAdjusted = input.items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.row.unit_purchase_price || 0)) * Math.max(1, item.quantity),
    0,
  );

  const [orderCols, orderItemCols] = await Promise.all([
    dbGetColumnNames('orders', env),
    dbGetColumnNames('order_items', env),
  ]);

  await dbInsertFiltered('orders', {
    id: input.orderId,
    order_number: input.orderNumber,
    inventory_item_id: firstItem.inventoryItemId,
    status: input.status,
    channel: input.channel,
    checkout_type: input.checkoutType,
    checkout_provider: input.checkoutProvider,
    checkout_mode: input.checkoutMode,
    fulfillment_type: input.fulfillmentType,
    item_title_snapshot: orderTitleSnapshot,
    item_brand_snapshot: firstItem.row.brand || '',
    item_model_snapshot: firstItem.row.model || '',
    item_condition_snapshot: firstItem.row.condition || '',
    item_image_url_snapshot: firstItem.imageUrl,
    subtotal_cents: input.subtotalCents,
    tax_cents: input.taxCents,
    shipping_cents: input.shippingCents,
    shipping_status: input.shippingStatus,
    shipping_label: input.shippingLabel,
    shipping_tax_cents: input.shippingTaxCents,
    shipping_address_required: input.shippingStatus === 'free' || input.shippingStatus === 'flat_rate' ? 1 : 0,
    discount_cents: input.discountCents,
    coupon_code: input.couponCode,
    total_cents: input.totalCents,
    cost_basis_adjusted: Number(costBasisAdjusted.toFixed(2)),
    card_amount_cents: input.cardAmountCents ?? null,
    cash_amount_cents: input.cashAmountCents ?? null,
    cash_due_cents: input.cashAmountCents ?? null,
    settled: input.checkoutProvider === 'cash' ? 1 : 0,
    currency: 'usd',
    reserve_expires_at: null,
    checkout_started_at: input.createdAt,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_name: normalizeText(input.customerName, ''),
    customer_email: normalizeEmailAddress(input.customerEmail),
    is_sandbox: input.isSandbox ? 1 : 0,
    created_at: input.createdAt,
    updated_at: input.createdAt,
  }, orderCols, env);

  for (const item of input.items) {
    await dbInsertFiltered('order_items', {
      order_id: input.orderId,
      inventory_item_id: item.inventoryItemId,
      quantity: item.quantity,
      item_title_snapshot: item.title,
      title_snapshot: item.title,
      item_brand_snapshot: item.row.brand || '',
      brand_snapshot: item.row.brand || '',
      item_model_snapshot: item.row.model || '',
      model_snapshot: item.row.model || '',
      item_condition_snapshot: item.row.condition || '',
      condition_snapshot: item.row.condition || '',
      item_image_url_snapshot: item.imageUrl,
      image_url_snapshot: item.imageUrl,
      unit_amount_cents: item.unitAmountCents,
      unit_price_cents: item.unitAmountCents,
      unit_tax_cents: 0,
      subtotal_cents: item.unitAmountCents * item.quantity,
      total_cents: item.unitAmountCents * item.quantity,
      line_total_cents: item.unitAmountCents * item.quantity,
      line_tax_cents: 0,
      tax_cents: 0,
      discount_cents: 0,
      sale_url_slug: item.row.sale_url || '',
      sale_url: item.row.sale_url || '',
      category_name: item.row.primaryCategoryName || '',
      allow_shipping_snapshot: Number(item.row.allow_shipping || 0) === 1 ? 1 : 0,
      currency: 'usd',
      created_at: input.createdAt,
      updated_at: input.createdAt,
    }, orderItemCols, env);
  }

  await env.DB.prepare(
    `INSERT INTO order_events (
       order_id,
       event_type,
       from_status,
       to_status,
       source,
       source_id,
       message,
       created_at
     ) VALUES (?, 'checkout_created', NULL, 'checkout_open', 'public_site', NULL, ?, ?)`
  ).bind(
    input.orderId,
    input.checkoutMode === 'payment_link'
      ? 'Stripe Payment Link checkout created from webhook.'
      : `${input.checkoutProvider === 'cash' ? 'Cash checkout' : 'Stripe Checkout'} started from cart.`,
    input.createdAt,
  ).run();
}

export async function dbAttachStripeCheckoutSession(
  orderId: string,
  checkoutSessionId: string,
  env: Env,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE orders
     SET stripe_checkout_session_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(checkoutSessionId, orderId).run();
}

export async function dbCancelFailedCheckoutOrder(orderId: string, env: Env): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE orders
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND status != 'paid'`
    ).bind(orderId).run();
  } catch (error) {
    console.error('Failed to cancel checkout order after Stripe error', { orderId, error });
  }
}

export async function dbMarkManualCheckoutOrderPaid(
  orderId: string,
  input: {
    provider: string;
    paidAt: string;
    taxIncluded: boolean;
    items: Array<{ inventoryItemId: number; quantity: number; subtotalCents: number }>;
  },
  env: Env,
): Promise<void> {
  const currentStatus = await dbGetOrderStatus(orderId, env);
  if (currentStatus === 'paid') return;

  const session = {
    manual_provider: input.provider,
    payment_status: 'paid',
    id: `${input.provider}:${orderId}`,
  };
  await dbApplyPaidInventoryItems(orderId, input.items, session, env);

  await dbUpdateTableById('orders', orderId, {
    status: 'paid',
    paid_at: input.paidAt,
    stripe_payment_status: 'not_applicable',
    tax_included: input.taxIncluded ? 1 : 0,
    updated_at: input.paidAt,
  }, env);

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_succeeded',
    fromStatus: null,
    toStatus: 'paid',
    source: 'associate_checkout',
    sourceId: input.provider,
    message: 'Cash payment confirmed paid in full.',
    payloadJson: JSON.stringify({
      provider: input.provider,
      taxIncluded: input.taxIncluded,
    }),
  }, env);

  await sendBrevoOrderConfirmationEmailForOrder(orderId, env);
}

export async function dbMarkTerminalCheckoutOrderPaid(orderId: string, paymentIntent: any, env: Env): Promise<void> {
  const currentStatus = await dbGetOrderStatus(orderId, env);
  if (currentStatus === 'paid') return;
  if (currentStatus === 'cancelled' || currentStatus === 'canceled') {
    console.error('Refused to mark cancelled terminal order as paid — Stripe PaymentIntent may have succeeded after local cancel; manual review required', {
      orderId,
      paymentIntentId: normalizeText(paymentIntent?.id, ''),
    });
    return;
  }

  const paidAt = new Date().toISOString();
  const session = {
    id: normalizeText(paymentIntent?.id, ''),
    payment_intent: normalizeText(paymentIntent?.id, ''),
    payment_status: normalizeText(paymentIntent?.status, 'succeeded'),
    manual_provider: 'stripe_terminal',
  };
  const items = await dbListOrderInventoryQuantities(orderId, env);
  await dbApplyPaidInventoryItems(orderId, items, session, env);

  await dbUpdateTableById('orders', orderId, {
    status: 'paid',
    paid_at: paidAt,
    stripe_payment_intent_id: normalizeText(paymentIntent?.id, ''),
    stripe_payment_status: normalizeText(paymentIntent?.status, 'succeeded'),
    updated_at: paidAt,
  }, env);

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_succeeded',
    fromStatus: null,
    toStatus: 'paid',
    source: 'stripe_terminal',
    sourceId: normalizeText(paymentIntent?.id, ''),
    message: 'Stripe Terminal payment succeeded.',
    payloadJson: JSON.stringify({
      paymentIntentId: normalizeText(paymentIntent?.id, ''),
      paymentStatus: normalizeText(paymentIntent?.status, ''),
      cardAmountCents: numberOrZero(paymentIntent?.metadata?.card_amount_cents),
      cashAmountCents: numberOrZero(paymentIntent?.metadata?.cash_amount_cents),
      totalCents: numberOrZero(paymentIntent?.metadata?.total_cents),
    }),
  }, env);

  await sendBrevoOrderConfirmationEmailForOrder(orderId, env);
}

export async function dbGetOrderById(orderId: string, env: Env): Promise<Record<string, unknown> | null> {
  const normalizedOrderId = normalizeText(orderId, '');
  if (!normalizedOrderId) return null;
  return env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId)
    .first<Record<string, unknown>>();
}

export async function dbGetOrderReceipt(orderId: string, env: Env): Promise<Record<string, unknown> | null> {
  const order = await env.DB.prepare(
    'SELECT * FROM orders WHERE id = ? LIMIT 1'
  ).bind(orderId).first<Record<string, unknown>>();
  if (!order) return null;
  const splitTender = await dbGetOrderSplitTender(orderId, order, env);

  const itemRows = await env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  ).bind(orderId).all<Record<string, unknown>>();

  const inventoryItemIds = Array.from(new Set(
    (itemRows.results ?? [])
      .map((row) => parseOptionalPositiveInt(row.inventory_item_id ?? row.item_id ?? row.inventory_id))
      .filter((value): value is number => value != null),
  ));
  const inventoryById = new Map<number, {
    ccg_number: string | null;
    title: string | null;
    sale_title: string | null;
    image_url: string | null;
  }>();
  if (inventoryItemIds.length > 0) {
    const placeholders = inventoryItemIds.map(() => '?').join(', ');
    const inventoryRows = await env.DB.prepare(
      `SELECT
         i.id,
         i.ccg_number,
         i.title,
         i.sale_title,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM ccg_inventory_item_images sii_exists
             WHERE sii_exists.inventory_item_id = i.id
           ) THEN COALESCE((
             SELECT sii.image_url
             FROM ccg_inventory_item_images sii
             WHERE sii.inventory_item_id = i.id
               AND COALESCE(sii.is_private, 0) = 0
             ORDER BY sii.display_order ASC, sii.id ASC
             LIMIT 1
           ), '')
           ELSE i.image_url
         END AS image_url
       FROM ccg_inventory_items i
       WHERE i.id IN (${placeholders})`
    ).bind(...inventoryItemIds).all<{
      id: number;
      ccg_number: string | null;
      title: string | null;
      sale_title: string | null;
      image_url: string | null;
    }>();
    for (const row of inventoryRows.results ?? []) {
      inventoryById.set(Number(row.id), row);
    }
  }

  const items = (itemRows.results ?? []).map((row) => {
    const inventoryItemId = parseOptionalPositiveInt(row.inventory_item_id ?? row.item_id ?? row.inventory_id) ?? 0;
    const inventory = inventoryById.get(inventoryItemId);
    const quantity = parseOptionalPositiveInt(row.quantity ?? row.qty) ?? 1;
    const unitAmountCents = Number(row.unit_amount_cents ?? row.unit_price_cents ?? row.price_cents ?? 0);
    const subtotalCents = Number(row.subtotal_cents ?? row.total_cents ?? (Number.isFinite(unitAmountCents) ? unitAmountCents * quantity : 0));
    return {
      inventoryItemId,
      ccgNumber: normalizeText(inventory?.ccg_number, '') || (inventoryItemId ? `CCG-${inventoryItemId}` : ''),
      title: normalizeText(
        row.item_title_snapshot ?? row.title_snapshot ?? row.item_title ?? row.title ?? inventory?.sale_title ?? inventory?.title,
        'Item',
      ),
      imageUrl: toPublicShopImageUrl(row.image_url_snapshot ?? row.item_image_url_snapshot ?? row.image_url ?? inventory?.image_url, 'thumb'),
      quantity,
      unitAmountCents: Number.isFinite(unitAmountCents) ? unitAmountCents : 0,
      subtotalCents: Number.isFinite(subtotalCents) ? subtotalCents : 0,
      allowShipping: Number(row.allow_shipping_snapshot ?? 0) === 1,
    };
  });

  return {
    orderId: normalizeText(order.id, orderId),
    orderNumber: normalizeText(order.order_number, ''),
    status: normalizeText(order.status, ''),
    checkoutProvider: normalizeText(order.checkout_provider, '') || (normalizeText(order.stripe_checkout_session_id, '') ? 'stripe' : ''),
    stripePaymentIntentId: normalizeText(order.stripe_payment_intent_id, ''),
    subtotalCents: Number(order.subtotal_cents ?? 0) || 0,
    shippingStatus: normalizeText(order.shipping_status, 'in_store'),
    shippingLabel: normalizeText(order.shipping_label, Number(order.shipping_cents ?? 0) > 0 ? '$6.00' : 'IN-STORE'),
    shippingCents: Number(order.shipping_cents ?? 0) || 0,
    shippingTaxCents: Number(order.shipping_tax_cents ?? 0) || 0,
    taxCents: Number(order.tax_cents ?? 0) || 0,
    discountCents: Number(order.discount_cents ?? 0) || 0,
    totalCents: Number(order.total_cents ?? 0) || 0,
    cardAmountCents: splitTender.cardAmountCents,
    cashAmountCents: splitTender.cashAmountCents,
    createdAt: normalizeText(order.created_at ?? order.checkout_started_at, ''),
    paidAt: normalizeText(order.paid_at, ''),
    items,
  };
}

async function dbGetOrderSplitTender(
  orderId: string,
  order: Record<string, unknown>,
  env: Env,
): Promise<{ cardAmountCents: number; cashAmountCents: number }> {
  const cardAmountCents = numberOrZero(order.card_amount_cents);
  const cashAmountCents = numberOrZero(order.cash_amount_cents ?? order.cash_due_cents);
  if (cardAmountCents > 0 || cashAmountCents > 0) {
    return { cardAmountCents, cashAmountCents };
  }

  try {
    const result = await env.DB.prepare(
      `SELECT payload_json
       FROM order_events
       WHERE order_id = ?
         AND event_type IN ('split_tender_created', 'payment_succeeded')
       ORDER BY COALESCE(created_at, '') DESC
       LIMIT 5`
    ).bind(orderId).all<{ payload_json: string | null }>();
    for (const row of result.results ?? []) {
      const payload = JSON.parse(normalizeText(row?.payload_json, '{}')) as {
        cardAmountCents?: unknown;
        cashAmountCents?: unknown;
      };
      const parsed = {
        cardAmountCents: numberOrZero(payload.cardAmountCents),
        cashAmountCents: numberOrZero(payload.cashAmountCents),
      };
      if (parsed.cardAmountCents > 0 || parsed.cashAmountCents > 0) return parsed;
    }
    return { cardAmountCents: 0, cashAmountCents: 0 };
  } catch (error) {
    console.warn('Split tender lookup failed', { orderId, error });
    return { cardAmountCents: 0, cashAmountCents: 0 };
  }
}

export type OpenStripeCheckoutOrder = {
  id: string;
  orderNumber: string;
  stripeCheckoutSessionId: string;
  createdAt: string;
  totalCents: number;
};

export async function dbListOpenStripeCheckoutOrders(env: Env): Promise<OpenStripeCheckoutOrder[]> {
  const result = await env.DB.prepare(
    `SELECT id, order_number, stripe_checkout_session_id, created_at, total_cents
     FROM orders
     WHERE status = 'checkout_open'
       AND stripe_checkout_session_id IS NOT NULL
       AND stripe_checkout_session_id != ''
     ORDER BY created_at DESC`
  ).all<{ id: string; order_number: string; stripe_checkout_session_id: string; created_at: string; total_cents: number }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    orderNumber: normalizeText(row.order_number, row.id),
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    createdAt: row.created_at,
    totalCents: numberOrZero(row.total_cents),
  }));
}

export async function dbMarkStripeCheckoutOrderPaid(orderId: string, session: any, env: Env): Promise<void> {
  const currentStatus = await dbGetOrderStatus(orderId, env);
  if (currentStatus === 'paid') return;
  const splitTenderPayload = {
    cardAmountCents: numberOrZero(session?.metadata?.card_amount_cents),
    cashAmountCents: numberOrZero(session?.metadata?.cash_amount_cents),
    totalCents: numberOrZero(session?.metadata?.total_cents),
  };

  const inventoryItemIds = parseStripeInventoryItemIds(session);
  await dbApplyPaidOrderInventoryAdjustments(orderId, inventoryItemIds, session, env);

  await dbUpdateStripeOrderStatus(orderId, 'paid', session, env, {
    paid_at: new Date().toISOString(),
  });

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_succeeded',
    fromStatus: null,
    toStatus: 'paid',
    source: 'stripe_webhook',
    sourceId: normalizeText(session?.id, ''),
    message: 'Stripe Checkout payment succeeded.',
    payloadJson: JSON.stringify({
      checkoutSessionId: normalizeText(session?.id, ''),
      paymentIntentId: normalizeText(session?.payment_intent, ''),
      paymentStatus: normalizeText(session?.payment_status, ''),
      ...splitTenderPayload,
    }),
  }, env);

  await sendBrevoOrderConfirmationEmailForOrder(orderId, env);
}

export async function dbUpdateStripeOrderStatus(
  orderId: string,
  status: string,
  session: any,
  env: Env,
  extraValues: Record<string, unknown> = {},
): Promise<void> {
  // Stripe has used several field names across API versions
  const shippingDetails = session?.shipping_details
    ?? session?.collected_information?.shipping_details
    ?? session?.shipping;
  const shippingAddress = shippingDetails?.address ?? shippingDetails ?? {};
  await dbUpdateTableById('orders', orderId, {
    status,
    stripe_checkout_session_id: normalizeText(session?.id, ''),
    stripe_payment_intent_id: normalizeText(session?.payment_intent, ''),
    stripe_customer_id: normalizeText(session?.customer, ''),
    customer_name: normalizeText(session?.customer_details?.name, ''),
    customer_email: normalizeText(session?.customer_details?.email, ''),
    customer_phone: normalizeText(session?.customer_details?.phone, ''),
    stripe_customer_name: normalizeText(session?.customer_details?.name, ''),
    stripe_customer_email: normalizeText(session?.customer_details?.email, ''),
    stripe_customer_phone: normalizeText(session?.customer_details?.phone, ''),
    stripe_payment_status: normalizeText(session?.payment_status, ''),
    shipping_name: normalizeText(shippingDetails?.name, ''),
    shipping_phone: normalizeText(shippingDetails?.phone, ''),
    shipping_address_line1: normalizeText(shippingAddress?.line1, ''),
    shipping_address_line2: normalizeText(shippingAddress?.line2, ''),
    shipping_address_city: normalizeText(shippingAddress?.city, ''),
    shipping_address_state: normalizeText(shippingAddress?.state, ''),
    shipping_address_postal_code: normalizeText(shippingAddress?.postal_code, ''),
    shipping_address_country: normalizeText(shippingAddress?.country, ''),
    card_amount_cents: numberOrZero(session?.metadata?.card_amount_cents),
    cash_amount_cents: numberOrZero(session?.metadata?.cash_amount_cents),
    cash_due_cents: numberOrZero(session?.metadata?.cash_amount_cents),
    updated_at: new Date().toISOString(),
    ...extraValues,
  }, env);
}

export async function dbReleaseStripeCheckoutOrder(
  orderId: string,
  status: string,
  session: any,
  env: Env,
): Promise<void> {
  await dbUpdateStripeOrderStatus(orderId, status, session, env, {
    cancelled_at: new Date().toISOString(),
  });

  await dbRecordOrderEvent(orderId, {
    eventType: status,
    fromStatus: null,
    toStatus: status,
    source: 'stripe_webhook',
    sourceId: normalizeText(session?.id, ''),
    message: `Stripe Checkout ${status}.`,
    payloadJson: JSON.stringify({
      checkoutSessionId: normalizeText(session?.id, ''),
      paymentIntentId: normalizeText(session?.payment_intent, ''),
      paymentStatus: normalizeText(session?.payment_status, ''),
    }),
  }, env);
}

export async function dbEnsurePaymentLinkCheckoutOrder(session: any, event: any, env: Env): Promise<string> {
  const sessionId = normalizeText(session?.id, '');
  if (!sessionId) throw new Error('Stripe payment link webhook did not include a checkout session id.');

  const existingOrderId = await dbGetOrderIdByStripeCheckoutSessionId(sessionId, env);
  if (existingOrderId) return existingOrderId;

  const items = await buildPaymentLinkCheckoutOrderItems(session, event, env);
  if (items.length === 0) {
    throw new Error('Stripe payment link webhook did not include recognizable inventory items.');
  }

  const createdAt = stripeTimestampToIso(session?.created) || new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const itemSubtotalCents = items.reduce((sum, item) => sum + item.unitAmountCents * item.quantity, 0);
  const discountCents = numberOrZero(session?.total_details?.amount_discount);
  const totalCents = numberOrZero(session?.amount_total)
    || Math.max(0, itemSubtotalCents - discountCents + numberOrZero(session?.total_details?.amount_tax));
  const taxCents = numberOrZero(session?.total_details?.amount_tax)
    || Math.max(0, totalCents - itemSubtotalCents + discountCents);
  const subtotalCents = itemSubtotalCents || Math.max(0, numberOrZero(session?.amount_subtotal) - taxCents);
  const normalizedTotalCents = totalCents
    || Math.max(0, subtotalCents - discountCents + taxCents);
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const customerName = normalizeText(session?.customer_details?.name, '');
  const customerEmail = normalizeEmailAddress(session?.customer_details?.email);

  await dbCreateCheckoutOrder({
    orderId,
    orderNumber,
    status: 'checkout_open',
    channel: 'online',
    fulfillmentType: 'pickup',
    checkoutType: 'stripe',
    checkoutProvider: 'stripe',
    checkoutMode: 'payment_link',
    subtotalCents,
    discountCents,
    couponCode: null,
    shippingStatus: 'in_store',
    shippingLabel: 'IN-STORE',
    shippingCents: 0,
    shippingTaxCents: 0,
    taxCents,
    totalCents: normalizedTotalCents,
    successUrl,
    cancelUrl: '',
    createdAt,
    customerName,
    customerEmail,
    isSandbox: event?.livemode === false,
    items,
  }, env);

  await dbAttachStripeCheckoutSession(orderId, sessionId, env);
  await dbUpdateTableById('orders', orderId, {
    stripe_payment_intent_id: normalizeText(session?.payment_intent, ''),
    stripe_customer_id: normalizeText(session?.customer, ''),
    stripe_customer_name: customerName,
    stripe_customer_email: customerEmail,
    stripe_customer_phone: normalizeText(session?.customer_details?.phone, ''),
    stripe_payment_status: normalizeText(session?.payment_status, ''),
    updated_at: new Date().toISOString(),
  }, env);

  await dbRecordOrderEvent(orderId, {
    eventType: 'payment_link_order_created',
    fromStatus: null,
    toStatus: 'checkout_open',
    source: 'stripe_webhook',
    sourceId: sessionId,
    message: 'Order created from Stripe Payment Link payment.',
    payloadJson: JSON.stringify({
      checkoutSessionId: sessionId,
      paymentLinkId: normalizeText(session?.payment_link, ''),
      livemode: event?.livemode === true,
      inventoryItemIds: items.map((item) => item.inventoryItemId),
    }),
  }, env);

  return orderId;
}

async function dbDeactivateRefundedPartialSaleClone(input: {
  sourceRow: Record<string, unknown>;
  item: { inventoryItemId: number; quantity: number; subtotalCents: number };
  provider: string;
  paidAt: string;
  checkoutSessionId: string;
  orderId: string;
  env: Env;
}): Promise<void> {
  const sourceId = Number(input.sourceRow.id);
  const title = normalizeText(input.sourceRow.sale_title ?? input.sourceRow.title, '');
  const effectiveSubtotalCents = input.item.subtotalCents > 0
    ? input.item.subtotalCents
    : Math.round(Number(input.sourceRow.sale_price || input.sourceRow.regular_price || 0) * Math.max(1, input.item.quantity) * 100);
  const soldAmount = effectiveSubtotalCents / 100;
  if (!sourceId || !title) return;

  const clone = await input.env.DB.prepare(
    `SELECT id
     FROM ccg_inventory_items
     WHERE id != ?
       AND COALESCE(is_sold, 0) = 1
       AND COALESCE(sold_channel, '') = ?
       AND COALESCE(sold_amount, 0) = ?
       AND (COALESCE(sale_title, '') = ? OR COALESCE(title, '') = ?)
       AND (
         COALESCE(sell_notes, '') LIKE ?
         OR COALESCE(active_order_id, '') = ?
       )
     ORDER BY id DESC
     LIMIT 1`
  ).bind(
    sourceId,
    input.provider === 'cash' ? 'cash' : 'stripe',
    soldAmount,
    title,
    title,
    `%${input.orderId}%`,
    input.orderId,
  ).first<{ id: number | null }>();

  if (!clone?.id) return;

  const cloneId = Number(clone.id);
  await input.env.DB.prepare(
    `UPDATE ccg_inventory_items
     SET is_active = 0,
         for_sale = 0,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(cloneId).run();
}

export * from './db2.js';
