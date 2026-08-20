import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';

import { normalizeEmailAddress } from '../utils/text.js';
import { numberOrZero } from '../utils/misc.js';
import { formatPlainDollarAmount, formatCurrencyCents } from '../utils/money.js';
import { getBrevoRuntimeConfig, getStripeRuntimeConfig } from '../system/runtime.js';
import type { BrevoRuntimeConfig } from '../system/runtime.js';
import { toDisplayPaymentMethodName } from './stripe.js';
import { dbGetOrderReceipt, dbRecordOrderEvent } from './db.js';

export const ADMIN_BCC_RECIPIENT = {
  email: 'david@coalcreekguitars.com',
  name: 'David Hopper',
};

export async function handleAdminV2OrderConfirmationEmailTest(env: Env): Promise<Response> {
  const config = await getBrevoRuntimeConfig(env);
  if (!config.apiKey) {
    return jsonResponse({ message: 'Brevo API key is not configured in sys_info.' }, 503);
  }
  if (!config.senderEmail) {
    return jsonResponse({ message: 'Brevo sender email is not configured in sys_info.' }, 503);
  }

  try {
    const result = await sendBrevoOrderConfirmationTestEmail(config);
    return jsonResponse({
      ok: true,
      message: 'Brevo test order confirmation email sent.',
      result,
    });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to send Brevo test email.',
    }, 502);
  }
}

export async function sendBrevoOrderConfirmationTestEmail(
  config: BrevoRuntimeConfig,
): Promise<Record<string, unknown>> {
  const payload = {
    sender: {
      name: config.senderName,
      email: config.senderEmail,
    },
    to: [
      {
        email: 'davidhopper55@gmail.com',
        name: 'John Doe',
      },
    ],
    templateId: config.templateId,
    contact: {
      ORDER_NUMBER: 'CCG-TEST-1001',
      ORDER_DATE: '2026-05-06',
      FIRST_NAME: 'John',
    },
    params: {
      ORDER_DATE: '2026-05-01',
      ORDER_NUMBER: 'CCG-TEST-1001',
      FIRSTNAME: 'John',
      FIRST_NAME: 'John',
      discount: '$20.00',
      subtotal: '$249.99',
      tax: '$18.75',
      total: '$248.74',
      items: [
        {
          name: 'Acoustic Guitar',
          category: 'Musical Instruments',
          sku: 'GTR-001',
          price: '199.99',
          quantity: 1,
          image: 'https://example.com/images/guitar.jpg',
        },
        {
          name: 'Guitar Strings Pack',
          category: 'Accessories',
          sku: 'STR-123',
          price: '9.99',
          quantity: 2,
          image: 'https://example.com/images/strings.jpg',
        },
      ],
    },
    headers: {
      'X-Mailin-custom': 'order-confirmation',
    },
  };

  return sendBrevoTransactionalEmail(config, payload);
}

export async function sendBrevoTransactionalEmail(
  config: BrevoRuntimeConfig,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json<Record<string, unknown>>().catch(() => ({}));
  if (!response.ok) {
    throw new Error(normalizeText(
      (data as any)?.message ?? (data as any)?.error ?? '',
      `Brevo rejected the email request with status ${response.status}.`,
    ));
  }
  return data;
}

export type BrevoEmailDeliveryStatus = 'Delivered' | 'Un-Delivered' | 'N/A';

// Bounce/reject-type events treated as a definitive delivery failure. softBounces are
// deliberately excluded — a soft bounce (full mailbox, temporary server issue) can still
// resolve to delivered later and isn't a reliable "bad address" signal within a short window.
const BREVO_DEFINITIVE_FAILURE_EVENTS = new Set(['hardBounces', 'bounces', 'blocked', 'invalid', 'error']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls Brevo's event report for a specific sent message, looking for a definitive
// delivered/bounced signal. Not a general delivery guarantee — this only catches what
// resolves within the polling window (typically immediate hard bounces / fast delivery
// confirmations); anything still unresolved when time runs out comes back as 'N/A'.
export async function pollBrevoEmailDeliveryStatus(
  config: BrevoRuntimeConfig,
  messageId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<BrevoEmailDeliveryStatus> {
  const intervalMs = options.intervalMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 60000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const url = `https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(messageId)}&days=1&limit=50`;
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'api-key': config.apiKey },
      });
      if (response.ok) {
        const data = await response.json<unknown>().catch(() => null);
        const events: Array<{ event?: string }> = Array.isArray(data)
          ? (data as Array<{ event?: string }>)
          : Array.isArray((data as any)?.events)
            ? (data as any).events
            : [];
        if (events.some((e) => e.event === 'delivered')) return 'Delivered';
        if (events.some((e) => e.event && BREVO_DEFINITIVE_FAILURE_EVENTS.has(e.event))) return 'Un-Delivered';
      }
    } catch {
      // transient error — next tick retries
    }
    await sleep(intervalMs);
  }
  return 'N/A';
}

