import type { Env } from '../env.js';
import { jsonResponse, numberOrZero } from '../utils/misc.js';
import { normalizeText, normalizeEmailAddress } from '../utils/text.js';
import { isAssociateModeRequest } from './associate.js';
import { getStripeRuntimeConfig } from '../system/runtime.js';
import { createStripeCheckoutSession, toDisplayPaymentMethodName, resolveStripePaymentMethodLabel } from '../orders/stripe.js';
import { SHOP_BASE_PATH, ACTIVITY_BASE_URL } from '../constants.js';
import type { ShopCheckoutRequestPayload } from '../types/orders.js';
import { buildShopCheckoutDraft } from './checkout-draft.js';
import {
  dbCreateCheckoutOrder,
  dbAttachStripeCheckoutSession,
  dbCancelFailedCheckoutOrder,
  dbMarkManualCheckoutOrderPaid,
  dbGetOrderReceipt,
  dbRecordOrderEvent,
  buildOrderNumber,
} from '../orders/db.js';

export { buildShopCheckoutDraft, calculateShopCheckoutShipping } from './checkout-draft.js';
export {
  handleShopCreateTerminalPayment,
  handleShopTerminalPaymentStatus,
  handleShopTerminalPaymentCancel,
} from './checkout-terminal.js';

export async function handleShopCreateCheckoutSession(request: Request, env: Env): Promise<Response> {
  const { secretKey: stripeSecretKey, useSandbox } = await getStripeRuntimeConfig(env);
  if (!stripeSecretKey) {
    return jsonResponse({ message: 'Stripe checkout is not configured.' }, 503);
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
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  const draftResult = await buildShopCheckoutDraft(body, {
    includeInStoreOnly,
    allowTaxIncluded: includeInStoreOnly,
    allowManualDiscount: includeInStoreOnly,
  }, env);
  if (draftResult instanceof Response) {
    return draftResult;
  }
  const draft = draftResult;
  const requestedCardAmountCents = numberOrZero(body?.splitTender?.cardAmountCents);
  const isSplitTender = includeInStoreOnly && requestedCardAmountCents > 0;
  const cardAmountCents = isSplitTender ? requestedCardAmountCents : draft.totalCents;
  const cashAmountCents = isSplitTender ? Math.max(0, draft.totalCents - cardAmountCents) : 0;
  if (body?.splitTender && !includeInStoreOnly) {
    return jsonResponse({ message: 'Card + cash checkout is only available in associate mode.' }, 403);
  }
  if (isSplitTender && cardAmountCents < 100) {
    return jsonResponse({ message: 'Card amount must be at least $1.00.' }, 400);
  }
  if (isSplitTender && cardAmountCents > draft.totalCents) {
    return jsonResponse({ message: 'Card amount cannot exceed the order total.' }, 400);
  }
  const requestedPaymentMode = normalizeText(body?.paymentMode, 'standard').toLowerCase();
  if (!includeInStoreOnly && requestedPaymentMode === 'finance') {
    return jsonResponse({ message: 'Financing is available for eligible in-store purchases only.' }, 403);
  }
  const customerPaymentMode = requestedPaymentMode === 'finance'
    ? 'finance'
    : 'standard';

  const nowIso = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}${SHOP_BASE_PATH}/cart`;
  const channel = includeInStoreOnly ? 'in_store' : 'online';

  try {
    await dbCreateCheckoutOrder({
      orderId,
      orderNumber,
      status: 'checkout_open',
      channel,
      fulfillmentType,
      checkoutType: 'stripe',
      checkoutProvider: isSplitTender ? 'stripe_cash' : 'stripe',
      checkoutMode: 'hosted_checkout',
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
      isSandbox: useSandbox,
      items: draft.items,
    }, env);

    const stripeSession = await createStripeCheckoutSession({
      stripeSecretKey,
      orderId,
      orderNumber,
      successUrl,
      cancelUrl,
      items: draft.items,
      couponCode: draft.couponCode,
      discountCents: draft.discountCents,
      shippingStatus: draft.shippingStatus,
      shippingLabel: draft.shippingLabel,
      shippingCents: draft.shippingCents,
      shippingAddressRequired: draft.shippingAddressRequired,
      taxCents: draft.taxCents,
      paymentMethodMode: includeInStoreOnly ? 'associate_all' : customerPaymentMode,
      splitTender: isSplitTender
        ? {
          cardAmountCents,
          cashAmountCents,
          totalCents: draft.totalCents,
        }
        : undefined,
    });

    if (isSplitTender) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'split_tender_created',
        fromStatus: null,
        toStatus: 'checkout_open',
        source: 'associate_checkout',
        sourceId: 'stripe_cash',
        message: 'Card + cash checkout started from cart.',
        payloadJson: JSON.stringify({
          cardAmountCents,
          cashAmountCents,
          totalCents: draft.totalCents,
        }),
      }, env);
    }

    await dbAttachStripeCheckoutSession(orderId, stripeSession.id, env);

    if (!stripeSession.url) {
      throw new Error('Stripe did not return a checkout URL.');
    }

    return jsonResponse({
      orderId,
      orderNumber,
      url: stripeSession.url,
    });
  } catch (error) {
    console.error('Stripe checkout session creation failed', { error });
    await dbCancelFailedCheckoutOrder(orderId, env);
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to start checkout.',
    }, 500);
  }
}

export async function handleShopCreateCashOrder(request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Cash checkout is only available in associate mode.' }, 403);
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
  const customerFirstName = normalizeText(body?.customer?.firstName, '');
  const customerLastName = normalizeText(body?.customer?.lastName, '');
  const customerEmail = normalizeEmailAddress(body?.customer?.email);
  if (!customerFirstName) {
    return jsonResponse({ message: 'Customer first name is required.' }, 400);
  }
  if (customerFirstName.length > 80) {
    return jsonResponse({ message: 'Customer first name must be 80 characters or fewer.' }, 400);
  }
  if (!customerLastName) {
    return jsonResponse({ message: 'Customer last name is required.' }, 400);
  }
  if (customerLastName.length > 80) {
    return jsonResponse({ message: 'Customer last name must be 80 characters or fewer.' }, 400);
  }
  if (!customerEmail) {
    return jsonResponse({ message: 'A valid customer email is required.' }, 400);
  }
  const draftResult = await buildShopCheckoutDraft(body, {
    includeInStoreOnly,
    allowTaxIncluded: true,
    allowManualDiscount: true,
  }, env);
  if (draftResult instanceof Response) {
    return draftResult;
  }
  const draft = draftResult;

  const nowIso = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();
  const baseUrl = normalizeText(env.SITE_BASE_URL, ACTIVITY_BASE_URL).replace(/\/+$/, '');
  const successUrl = `${baseUrl}${SHOP_BASE_PATH}/checkout/success?order=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}${SHOP_BASE_PATH}/cart`;

  try {
    await dbCreateCheckoutOrder({
      orderId,
      orderNumber,
      status: 'checkout_open',
      channel: 'in_store',
      fulfillmentType,
      checkoutType: 'cash',
      checkoutProvider: 'cash',
      checkoutMode: 'associate_checkout',
      subtotalCents: draft.subtotalCents,
      discountCents: draft.discountCents,
      couponCode: draft.couponCode,
      shippingStatus: draft.shippingStatus,
      shippingLabel: draft.shippingLabel,
      shippingCents: draft.shippingCents,
      shippingTaxCents: draft.shippingTaxCents,
      taxCents: draft.taxCents,
      totalCents: draft.totalCents,
      successUrl,
      cancelUrl,
      createdAt: nowIso,
      customerName: `${customerFirstName} ${customerLastName}`,
      customerEmail,
      items: draft.items,
    }, env);

    await dbMarkManualCheckoutOrderPaid(orderId, {
      provider: 'cash',
      paidAt: nowIso,
      taxIncluded: draft.taxIncluded,
      items: draft.items.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        subtotalCents: item.unitAmountCents * item.quantity,
      })),
    }, env);

    return jsonResponse({
      orderId,
      orderNumber,
      url: successUrl,
    });
  } catch (error) {
    console.error('Cash checkout order creation failed', { error });
    await dbCancelFailedCheckoutOrder(orderId, env);
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to record cash checkout.',
    }, 500);
  }
}

export async function handleShopOrderReceipt(orderId: string, request: Request, env: Env): Promise<Response> {
  const includeInStoreOnly = await isAssociateModeRequest(request, env);
  if (!includeInStoreOnly) {
    return jsonResponse({ message: 'Order receipt is only available in associate mode.' }, 403);
  }

  const normalizedOrderId = normalizeText(orderId, '').slice(0, 100);
  if (!normalizedOrderId) return jsonResponse({ message: 'Order not found.' }, 404);

  const order = await dbGetOrderReceipt(normalizedOrderId, env);
  if (!order) return jsonResponse({ message: 'Order not found.' }, 404);

  const checkoutProvider = normalizeText(order.checkoutProvider, '');
  const paymentMethodLabel = checkoutProvider === 'stripe_cash'
    ? 'Card + cash'
    : checkoutProvider === 'stripe'
      ? await resolveStripePaymentMethodLabel(normalizeText(order.stripePaymentIntentId, ''), env)
      : checkoutProvider === 'cash'
        ? 'Paid by cash'
        : `Payment method: ${toDisplayPaymentMethodName(checkoutProvider || 'Stripe')}`;

  return jsonResponse({
    record: {
      ...order,
      paymentMethodLabel,
    },
  });
}
