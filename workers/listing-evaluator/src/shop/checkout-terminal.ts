import type { Env } from '../env.js';
import { jsonResponse, numberOrZero } from '../utils/misc.js';
import { normalizeText, normalizeEmailAddress } from '../utils/text.js';
import { isAssociateModeRequest } from './associate.js';
import { getStripeRuntimeConfig } from '../system/runtime.js';
import {
  createStripeTerminalPaymentIntent,
  processStripeTerminalPaymentIntent,
  resolveStripeTerminalReader,
  cancelStripeTerminalReaderAction,
  cancelStripePaymentIntent,
  retrieveStripePaymentIntent,
} from '../orders/stripe.js';
import { SHOP_BASE_PATH, ACTIVITY_BASE_URL } from '../constants.js';
import type { ShopCheckoutRequestPayload } from '../types/orders.js';
import { buildShopCheckoutDraft } from './checkout-draft.js';

import {
  dbCreateCheckoutOrder,
  dbCancelFailedCheckoutOrder,
  dbMarkTerminalCheckoutOrderPaid,
  dbGetOrderById,
  dbRecordOrderEvent,
  dbUpdateTableById,
  buildOrderNumber,
} from '../orders/db.js';

export async function handleShopCreateTerminalPayment(request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Terminal checkout is only available in associate mode.' }, 403);
  }

  const stripeConfig = await getStripeRuntimeConfig(env);
  const stripeSecretKey = stripeConfig.secretKey;
  if (!stripeSecretKey) {
    return jsonResponse({ message: 'Stripe Terminal is not configured.' }, 503);
  }

  let body: ShopCheckoutRequestPayload;
  try {
    body = await request.json<ShopCheckoutRequestPayload>();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const fulfillmentType = normalizeText(body?.fulfillmentType, 'pickup') === 'pickup'
    ? 'pickup'
    : 'pickup';
  const draftResult = await buildShopCheckoutDraft(body, {
    includeInStoreOnly,
    allowTaxIncluded: true,
    allowManualDiscount: true,
  }, env);
  if (draftResult instanceof Response) {
    return draftResult;
  }
  const draft = draftResult;
  const requestedCardAmountCents = numberOrZero(body?.splitTender?.cardAmountCents);
  const isSplitTender = requestedCardAmountCents > 0;
  const cardAmountCents = isSplitTender ? requestedCardAmountCents : draft.totalCents;
  const cashAmountCents = isSplitTender ? Math.max(0, draft.totalCents - cardAmountCents) : 0;
  if (isSplitTender && cardAmountCents < 100) {
    return jsonResponse({ message: 'Card amount must be at least $1.00.' }, 400);
  }
  if (isSplitTender && cardAmountCents > draft.totalCents) {
    return jsonResponse({ message: 'Card amount cannot exceed the order total.' }, 400);
  }

  const readerResult = await resolveStripeTerminalReader({
    stripeSecretKey,
    requestedReaderId: normalizeText(body?.readerId, ''),
    useSandbox: stripeConfig.useSandbox,
    env,
  });
  if (!readerResult.ok) {
    return jsonResponse({ message: readerResult.message }, readerResult.status);
  }

  const nowIso = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}${SHOP_BASE_PATH}/cart`;
  const checkoutProvider = isSplitTender ? 'stripe_terminal_cash' : 'stripe_terminal';

  try {
    const terminalCustomerFirstName = normalizeText(body?.customer?.firstName, '');
    const terminalCustomerLastName = normalizeText(body?.customer?.lastName, '');
    const terminalCustomerEmail = normalizeEmailAddress(body?.customer?.email);
    const terminalCustomerName = [terminalCustomerFirstName, terminalCustomerLastName].filter(Boolean).join(' ');

    await dbCreateCheckoutOrder({
      orderId,
      orderNumber,
      status: 'checkout_open',
      channel: 'in_store',
      fulfillmentType,
      checkoutType: 'stripe',
      checkoutProvider,
      checkoutMode: 'terminal_reader',
      subtotalCents: draft.subtotalCents,
      discountCents: draft.discountCents,
      couponCode: draft.couponCode,
      shippingStatus: draft.shippingStatus,
      shippingLabel: draft.shippingLabel,
      shippingCents: draft.shippingCents,
      shippingTaxCents: draft.shippingTaxCents,
      taxCents: draft.taxCents,
      totalCents: draft.totalCents,
      cardAmountCents: isSplitTender ? cardAmountCents : null,
      cashAmountCents: isSplitTender ? cashAmountCents : null,
      successUrl,
      cancelUrl,
      createdAt: nowIso,
      customerName: terminalCustomerName,
      customerEmail: terminalCustomerEmail,
      isSandbox: stripeConfig.useSandbox,
      items: draft.items,
    }, env);

    const paymentIntent = await createStripeTerminalPaymentIntent({
      stripeSecretKey,
      orderId,
      orderNumber,
      amountCents: cardAmountCents,
      totalCents: draft.totalCents,
      cardAmountCents,
      cashAmountCents,
      discountCents: draft.discountCents,
      taxCents: draft.taxCents,
      shippingStatus: draft.shippingStatus,
      shippingLabel: draft.shippingLabel,
      shippingCents: draft.shippingCents,
      checkoutProvider,
      items: draft.items,
    });

    await dbUpdateTableById('orders', orderId, {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_payment_status: normalizeText(paymentIntent.status, 'requires_payment_method'),
      updated_at: new Date().toISOString(),
    }, env);

    const readerAction = await processStripeTerminalPaymentIntent({
      stripeSecretKey,
      readerId: readerResult.reader.id,
      paymentIntentId: paymentIntent.id,
      orderId,
    });

    await dbRecordOrderEvent(orderId, {
      eventType: 'terminal_payment_started',
      fromStatus: null,
      toStatus: 'checkout_open',
      source: 'associate_checkout',
      sourceId: readerResult.reader.id,
      message: 'Stripe Terminal payment sent to reader.',
      payloadJson: JSON.stringify({
        readerId: readerResult.reader.id,
        readerLabel: readerResult.reader.label,
        paymentIntentId: paymentIntent.id,
        readerAction,
        cardAmountCents,
        cashAmountCents,
        totalCents: draft.totalCents,
      }),
    }, env);

    return jsonResponse({
      orderId,
      orderNumber,
      successUrl,
      paymentIntentId: paymentIntent.id,
      readerId: readerResult.reader.id,
      readerLabel: readerResult.reader.label,
      status: 'waiting',
    });
  } catch (error) {
    console.error('Stripe Terminal payment start failed', { error });
    await dbCancelFailedCheckoutOrder(orderId, env);
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to start terminal payment.',
    }, 500);
  }
}

export async function handleShopTerminalPaymentStatus(orderId: string, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Terminal checkout is only available in associate mode.' }, 403);
  }

  const normalizedOrderId = normalizeText(orderId, '');
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await dbGetOrderById(normalizedOrderId, env);
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const successUrl = normalizeText(order.success_url, `${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(normalizedOrderId)}`);
  const currentStatus = normalizeText(order.status, '');
  if (currentStatus === 'paid') {
    return jsonResponse({ status: 'succeeded', successUrl });
  }
  if (currentStatus === 'cancelled' || currentStatus === 'canceled') {
    return jsonResponse({ status: 'failed', message: 'Terminal payment was cancelled.', successUrl });
  }

  const paymentIntentId = normalizeText(order.stripe_payment_intent_id, '');
  if (!paymentIntentId) {
    return jsonResponse({ status: 'failed', message: 'Order is missing a terminal payment intent.' }, 409);
  }

  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  if (!stripeSecretKey) {
    return jsonResponse({ message: 'Stripe Terminal is not configured.' }, 503);
  }

  const paymentIntent = await retrieveStripePaymentIntent(stripeSecretKey, paymentIntentId);
  const paymentStatus = normalizeText(paymentIntent?.status, '');
  await dbUpdateTableById('orders', normalizedOrderId, {
    stripe_payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }, env);

  if (paymentStatus === 'succeeded') {
    await dbMarkTerminalCheckoutOrderPaid(normalizedOrderId, paymentIntent, env);
    return jsonResponse({ status: 'succeeded', successUrl });
  }

  if (paymentStatus === 'canceled') {
    await dbCancelFailedCheckoutOrder(normalizedOrderId, env);
    return jsonResponse({
      status: 'failed',
      message: 'Terminal payment was cancelled.',
      successUrl,
    });
  }

  const stripeConfig = await getStripeRuntimeConfig(env);
  const readerResult = stripeConfig.secretKey
    ? await resolveStripeTerminalReader({
      stripeSecretKey: stripeConfig.secretKey,
      requestedReaderId: '',
      useSandbox: stripeConfig.useSandbox,
      env,
    })
    : null;
  const readerAction = readerResult?.ok ? readerResult.reader.action : null;
  const actionPaymentIntent = normalizeText(
    readerAction?.process_payment_intent?.payment_intent ?? readerAction?.payment_intent,
    '',
  );
  const actionStatus = normalizeText(readerAction?.status, '');
  if ((!actionPaymentIntent || actionPaymentIntent === paymentIntentId) && actionStatus === 'failed') {
    await dbCancelFailedCheckoutOrder(normalizedOrderId, env);
    return jsonResponse({
      status: 'failed',
      message: normalizeText(readerAction?.failure_message, 'Terminal payment failed.'),
      successUrl,
    });
  }

  return jsonResponse({
    status: 'waiting',
    paymentStatus,
    readerActionStatus: actionStatus,
    successUrl,
  });
}

export async function handleShopTerminalPaymentCancel(orderId: string, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Terminal checkout is only available in associate mode.' }, 403);
  }

  const normalizedOrderId = normalizeText(orderId, '');
  const order = normalizedOrderId ? await dbGetOrderById(normalizedOrderId, env) : null;
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const currentStatus = normalizeText(order.status, '');
  if (currentStatus === 'paid') {
    return jsonResponse({ message: 'This order is already paid.' }, 409);
  }

  const stripeConfig = await getStripeRuntimeConfig(env);
  if (!stripeConfig.secretKey) {
    return jsonResponse({ message: 'Stripe Terminal is not configured.' }, 503);
  }

  let readerId = '';
  try {
    const readerResult = await resolveStripeTerminalReader({
      stripeSecretKey: stripeConfig.secretKey,
      requestedReaderId: '',
      useSandbox: stripeConfig.useSandbox,
      env,
    });
    if (readerResult.ok) {
      readerId = readerResult.reader.id;
      await cancelStripeTerminalReaderAction(stripeConfig.secretKey, readerResult.reader.id);
    }
  } catch (error) {
    console.warn('Terminal reader cancel failed; proceeding with order cancel', { orderId, error });
  }

  const paymentIntentId = normalizeText(order.stripe_payment_intent_id, '');
  if (paymentIntentId) {
    await cancelStripePaymentIntent(stripeConfig.secretKey, paymentIntentId);
  }

  await dbCancelFailedCheckoutOrder(normalizedOrderId, env);
  await dbRecordOrderEvent(normalizedOrderId, {
    eventType: 'terminal_payment_cancelled',
    fromStatus: currentStatus || null,
    toStatus: 'cancelled',
    source: 'associate_checkout',
    sourceId: readerId,
    message: 'Stripe Terminal payment cancelled from cart.',
    payloadJson: JSON.stringify({ paymentIntentId }),
  }, env);

  return jsonResponse({ ok: true });
}