export async function sendBrevoOrderConfirmationEmailForOrder(orderId: string, env: Env): Promise<void> {
  try {
    const config = await getBrevoRuntimeConfig(env);
    if (!config.apiKey || !config.senderEmail) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'order_confirmation_email_skipped',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: 'Order confirmation email skipped because Brevo is not configured.',
        payloadJson: JSON.stringify({
          hasApiKey: Boolean(config.apiKey),
          hasSenderEmail: Boolean(config.senderEmail),
        }),
      }, env);
      return;
    }

    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
      .bind(orderId)
      .first<Record<string, unknown>>();
    const receipt = await dbGetOrderReceipt(orderId, env);
    if (!order || !receipt) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'order_confirmation_email_skipped',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: 'Order confirmation email skipped because order data was not found.',
        payloadJson: '{}',
      }, env);
      return;
    }

    const customerEmail = normalizeEmailAddress(
      order.customer_email ?? order.stripe_customer_email ?? order.email,
    );
    if (!customerEmail) {
      await dbRecordOrderEvent(orderId, {
        eventType: 'order_confirmation_email_skipped',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: 'Order confirmation email skipped because customer email is missing.',
        payloadJson: '{}',
      }, env);
      return;
    }

    const customerName = normalizeText(
      order.customer_name ?? order.stripe_customer_name ?? order.billing_name ?? '',
      '',
    );
    const firstName = customerName.split(/\s+/).filter(Boolean)[0] || 'there';
    const orderNumber = normalizeText(receipt.orderNumber, normalizeText(order.order_number, orderId));
    const orderDate = formatBrevoOrderDate(
      normalizeText(receipt.paidAt, '') ||
      normalizeText(order.paid_at ?? order.updated_at ?? order.created_at, ''),
    );
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const paidBy = await resolveOrderPaidByLabel(order, receipt, env);
    const payload = {
      sender: {
        name: config.senderName,
        email: config.senderEmail,
      },
      to: [
        {
          email: customerEmail,
          name: customerName || customerEmail,
        },
      ],
      bcc: [ADMIN_BCC_RECIPIENT],
      templateId: config.templateId,
      params: {
        ORDER_NUMBER: orderNumber,
        ORDER_DATE: orderDate,
        FIRSTNAME: firstName,
        FIRST_NAME: firstName,
        discount: formatCurrencyCents(numberOrZero(receipt.discountCents)),
        subtotal: formatCurrencyCents(numberOrZero(receipt.subtotalCents)),
        shipping: normalizeText((receipt as any).shippingLabel, '') || formatCurrencyCents(numberOrZero((receipt as any).shippingCents)),
        tax: formatCurrencyCents(numberOrZero(receipt.taxCents)),
        total: formatCurrencyCents(numberOrZero(receipt.totalCents)),
        paidBy,
        paymentMethod: paidBy,
        PAID_BY: paidBy,
        PAYMENT_METHOD: paidBy,
        items: items.map((item: any) => {
          const quantity = Math.max(1, Number(item.quantity || 1));
          const lineSubtotalCents = numberOrZero(item.subtotalCents);
          const unitAmountCents = quantity > 0 ? Math.round(lineSubtotalCents / quantity) : lineSubtotalCents;
          return {
            name: normalizeText(item.title, 'Item'),
            category: 'Musical Instruments',
            sku: normalizeText(item.ccgNumber, ''),
            price: formatPlainDollarAmount(unitAmountCents),
            quantity,
            image: normalizeText(item.imageUrl, ''),
          };
        }),
      },
      headers: {
        'X-Mailin-custom': `order-confirmation|order:${orderNumber}`,
      },
    };

    const result = await sendBrevoTransactionalEmail(config, payload);
    await dbRecordOrderEvent(orderId, {
      eventType: 'order_confirmation_email_sent',
      fromStatus: null,
      toStatus: 'paid',
      source: 'brevo',
      sourceId: normalizeText((result as any)?.messageId, ''),
      message: 'Order confirmation email sent to customer.',
      payloadJson: JSON.stringify({
        customerEmail,
        orderNumber,
        result,
      }),
    }, env);

    try {
      const [firstName, ...lastNameParts] = customerName.split(/\s+/).filter(Boolean);
      await upsertBrevoMailingListContact(customerEmail, config, {
        FIRSTNAME: firstName || undefined,
        LASTNAME: lastNameParts.join(' ') || undefined,
      });
      await dbRecordOrderEvent(orderId, {
        eventType: 'brevo_contact_list_add_succeeded',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: 'Customer added to Brevo mailing list.',
        payloadJson: JSON.stringify({ customerEmail, listId: BREVO_MARKETING_LIST_ID }),
      }, env);
    } catch (error) {
      console.warn('Adding order customer to Brevo mailing list failed', { orderId, error });
      await dbRecordOrderEvent(orderId, {
        eventType: 'brevo_contact_list_add_failed',
        fromStatus: null,
        toStatus: 'paid',
        source: 'brevo',
        sourceId: '',
        message: error instanceof Error ? error.message : 'Unable to add customer to Brevo mailing list.',
        payloadJson: JSON.stringify({ customerEmail }),
      }, env);
    }
  } catch (error) {
    console.warn('Order confirmation email failed', { orderId, error });
    await dbRecordOrderEvent(orderId, {
      eventType: 'order_confirmation_email_failed',
      fromStatus: null,
      toStatus: 'paid',
      source: 'brevo',
      sourceId: '',
      message: error instanceof Error ? error.message : 'Unable to send order confirmation email.',
      payloadJson: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    }, env);
  }
}

