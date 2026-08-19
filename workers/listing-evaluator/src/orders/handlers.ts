import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';
import { formatSystemCurrency } from '../utils/money.js';

import {
  dbCountOrderItems,
  dbGetOrderReceipt,
  dbListOrderEvents,
  dbCalculateOrderCostBasis,
  dbGetOrderFundsAccountingTotals,
  dbUpdateTableById,
  dbRecordOrderEvent,
  dbUnwindRefundedOrderInventory,
  dbReverseOrderFundsAccounting,
  dbListOpenStripeCheckoutOrders,
  dbMarkStripeCheckoutOrderPaid,
  dbReleaseStripeCheckoutOrder,
} from './db.js';
import { toBooleanInput } from '../utils/misc.js';
import { parseCurrencyAmount } from '../utils/money.js';
import { createStripeFeeAdjustedRefund } from './refund.js';
import { resolveOrderStripeCustomer, resolveStripePaymentMethodLabel, fetchStripeCheckoutSession } from './stripe.js';
import { getStripeRuntimeConfig, getStripeRuntimeConfigForLivemode } from '../system/runtime.js';

export async function handleAdminV2ReconcileStripeCheckoutOrders(env: Env): Promise<Response> {
  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  if (!stripeSecretKey) {
    return jsonResponse({ message: 'Stripe is not configured.' }, 503);
  }

  const openOrders = await dbListOpenStripeCheckoutOrders(env);
  const markedPaid: Array<{ orderId: string; orderNumber: string }> = [];
  const released: Array<{ orderId: string; orderNumber: string; status: string }> = [];
  const stillOpen: Array<{ orderId: string; orderNumber: string }> = [];
  const errors: Array<{ orderId: string; orderNumber: string; error: string }> = [];

  for (const order of openOrders) {
    try {
      const rawSession = await fetchStripeCheckoutSession(
        order.stripeCheckoutSessionId,
        stripeSecretKey,
        ['payment_intent.latest_charge'],
      );
      if (!rawSession) {
        errors.push({ orderId: order.id, orderNumber: order.orderNumber, error: 'Stripe session lookup failed.' });
        continue;
      }

      // Normalize payment_intent back to a plain id string so it matches the shape
      // dbMarkStripeCheckoutOrderPaid/dbUpdateStripeOrderStatus expect from the webhook payload.
      const latestCharge = rawSession?.payment_intent?.latest_charge;
      const isRefunded = Boolean(latestCharge?.refunded) || Number(latestCharge?.amount_refunded || 0) > 0;
      const paymentIntentId = typeof rawSession?.payment_intent === 'object'
        ? normalizeText(rawSession.payment_intent?.id, '')
        : normalizeText(rawSession?.payment_intent, '');
      const session = { ...rawSession, payment_intent: paymentIntentId };

      if (normalizeText(session?.payment_status, '') === 'paid' && isRefunded) {
        // Already refunded before we ever recorded it as paid (e.g. a duplicate charge
        // refunded directly in Stripe) — record the real outcome without decrementing
        // inventory or sending a paid confirmation email for a sale that didn't happen.
        await dbReleaseStripeCheckoutOrder(order.id, 'refunded', session, env);
        released.push({ orderId: order.id, orderNumber: order.orderNumber, status: 'refunded' });
      } else if (normalizeText(session?.payment_status, '') === 'paid') {
        await dbMarkStripeCheckoutOrderPaid(order.id, session, env);
        markedPaid.push({ orderId: order.id, orderNumber: order.orderNumber });
      } else if (normalizeText(session?.status, '') === 'expired') {
        await dbReleaseStripeCheckoutOrder(order.id, 'expired', session, env);
        released.push({ orderId: order.id, orderNumber: order.orderNumber, status: 'expired' });
      } else {
        stillOpen.push({ orderId: order.id, orderNumber: order.orderNumber });
      }
    } catch (error) {
      errors.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        error: error instanceof Error ? error.message : 'Reconciliation failed.',
      });
    }
  }

  return jsonResponse({
    ok: true,
    checked: openOrders.length,
    markedPaid,
    released,
    stillOpen,
    errors,
  });
}

