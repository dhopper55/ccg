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

// Logs every verified webhook delivery to stripe_webhook_events so a gap (e.g. no live
// endpoint registered, or every delivery erroring) shows up as an empty/red table instead
// of being invisible until a customer calls. Best-effort — a logging failure must never
// block actual order processing.
async function recordStripeWebhookEvent(
  rowId: string,
  event: any,
  orderId: string,
  payload: string,
  isSandbox: boolean,
  env: Env,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO stripe_webhook_events (id, stripe_event_id, event_type, order_id, payload_json, status, is_sandbox, received_at)
       VALUES (?, ?, ?, ?, ?, 'received', ?, ?)`,
    ).bind(
      rowId,
      normalizeText(event?.id, ''),
      normalizeText(event?.type, ''),
      orderId || null,
      payload,
      isSandbox ? 1 : 0,
      new Date().toISOString(),
    ).run();
  } catch (error) {
    console.warn('Failed to record stripe_webhook_events row', { rowId, error });
  }
}

async function finalizeStripeWebhookEvent(
  rowId: string,
  status: 'processed' | 'ignored' | 'error',
  errorMessage: string,
  env: Env,
): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE stripe_webhook_events SET status = ?, error_message = ?, processed_at = ? WHERE id = ?`,
    ).bind(status, errorMessage || null, new Date().toISOString(), rowId).run();
  } catch (error) {
    console.warn('Failed to finalize stripe_webhook_events row', { rowId, error });
  }
}

export async function handleStripeWebhook(request: Request, env: Env, isSandbox = false): Promise<Response> {
  const webhookSecret = normalizeText(
    isSandbox ? env.STRIPE_WEBHOOK_SECRET_SANDBOX : env.STRIPE_WEBHOOK_SECRET,
    '',
  );
  if (!webhookSecret) {
    return jsonResponse({ message: `Stripe ${isSandbox ? 'sandbox ' : ''}webhook is not configured.` }, 503);
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

  const webhookEventRowId = crypto.randomUUID();
  await recordStripeWebhookEvent(webhookEventRowId, event, orderId, payload, isSandbox, env);

  try {
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
        await finalizeStripeWebhookEvent(webhookEventRowId, 'processed', '', env);
        return jsonResponse({ received: true, orderId: paymentLinkOrderId });
      }
    } else if (!orderId) {
      await finalizeStripeWebhookEvent(webhookEventRowId, 'ignored', 'No order_id metadata.', env);
      return jsonResponse({ received: true, ignored: true, message: 'No order_id metadata.' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Stripe webhook processing failed', {
      eventType,
      orderId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    await finalizeStripeWebhookEvent(webhookEventRowId, 'error', errorMessage, env);
    return jsonResponse({ error: 'Webhook processing failed.' }, 500);
  }

  await finalizeStripeWebhookEvent(webhookEventRowId, 'processed', '', env);
  return jsonResponse({ received: true });
}
