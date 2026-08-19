import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { buildAdminOrderCustomer } from './handlers.js';
import { getStripeRuntimeConfig } from '../system/runtime.js';

export function toDisplayPaymentMethodName(input: unknown): string {
  const normalized = normalizeText(input, '').replace(/_/g, ' ').trim();
  if (!normalized) return 'Stripe';
  const lower = normalized.toLowerCase();
  if (lower === 'amex') return 'American Express';
  if (lower === 'afterpay clearpay') return 'Afterpay/Clearpay';
  return lower.replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);
  if (!timestamp || signatures.length === 0) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const expected = bytesToHex(new Uint8Array(digest));
  return signatures.some((signature) => timingSafeEqualHex(signature, expected));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function resolveStripePaymentMethodLabel(paymentIntentId: string, env: Env): Promise<string> {
  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  const id = normalizeText(paymentIntentId, '');
  if (!stripeSecretKey || !id) return 'Payment method: Stripe';

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
      console.warn('Stripe payment method lookup failed', { paymentIntentId: id, status: response.status });
      return 'Payment method: Stripe';
    }

    const details = data?.latest_charge?.payment_method_details;
    const type = normalizeText(details?.type, normalizeText(data?.payment_method_types?.[0], 'stripe'));
    if (type === 'card') {
      const brand = toDisplayPaymentMethodName(details?.card?.brand || 'Card');
      const last4 = normalizeText(details?.card?.last4, '');
      return last4 ? `${brand} XXXX XXXX XXXX ${last4}` : brand;
    }
    return `Payment method: ${toDisplayPaymentMethodName(type)}`;
  } catch (error) {
    console.warn('Stripe payment method lookup failed', { paymentIntentId: id, error });
    return 'Payment method: Stripe';
  }
}

export async function createStripeAmountOffCoupon(input: {
  stripeSecretKey: string;
  orderId: string;
  orderNumber: string;
  couponCode: string | null;
  amountOffCents: number;
}): Promise<string> {
  const form = new URLSearchParams();
  form.set('amount_off', String(input.amountOffCents));
  form.set('currency', 'usd');
  form.set('duration', 'once');
  form.set('name', input.couponCode || `Discount for ${input.orderNumber}`);
  form.set('metadata[order_id]', input.orderId);
  form.set('metadata[order_number]', input.orderNumber);
  if (input.couponCode) {
    form.set('metadata[coupon_code]', input.couponCode);
  }

  const response = await fetch('https://api.stripe.com/v1/coupons', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the discount request.'));
  }
  const id = normalizeText(data?.id, '');
  if (!id) throw new Error('Stripe did not return a discount coupon.');
  return id;
}