export async function handleAdminV2Orders(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const result = await env.DB.prepare(
    `SELECT *
     FROM orders
     ORDER BY COALESCE(paid_at, checkout_started_at, created_at) DESC
     LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>();

  const records = result.results ?? [];
  const itemCounts = await dbCountOrderItems(records.map((row) => normalizeText(row.id, '')).filter(Boolean), env);
  const enriched = await Promise.all(records.map(async (row) => {
    const stripeCustomer = await resolveOrderStripeCustomer(row, env);
    const orderId = normalizeText(row.id, '');
    return mapAdminOrderSummary(row, itemCounts.get(orderId) || 0, stripeCustomer);
  }));

  return jsonResponse({ records: enriched });
}

export async function handleAdminV2OrderDetail(orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await dbGetOrderReceipt(normalizedOrderId, env);
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const rawOrder = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId)
    .first<Record<string, unknown>>();
  const stripeCustomer = rawOrder ? await resolveOrderStripeCustomer(rawOrder, env) : null;
  const events = await dbListOrderEvents(normalizedOrderId, env);
  const provider = normalizeText(order.checkoutProvider, '') || (normalizeText(rawOrder?.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const paymentMethodLabel = provider === 'cash'
    ? 'Cash'
    : await resolveStripePaymentMethodLabel(normalizeText(order.stripePaymentIntentId, ''), env);
  const storedCostBasis = parseCurrencyAmount(rawOrder?.cost_basis_adjusted) ?? 0;
  const moneyAccounted = parseOrderBoolean(rawOrder?.money_accounted);
  const costBasisAdjusted = moneyAccounted || storedCostBasis > 0
    ? storedCostBasis
    : await dbCalculateOrderCostBasis(normalizedOrderId, env);

  return jsonResponse({
    record: {
      ...order,
      listingsUpdated: parseOrderBoolean(rawOrder?.listings_updated),
      settled: parseOrderBoolean(rawOrder?.settled),
      isSandbox: Number(rawOrder?.is_sandbox) === 1,
      moneyAccounted,
      costBasisAdjusted: formatSystemCurrency(costBasisAdjusted),
      accountingFunds: await dbGetOrderFundsAccountingTotals(normalizedOrderId, env),
      paymentMethodLabel,
      customer: {
        ...buildAdminOrderCustomer(rawOrder || {}, stripeCustomer),
        shippingAddressLine1: normalizeText(rawOrder?.shipping_address_line1, ''),
        shippingAddressLine2: normalizeText(rawOrder?.shipping_address_line2, ''),
        shippingAddressCity: normalizeText(rawOrder?.shipping_address_city, ''),
        shippingAddressState: normalizeText(rawOrder?.shipping_address_state, ''),
        shippingAddressPostalCode: normalizeText(rawOrder?.shipping_address_postal_code, ''),
        shippingAddressCountry: normalizeText(rawOrder?.shipping_address_country, ''),
      },
      events,
    },
  });
}

export async function handleAdminV2OrderStatusFlagsUpdate(request: Request, orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const existing = await env.DB.prepare(
    'SELECT id, listings_updated, settled, money_accounted FROM orders WHERE id = ? LIMIT 1'
  ).bind(normalizedOrderId).first<Record<string, unknown>>();
  if (!existing) return jsonResponse({ message: 'Order not found.' }, 404);

  const updates: Record<string, unknown> = {};
  const eventPayload: Record<string, { from: boolean; to: boolean }> = {};
  const fieldMap = [
    ['listingsUpdated', 'listings_updated'],
    ['settled', 'settled'],
    ['moneyAccounted', 'money_accounted'],
  ] as const;

  for (const [payloadKey, columnName] of fieldMap) {
    if (!(payloadKey in body)) continue;
    const nextValue = toBooleanInput(body[payloadKey], false);
    const previousValue = parseOrderBoolean(existing[columnName]);
    updates[columnName] = nextValue ? 1 : 0;
    if (previousValue !== nextValue) {
      eventPayload[payloadKey] = { from: previousValue, to: nextValue };
    }
  }

  if (Object.keys(updates).length === 0) {
    return jsonResponse({
      ok: true,
      listingsUpdated: parseOrderBoolean(existing.listings_updated),
      settled: parseOrderBoolean(existing.settled),
      moneyAccounted: parseOrderBoolean(existing.money_accounted),
    });
  }

  await dbUpdateTableById('orders', normalizedOrderId, {
    ...updates,
    updated_at: new Date().toISOString(),
  }, env);

  if (Object.keys(eventPayload).length > 0) {
    await dbRecordOrderEvent(normalizedOrderId, {
      eventType: 'order_status_flags_updated',
      fromStatus: null,
      toStatus: normalizeText(existing.status, ''),
      source: 'admin-v2',
      sourceId: '',
      message: 'Order status flags updated.',
      payloadJson: JSON.stringify(eventPayload),
    }, env);
  }

  const refreshed = await env.DB.prepare(
    'SELECT listings_updated, settled, money_accounted FROM orders WHERE id = ? LIMIT 1'
  ).bind(normalizedOrderId).first<Record<string, unknown>>();

  return jsonResponse({
    ok: true,
    listingsUpdated: parseOrderBoolean(refreshed?.listings_updated),
    settled: parseOrderBoolean(refreshed?.settled),
    moneyAccounted: parseOrderBoolean(refreshed?.money_accounted),
  });
}

export async function handleAdminV2OrderRefund(orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId)
    .first<Record<string, unknown>>();
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const status = normalizeText(order.status, '');
  if (status !== 'paid') {
    return jsonResponse({ message: 'Only paid orders can be refunded.' }, 409);
  }

  const provider = normalizeText(order.checkout_provider, '') || (normalizeText(order.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const totalCents = Number(order.total_cents ?? 0) || 0;
  const now = new Date().toISOString();
  let stripeRefundId = '';
  let stripeRefundAmountCents = 0;
  let stripeRetainedFeeCents = 0;
  let stripeRefundFeeSource = '';
  let stripeRefundPaymentMethodType = '';

  if (provider !== 'cash') {
    const paymentIntentId = normalizeText(order.stripe_payment_intent_id, '');
    if (!paymentIntentId) {
      return jsonResponse({ message: 'Stripe payment intent is missing for this order.' }, 400);
    }
    // Use the Stripe key for the environment this order was actually placed in, not
    // whatever sys_info.use_stripe_sandbox happens to be toggled to right now.
    const isSandbox = Number(order.is_sandbox) === 1;
    const { secretKey: orderSecretKey } = await getStripeRuntimeConfigForLivemode(!isSandbox, env);
    const stripeRefund = await createStripeFeeAdjustedRefund(paymentIntentId, normalizedOrderId, totalCents, env, orderSecretKey);
    if (!stripeRefund.ok) {
      await dbRecordOrderEvent(normalizedOrderId, {
        eventType: 'refund_failed',
        fromStatus: 'paid',
        toStatus: 'paid',
        source: 'admin_v2',
        sourceId: paymentIntentId,
        message: stripeRefund.message,
        payloadJson: JSON.stringify({ provider, paymentIntentId, status: stripeRefund.status }),
      }, env);
      return jsonResponse({ message: stripeRefund.message }, stripeRefund.status || 502);
    }
    stripeRefundId = stripeRefund.refundId;
    stripeRefundAmountCents = stripeRefund.refundAmountCents;
    stripeRetainedFeeCents = stripeRefund.retainedFeeCents;
    stripeRefundFeeSource = stripeRefund.feeSource;
    stripeRefundPaymentMethodType = stripeRefund.paymentMethodType;
  }

  await dbUnwindRefundedOrderInventory(normalizedOrderId, order, env);
  const fundsReversal = parseOrderBoolean(order.money_accounted)
    ? await dbReverseOrderFundsAccounting(normalizedOrderId, env)
    : null;
  const retainedStripeFee = provider !== 'cash' && stripeRetainedFeeCents > 0;
  const stripeRefundMessage = retainedStripeFee
    ? 'Stripe financing order refunded less financing processing fee'
    : 'Stripe order refunded';

  await dbUpdateTableById('orders', normalizedOrderId, {
    status: 'refunded',
    refunded_at: now,
    cancelled_at: now,
    stripe_payment_status: provider === 'cash' ? 'not_applicable' : 'refunded',
    stripe_refund_id: stripeRefundId,
    money_accounted: fundsReversal ? 0 : order.money_accounted,
    updated_at: now,
  }, env);

  await dbRecordOrderEvent(normalizedOrderId, {
    eventType: 'refund_succeeded',
    fromStatus: 'paid',
    toStatus: 'refunded',
    source: 'admin_v2',
    sourceId: stripeRefundId || provider,
    message: fundsReversal
      ? `${provider === 'cash' ? 'Cash order refunded' : stripeRefundMessage}. Inventory was restored. Accounted funds were removed.`
      : provider === 'cash'
        ? 'Cash order refunded. Inventory was restored.'
        : `${stripeRefundMessage}. Inventory was restored.`,
    payloadJson: JSON.stringify({
      provider,
      totalCents,
      stripeRefundId,
      stripeRefundAmountCents,
      stripeRetainedFeeCents,
      stripeRefundFeeSource,
      stripeRefundPaymentMethodType,
      fundsReversal,
    }),
  }, env);

  return jsonResponse({
    message: provider === 'cash' ? 'Cash order refunded.' : `${stripeRefundMessage}.`,
    provider,
    stripeRefundId,
    stripeRefundAmountCents,
    stripeRetainedFeeCents,
  });
}

// Fully reverses an order and then deletes it — unlike Refund (which keeps a 'refunded'
// record), Rollback erases the order as if it never happened. Used for test/mistaken
// orders. For paid orders it refunds via Stripe using the key for whichever environment
// (sandbox/live) the order was actually placed in — not the current global toggle — then
// restores inventory and reverses funds accounting exactly like a refund would, before
// deleting the order, its items, and its events.
export async function handleAdminV2OrderRollback(orderId: string, env: Env): Promise<Response> {
  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
    .bind(normalizedOrderId)
    .first<Record<string, unknown>>();
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const status = normalizeText(order.status, '');
  const provider = normalizeText(order.checkout_provider, '') || (normalizeText(order.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const totalCents = Number(order.total_cents ?? 0) || 0;
  const isSandbox = Number(order.is_sandbox) === 1;

  let stripeRefundId = '';
  let stripeRefundAmountCents = 0;

  if (status === 'paid') {
    if (provider !== 'cash') {
      const paymentIntentId = normalizeText(order.stripe_payment_intent_id, '');
      if (!paymentIntentId) {
        return jsonResponse({ message: 'Stripe payment intent is missing for this order — rollback aborted.' }, 400);
      }
      const { secretKey: orderSecretKey } = await getStripeRuntimeConfigForLivemode(!isSandbox, env);
      const stripeRefund = await createStripeFeeAdjustedRefund(paymentIntentId, normalizedOrderId, totalCents, env, orderSecretKey);
      if (!stripeRefund.ok) {
        return jsonResponse({ message: `Rollback aborted: ${stripeRefund.message}` }, stripeRefund.status || 502);
      }
      stripeRefundId = stripeRefund.refundId;
      stripeRefundAmountCents = stripeRefund.refundAmountCents;
    }

    await dbUnwindRefundedOrderInventory(normalizedOrderId, order, env);
    if (parseOrderBoolean(order.money_accounted)) {
      await dbReverseOrderFundsAccounting(normalizedOrderId, env);
    }
  }

  await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(normalizedOrderId).run();
  await env.DB.prepare('DELETE FROM order_events WHERE order_id = ?').bind(normalizedOrderId).run();
  await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(normalizedOrderId).run();

  return jsonResponse({
    ok: true,
    message: status === 'paid'
      ? `Order rolled back.${stripeRefundId ? ` Stripe refund issued (${formatSystemCurrency(stripeRefundAmountCents / 100)}).` : ''} Inventory restored and order deleted.`
      : 'Order rolled back and deleted.',
    isSandbox,
    stripeRefundId,
    stripeRefundAmountCents,
  });
}

export function mapAdminOrderSummary(
  row: Record<string, unknown>,
  itemCount: number,
  stripeCustomer: { name: string; email: string; phone: string } | null,
): Record<string, unknown> {
  const id = normalizeText(row.id, '');
  const orderNumber = normalizeText(row.order_number, id);
  const provider = normalizeText(row.checkout_provider, '') || (normalizeText(row.stripe_checkout_session_id, '') ? 'stripe' : 'cash');
  const status = normalizeText(row.status, 'checkout_open');
  const totalCents = Number(row.total_cents ?? 0) || 0;
  const customer = buildAdminOrderCustomer(row, stripeCustomer);
  return {
    id,
    orderNumber,
    date: normalizeText(row.paid_at ?? row.checkout_started_at ?? row.created_at, ''),
    customerName: customer.name,
    customerEmail: customer.email,
    itemTitle: normalizeText(row.item_title_snapshot, ''),
    itemCount,
    totalCents,
    paymentStatus: status,
    fulfillmentStatus: normalizeText(row.fulfillment_status ?? row.fulfillment_type, 'pickup'),
    checkoutProvider: provider,
    checkoutType: normalizeText(row.checkout_type, provider),
    checkoutMode: normalizeText(row.checkout_mode, ''),
    paymentMethodLabel: provider === 'cash' ? 'Cash' : 'Stripe',
    listingsUpdated: parseOrderBoolean(row.listings_updated),
    settled: parseOrderBoolean(row.settled),
    moneyAccounted: parseOrderBoolean(row.money_accounted),
  };
}

export function parseOrderBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeText(value, '').toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
}

export function buildAdminOrderCustomer(
  row: Record<string, unknown>,
  stripeCustomer: { name: string; email: string; phone: string } | null,
): { name: string; email: string; phone: string } {
  const name = normalizeText(
    row.customer_name ?? row.stripe_customer_name ?? row.billing_name ?? row.shipping_name,
    '',
  ) || stripeCustomer?.name || 'Customer';
  const email = normalizeText(
    row.customer_email ?? row.stripe_customer_email ?? row.billing_email ?? row.email,
    '',
  ) || stripeCustomer?.email || '';
  const phone = normalizeText(
    row.customer_phone ?? row.stripe_customer_phone ?? row.billing_phone ?? row.phone,
    '',
  ) || stripeCustomer?.phone || '';
  return { name, email, phone };
}
