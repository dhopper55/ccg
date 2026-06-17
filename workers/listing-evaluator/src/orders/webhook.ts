import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';

import { verifyStripeWebhookSignature } from './stripe.js';
import {
  dbMarkStripeCheckoutOrderPaid,
  dbUpdateStripeOrderStatus,
  dbReleaseStripeCheckoutOrder,
  dbEnsurePaymentLinkCheckoutOrder,
} from './db.js';

function isAdminPaymentLinkCheckoutSession(session: any): boolean {
  return Boolean(
    normalizeText(session?.payment_link, '')
    || normalizeText(session?.metadata?.source, '') === 'admin_v2_marked_inventory'
    || normalizeText(session?.metadata?.inventory_item_ids, ''),
  );
}

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const webhookSecret = normalizeText(env.STRIPE_WEBHOOK_SECRET, '');
  if (!webhookSecret) {
    return jsonResponse({ message: 'Stripe webhook is not configured.' }, 503);
  }

  const signature = normalizeText(request.headers.get('Stripe-Signature'), '');
  const payload = await request.text();
  const verified = await verifyStripeWebhookSignature(payload, signature, webhookSecret);
  if (!verified) {
    return jsonResponse({ message: 'Invalid Stripe webhook signature.' }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResponse({ message: 'Invalid Stripe webhook payload.' }, 400);
  }

  const eventType = normalizeText(event?.type, '');
  const session = event?.data?.object;
  const orderId = normalizeText(session?.metadata?.order_id, '') || normalizeText(session?.client_reference_id, '');

  if (orderId && eventType === 'checkout.session.completed') {
    if (normalizeText(session?.payment_status, '') === 'paid') {
      await dbMarkStripeCheckoutOrderPaid(orderId, session, env);
    } else {
      await dbUpdateStripeOrderStatus(orderId, 'payment_processing', session, env);
    }
  } else if (orderId && eventType === 'checkout.session.async_payment_succeeded') {
    await dbMarkStripeCheckoutOrderPaid(orderId, session, env);
  } else if (orderId && eventType === 'checkout.session.async_payment_failed') {
    await dbReleaseStripeCheckoutOrder(orderId, 'payment_failed', session, env);
  } else if (orderId && eventType === 'checkout.session.expired') {
    await dbReleaseStripeCheckoutOrder(orderId, 'expired', session, env);
  } else if (isAdminPaymentLinkCheckoutSession(session)) {
    if (
      (eventType === 'checkout.session.completed' && normalizeText(session?.payment_status, '') === 'paid')
      || eventType === 'checkout.session.async_payment_succeeded'
    ) {
      const paymentLinkOrderId = await dbEnsurePaymentLinkCheckoutOrder(session, event, env);
      await dbMarkStripeCheckoutOrderPaid(paymentLinkOrderId, session, env);
      return jsonResponse({ received: true, orderId: paymentLinkOrderId });
    }
  } else if (!orderId) {
    return jsonResponse({ received: true, ignored: true, message: 'No order_id metadata.' });
  }

  return jsonResponse({ received: true });
}