export async function fetchStripeCheckoutSession(
  sessionId: string,
  stripeSecretKey: string,
  expand: string[] = [],
): Promise<any | null> {
  if (!stripeSecretKey || !sessionId) return null;
  try {
    const query = expand.length > 0
      ? `?${expand.map((field) => `expand[]=${encodeURIComponent(field)}`).join('&')}`
      : '';
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}${query}`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
    );
    const data = await response.json<any>();
    if (!response.ok) return null;
    return data;
  } catch (error) {
    console.warn('Stripe checkout session lookup failed', { sessionId, error });
    return null;
  }
}

export async function resolveOrderStripeCustomer(
  row: Record<string, unknown>,
  env: Env,
): Promise<{ name: string; email: string; phone: string } | null> {
  const localCustomer = buildAdminOrderCustomer(row, null);
  if (localCustomer.email || localCustomer.name !== 'Customer') return localCustomer;

  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  const sessionId = normalizeText(row.stripe_checkout_session_id, '');
  const data = await fetchStripeCheckoutSession(sessionId, stripeSecretKey);
  if (!data) return null;
  return {
    name: normalizeText(data?.customer_details?.name, ''),
    email: normalizeText(data?.customer_details?.email, ''),
    phone: normalizeText(data?.customer_details?.phone, ''),
  };
}

export async function createStripeCheckoutSession(input: {
  stripeSecretKey: string;
  orderId: string;
  orderNumber: string;
  successUrl: string;
  cancelUrl: string;
  couponCode: string | null;
  discountCents: number;
  shippingStatus: string;
  shippingLabel: string;
  shippingCents: number;
  shippingAddressRequired: boolean;
  taxCents: number;
  paymentMethodMode: 'standard' | 'finance' | 'associate_all';
  splitTender?: {
    cardAmountCents: number;
    cashAmountCents: number;
    totalCents: number;
  };
  items: Array<{
    inventoryItemId: number;
    quantity: number;
    title: string;
    unitAmountCents: number;
    imageUrl: string;
  }>;
}): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', input.successUrl);
  form.set('cancel_url', input.cancelUrl);
  form.set('client_reference_id', input.orderId);
  form.set('metadata[order_id]', input.orderId);
  form.set('metadata[order_number]', input.orderNumber);
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[discount_cents]', String(input.discountCents));
  form.set('metadata[shipping_status]', input.shippingStatus);
  form.set('metadata[shipping_label]', input.shippingLabel);
  form.set('metadata[shipping_cents]', String(input.shippingCents));
  form.set('metadata[tax_cents]', String(input.taxCents));
  form.set('metadata[payment_method_mode]', input.paymentMethodMode);
  if (!input.splitTender && input.paymentMethodMode === 'standard') {
    form.append('payment_method_types[]', 'card');
    form.append('payment_method_types[]', 'cashapp');
    form.append('payment_method_types[]', 'us_bank_account');
  } else if (!input.splitTender && input.paymentMethodMode === 'finance') {
    form.append('payment_method_types[]', 'affirm');
    form.append('payment_method_types[]', 'klarna');
  }
  if (input.shippingAddressRequired) {
    form.append('shipping_address_collection[allowed_countries][]', 'US');
  }
  if (input.splitTender) {
    form.set('metadata[checkout_provider]', 'stripe_cash');
    form.set('metadata[card_amount_cents]', String(input.splitTender.cardAmountCents));
    form.set('metadata[cash_amount_cents]', String(input.splitTender.cashAmountCents));
    form.set('metadata[total_cents]', String(input.splitTender.totalCents));
  }

  if (!input.splitTender && input.discountCents > 0) {
    const couponId = await createStripeAmountOffCoupon({
      stripeSecretKey: input.stripeSecretKey,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      couponCode: input.couponCode,
      amountOffCents: input.discountCents,
    });
    form.set('discounts[0][coupon]', couponId);
  }

  if (input.splitTender) {
    const prefix = 'line_items[0]';
    form.set(`${prefix}[quantity]`, '1');
    form.set(`${prefix}[price_data][currency]`, 'usd');
    form.set(`${prefix}[price_data][unit_amount]`, String(input.splitTender.cardAmountCents));
    form.set(`${prefix}[price_data][product_data][name]`, `Card payment for ${input.orderNumber}`);
    form.set(`${prefix}[price_data][product_data][description]`, 'Partial card payment for an in-store card + cash checkout.');
  } else {
    input.items.forEach((item, index) => {
      const prefix = `line_items[${index}]`;
      form.set(`${prefix}[quantity]`, String(item.quantity));
      form.set(`${prefix}[price_data][currency]`, 'usd');
      form.set(`${prefix}[price_data][unit_amount]`, String(item.unitAmountCents));
      form.set(`${prefix}[price_data][product_data][name]`, item.title);
      form.set(`${prefix}[price_data][product_data][metadata][inventory_item_id]`, String(item.inventoryItemId));
      if (item.imageUrl) {
        form.set(`${prefix}[price_data][product_data][images][0]`, item.imageUrl);
      }
    });
    if (input.shippingAddressRequired) {
      const prefix = `line_items[${input.items.length}]`;
      form.set(`${prefix}[quantity]`, '1');
      form.set(`${prefix}[price_data][currency]`, 'usd');
      form.set(`${prefix}[price_data][unit_amount]`, String(input.shippingCents));
      form.set(`${prefix}[price_data][product_data][name]`, 'Shipping');
      form.set(`${prefix}[price_data][product_data][description]`, input.shippingLabel);
    }
  }

  if (!input.splitTender && input.taxCents > 0) {
    const prefix = `line_items[${input.items.length + (input.shippingAddressRequired ? 1 : 0)}]`;
    form.set(`${prefix}[quantity]`, '1');
    form.set(`${prefix}[price_data][currency]`, 'usd');
    form.set(`${prefix}[price_data][unit_amount]`, String(input.taxCents));
    form.set(`${prefix}[price_data][product_data][name]`, 'Sales tax');
    form.set(`${prefix}[price_data][product_data][description]`, 'State, city, county taxes');
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the checkout request.'));
  }
  const id = normalizeText(data?.id, '');
  const url = normalizeText(data?.url, '');
  if (!id || !url) throw new Error('Stripe did not return a checkout URL.');
  return { id, url };
}

export async function createStripeTerminalPaymentIntent(input: {
  stripeSecretKey: string;
  orderId: string;
  orderNumber: string;
  amountCents: number;
  totalCents: number;
  cardAmountCents: number;
  cashAmountCents: number;
  discountCents: number;
  shippingStatus: string;
  shippingLabel: string;
  shippingCents: number;
  taxCents: number;
  checkoutProvider: string;
  items: Array<{
    inventoryItemId: number;
    quantity: number;
    title: string;
  }>;
}): Promise<{ id: string; status: string }> {
  const form = new URLSearchParams();
  form.set('amount', String(input.amountCents));
  form.set('currency', 'usd');
  form.append('payment_method_types[]', 'card_present');
  form.set('capture_method', 'automatic');
  form.set('description', `Coal Creek Guitars ${input.orderNumber}`);
  form.set('metadata[order_id]', input.orderId);
  form.set('metadata[order_number]', input.orderNumber);
  form.set('metadata[checkout_provider]', input.checkoutProvider);
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[card_amount_cents]', String(input.cardAmountCents));
  form.set('metadata[cash_amount_cents]', String(input.cashAmountCents));
  form.set('metadata[total_cents]', String(input.totalCents));
  form.set('metadata[discount_cents]', String(input.discountCents));
  form.set('metadata[shipping_status]', input.shippingStatus);
  form.set('metadata[shipping_label]', input.shippingLabel);
  form.set('metadata[shipping_cents]', String(input.shippingCents));
  form.set('metadata[tax_cents]', String(input.taxCents));

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `ccg-terminal-pi-${input.orderId}`,
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the Terminal payment request.'));
  }
  const id = normalizeText(data?.id, '');
  if (!id) throw new Error('Stripe did not return a PaymentIntent ID.');
  return { id, status: normalizeText(data?.status, '') };
}

export async function processStripeTerminalPaymentIntent(input: {
  stripeSecretKey: string;
  readerId: string;
  paymentIntentId: string;
  orderId: string;
}): Promise<any> {
  const form = new URLSearchParams();
  form.set('payment_intent', input.paymentIntentId);

  const response = await fetch(
    `https://api.stripe.com/v1/terminal/readers/${encodeURIComponent(input.readerId)}/process_payment_intent`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `ccg-terminal-process-${input.orderId}`,
      },
      body: form,
    },
  );
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe could not send the payment to the Terminal reader.'));
  }
  return data?.action ?? null;
}