// ---------------------------------------------------------------------------
// Marketing subscribe
// ---------------------------------------------------------------------------

const BREVO_MARKETING_LIST_ID = 4;

export async function upsertBrevoMailingListContact(
  email: string,
  config: BrevoRuntimeConfig,
  attributes?: Record<string, unknown>,
): Promise<void> {
  const cleanedAttributes = attributes
    ? Object.fromEntries(Object.entries(attributes).filter(([, v]) => v !== undefined && v !== ''))
    : undefined;

  const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      listIds: [BREVO_MARKETING_LIST_ID],
      updateEnabled: true,
      ...(cleanedAttributes && Object.keys(cleanedAttributes).length > 0 ? { attributes: cleanedAttributes } : {}),
    }),
  });
  if (!contactRes.ok) {
    const err = await contactRes.json<{ message?: string }>().catch(() => ({}));
    throw new Error(normalizeText(err?.message, `Brevo contact upsert failed with status ${contactRes.status}.`));
  }
}

export async function handlePublicEmailSignup(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ email?: unknown }>().catch(() => ({}));
  const email = normalizeEmailAddress(body?.email);
  if (!email) {
    return jsonResponse({ message: 'A valid email address is required.' }, 400);
  }

  const config = await getBrevoRuntimeConfig(env);
  if (!config.apiKey) {
    return jsonResponse({ message: 'Email signup is temporarily unavailable.' }, 503);
  }

  try {
    await upsertBrevoMailingListContact(email, config);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Signup failed. Please try again.';
    return jsonResponse({ message: msg }, 502);
  }

  return jsonResponse({ ok: true, email });
}

export async function handleAdminV2BrevoMarketingSubscribe(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ email?: unknown }>().catch(() => ({}));
  const email = normalizeEmailAddress(body?.email);
  if (!email) {
    return jsonResponse({ message: 'A valid email address is required.' }, 400);
  }

  const config = await getBrevoRuntimeConfig(env);
  if (!config.apiKey) {
    return jsonResponse({ message: 'Brevo API key is not configured in sys_info.' }, 503);
  }
  if (!config.senderEmail) {
    return jsonResponse({ message: 'Brevo sender email is not configured in sys_info.' }, 503);
  }

  try {
    await upsertBrevoMailingListContact(email, config);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Brevo contact upsert failed.';
    return jsonResponse({ message: msg }, 502);
  }

  return jsonResponse({ ok: true, email });
}

export function formatBrevoOrderDate(value: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || new Date().toISOString().slice(0, 10);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Denver',
  });
}

// ---------------------------------------------------------------------------
// Paid-by label resolution
// ---------------------------------------------------------------------------

export async function resolveOrderPaidByLabel(
  order: Record<string, unknown>,
  receipt: Record<string, unknown>,
  env: Env,
): Promise<string> {
  const provider = normalizeText(order.checkout_provider, normalizeText(receipt.checkoutProvider, ''));
  if (provider === 'cash') return 'Cash';
  if (provider === 'stripe_cash') return 'Card + Cash';

  const paymentIntentId = normalizeText(
    order.stripe_payment_intent_id,
    normalizeText(receipt.stripePaymentIntentId, ''),
  );
  if (paymentIntentId) {
    return resolveStripePaidByLabel(paymentIntentId, env);
  }

  return provider
    ? toDisplayPaymentMethodName(provider)
    : 'Stripe';
}

async function resolveStripePaidByLabel(paymentIntentId: string, env: Env): Promise<string> {
  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  const id = normalizeText(paymentIntentId, '');
  if (!stripeSecretKey || !id) return 'Stripe';

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}?expand[]=latest_charge`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );
    const data = await response.json<any>();
    if (!response.ok) {
      console.warn('Stripe paid-by lookup failed', { paymentIntentId: id, status: response.status });
      return 'Stripe';
    }

    const details = data?.latest_charge?.payment_method_details;
    const type = normalizeText(details?.type, normalizeText(data?.payment_method_types?.[0], 'stripe')).toLowerCase();
    if (type === 'card') {
      const last4 = normalizeText(details?.card?.last4, '');
      return last4 ? `Credit Card XXXX-${last4}` : 'Credit Card';
    }
    if (type === 'card_present') {
      const last4 = normalizeText(details?.card_present?.last4, '');
      return last4 ? `Credit Card XXXX-${last4}` : 'Credit Card';
    }
    if (type === 'affirm') return 'Affirm financing';
    if (type === 'klarna') return 'Klarna financing';
    if (type === 'cashapp') return 'Cash App Pay';
    if (type === 'us_bank_account') return 'Bank account';
    return toDisplayPaymentMethodName(type || 'Stripe');
  } catch (error) {
    console.warn('Stripe paid-by lookup failed', { paymentIntentId: id, error });
    return 'Stripe';
  }
}