export async function retrieveStripePaymentIntent(stripeSecretKey: string, paymentIntentId: string): Promise<any> {
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  );
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe payment lookup failed.'));
  }
  return data;
}

export async function cancelStripePaymentIntent(stripeSecretKey: string, paymentIntentId: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    if (!response.ok) {
      const data = await response.json<any>();
      console.warn('Stripe PaymentIntent cancel failed', {
        paymentIntentId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
    }
  } catch (error) {
    console.warn('Stripe PaymentIntent cancel failed', { paymentIntentId, error });
  }
}

export async function cancelStripeTerminalReaderAction(stripeSecretKey: string, readerId: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/terminal/readers/${encodeURIComponent(readerId)}/cancel_action`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    if (!response.ok) {
      const data = await response.json<any>();
      console.warn('Stripe Terminal reader action cancel failed', {
        readerId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
    }
  } catch (error) {
    console.warn('Stripe Terminal reader action cancel failed', { readerId, error });
  }
}

export async function resolveStripeTerminalReader(input: {
  stripeSecretKey: string;
  requestedReaderId: string;
  useSandbox: boolean;
  env: Env;
}): Promise<
  | { ok: true; reader: { id: string; label: string; status: string; action?: any } }
  | { ok: false; message: string; status: number }
> {
  const configuredReaderId = input.requestedReaderId || await getConfiguredStripeTerminalReaderId(input.env, input.useSandbox);
  if (configuredReaderId) {
    const reader = await retrieveStripeTerminalReader(input.stripeSecretKey, configuredReaderId);
    if (!reader.id) {
      return { ok: false, message: 'Configured Stripe Terminal reader was not found.', status: 503 };
    }
    if (reader.status !== 'online') {
      return { ok: false, message: `Stripe Terminal reader ${reader.label || reader.id} is ${reader.status || 'offline'}.`, status: 409 };
    }
    return { ok: true, reader };
  }

  const readers = await listStripeTerminalReaders(input.stripeSecretKey);
  const onlineReaders = readers.filter((reader) => reader.status === 'online');
  if (onlineReaders.length === 1) {
    return { ok: true, reader: onlineReaders[0] };
  }
  if (onlineReaders.length === 0) {
    return { ok: false, message: 'No online Stripe Terminal readers were found in the active Stripe mode.', status: 503 };
  }
  return {
    ok: false,
    message: 'Multiple online Stripe Terminal readers were found. Configure a default reader before using Terminal checkout.',
    status: 409,
  };
}

export async function getConfiguredStripeTerminalReaderId(env: Env, useSandbox: boolean): Promise<string> {
  const envReaderId = useSandbox
    ? normalizeText(env.STRIPE_TERMINAL_READER_ID_SANDBOX, '')
    : normalizeText(env.STRIPE_TERMINAL_READER_ID, '');
  if (envReaderId) return envReaderId;

  try {
    const columnName = useSandbox ? 'stripe_terminal_reader_id_sandbox' : 'stripe_terminal_reader_id';
    const row = await env.DB.prepare(`SELECT ${columnName} AS reader_id FROM sys_info LIMIT 1`)
      .first<{ reader_id: string | null }>();
    return normalizeText(row?.reader_id, '');
  } catch (error) {
    console.warn('Stripe Terminal reader config lookup failed', { useSandbox, error });
    return '';
  }
}

export async function retrieveStripeTerminalReader(
  stripeSecretKey: string,
  readerId: string,
): Promise<{ id: string; label: string; status: string; action?: any }> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/terminal/readers/${encodeURIComponent(readerId)}`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
    );
    const data = await response.json<any>();
    if (!response.ok) {
      console.warn('Stripe Terminal reader lookup failed', {
        readerId,
        status: response.status,
        message: normalizeText(data?.error?.message, ''),
      });
      return { id: '', label: '', status: '' };
    }
    return {
      id: normalizeText(data?.id, ''),
      label: normalizeText(data?.label, ''),
      status: normalizeText(data?.status, ''),
      action: data?.action ?? null,
    };
  } catch (error) {
    console.warn('Stripe Terminal reader lookup failed', { readerId, error });
    return { id: '', label: '', status: '' };
  }
}

export async function listStripeTerminalReaders(
  stripeSecretKey: string,
): Promise<Array<{ id: string; label: string; status: string }>> {
  const params = new URLSearchParams({ limit: '100' });
  const response = await fetch(`https://api.stripe.com/v1/terminal/readers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe Terminal reader lookup failed.'));
  }
  return (Array.isArray(data?.data) ? data.data : [])
    .map((reader) => ({
      id: normalizeText(reader?.id, ''),
      label: normalizeText(reader?.label, ''),
      status: normalizeText(reader?.status, ''),
    }))
    .filter((reader) => reader.id);
}
