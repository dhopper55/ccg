import { normalizeText } from '../utils/text.js';

export async function listStripePaymentLinks(
  stripeSecretKey: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  const response = await fetch(`https://api.stripe.com/v1/payment_links?${params.toString()}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the payment links request.'));
  }

  const paymentLinks = Array.isArray(data?.data) ? data.data : [];
  return Promise.all(paymentLinks.map(async (paymentLink) => {
    const lineItems = await listStripePaymentLinkLineItems(stripeSecretKey, normalizeText(paymentLink?.id, ''));
    return mapStripePaymentLink(paymentLink, lineItems);
  }));
}

export async function listStripePaymentLinkLineItems(
  stripeSecretKey: string,
  paymentLinkId: string,
): Promise<any[]> {
  if (!paymentLinkId) return [];
  const params = new URLSearchParams();
  params.set('limit', '100');
  params.append('expand[]', 'data.price.product');
  const response = await fetch(
    `https://api.stripe.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}/line_items?${params.toString()}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  );
  const data = await response.json<any>();
  if (!response.ok) {
    console.warn('Stripe payment link line items lookup failed', {
      paymentLinkId,
      message: normalizeText(data?.error?.message, ''),
    });
    return [];
  }
  return Array.isArray(data?.data) ? data.data : [];
}

export async function deactivateStripePaymentLink(stripeSecretKey: string, paymentLinkId: string): Promise<void> {
  const form = new URLSearchParams();
  form.set('active', 'false');
  const response = await fetch(`https://api.stripe.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the deactivate request.'));
  }
}

export async function createStripePaymentLinkFromInventory(input: {
  stripeSecretKey: string;
  items: Array<{
    inventoryItemId: number;
    ccgNumber: string;
    title: string;
    description: string;
    quantity: number;
    unitAmountCents: number;
    imageUrl: string;
  }>;
  includeSalesTax: boolean;
  taxRateId: string;
}): Promise<Record<string, unknown>> {
  const form = new URLSearchParams();
  form.set('metadata[source]', 'admin_v2_marked_inventory');
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[include_sales_tax]', input.includeSalesTax ? '1' : '0');
  if (input.taxRateId) form.set('metadata[tax_rate_id]', input.taxRateId);

  const priceIds: string[] = [];
  for (const item of input.items) {
    priceIds.push(await createStripeProductPriceForInventoryItem(input.stripeSecretKey, item));
  }

  input.items.forEach((item, index) => {
    const prefix = `line_items[${index}]`;
    form.set(`${prefix}[quantity]`, String(item.quantity));
    form.set(`${prefix}[price]`, priceIds[index]);
    if (input.includeSalesTax && input.taxRateId) {
      form.set(`${prefix}[tax_rates][0]`, input.taxRateId);
    }
  });

  const response = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    const message = normalizeText(data?.error?.message, 'Stripe rejected the payment link request.');
    if (input.includeSalesTax && /tax_rates/i.test(message) && /unknown parameter/i.test(message)) {
      return createStripePaymentLinkWithTaxLineItem(input, priceIds);
    }
    throw new Error(message);
  }
  return mapStripePaymentLink(data, []);
}

export async function createStripePaymentLinkWithTaxLineItem(
  input: {
    stripeSecretKey: string;
    items: Array<{
      inventoryItemId: number;
      ccgNumber: string;
      title: string;
      description: string;
      quantity: number;
      unitAmountCents: number;
      imageUrl: string;
    }>;
    includeSalesTax: boolean;
    taxRateId: string;
  },
  priceIds: string[],
): Promise<Record<string, unknown>> {
  const subtotalCents = input.items.reduce(
    (sum, item) => sum + item.unitAmountCents * Math.max(1, item.quantity),
    0,
  );
  const taxCents = Math.round(subtotalCents * 0.0805);
  const taxPriceId = taxCents > 0
    ? await createStripeProductPriceForInventoryItem(input.stripeSecretKey, {
      inventoryItemId: 0,
      ccgNumber: '',
      title: 'CO Sales Tax (8.05%)',
      description: `8.05% Colorado sales tax for marked inventory payment link. Tax rate id: ${input.taxRateId}`,
      unitAmountCents: taxCents,
      imageUrl: '',
    })
    : '';

  const form = new URLSearchParams();
  form.set('metadata[source]', 'admin_v2_marked_inventory');
  form.set('metadata[inventory_item_ids]', input.items.map((item) => String(item.inventoryItemId)).join(','));
  form.set('metadata[include_sales_tax]', '1');
  form.set('metadata[tax_rate_id]', input.taxRateId);
  form.set('metadata[tax_fallback]', 'line_item');

  input.items.forEach((item, index) => {
    const prefix = `line_items[${index}]`;
    form.set(`${prefix}[quantity]`, String(item.quantity));
    form.set(`${prefix}[price]`, priceIds[index]);
  });

  if (taxPriceId) {
    const prefix = `line_items[${input.items.length}]`;
    form.set(`${prefix}[quantity]`, '1');
    form.set(`${prefix}[price]`, taxPriceId);
  }

  const response = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await response.json<any>();
  if (!response.ok) {
    throw new Error(normalizeText(data?.error?.message, 'Stripe rejected the payment link request.'));
  }
  return mapStripePaymentLink(data, []);
}

export async function createStripeProductPriceForInventoryItem(
  stripeSecretKey: string,
  item: {
    inventoryItemId: number;
    ccgNumber: string;
    title: string;
    description: string;
    unitAmountCents: number;
    imageUrl: string;
  },
): Promise<string> {
  const productForm = new URLSearchParams();
  productForm.set('name', item.title);
  productForm.set('metadata[inventory_item_id]', String(item.inventoryItemId));
  productForm.set('metadata[source]', 'admin_v2_payment_link');
  if (item.ccgNumber) productForm.set('metadata[ccg_number]', item.ccgNumber);
  if (item.description) productForm.set('description', item.description);
  if (item.imageUrl) productForm.set('images[0]', item.imageUrl);

  const productResponse = await fetch('https://api.stripe.com/v1/products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: productForm,
  });
  const productData = await productResponse.json<any>();
  if (!productResponse.ok) {
    throw new Error(normalizeText(productData?.error?.message, 'Stripe rejected the product request.'));
  }
  const productId = normalizeText(productData?.id, '');
  if (!productId) throw new Error('Stripe did not return a product id.');

  const priceForm = new URLSearchParams();
  priceForm.set('currency', 'usd');
  priceForm.set('unit_amount', String(item.unitAmountCents));
  priceForm.set('product', productId);
  priceForm.set('tax_behavior', 'exclusive');
  priceForm.set('metadata[inventory_item_id]', String(item.inventoryItemId));
  priceForm.set('metadata[source]', 'admin_v2_payment_link');
  if (item.ccgNumber) priceForm.set('metadata[ccg_number]', item.ccgNumber);

  const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: priceForm,
  });
  const priceData = await priceResponse.json<any>();
  if (!priceResponse.ok) {
    throw new Error(normalizeText(priceData?.error?.message, 'Stripe rejected the price request.'));
  }
  const priceId = normalizeText(priceData?.id, '');
  if (!priceId) throw new Error('Stripe did not return a price id.');
  return priceId;
}

export function mapStripePaymentLink(paymentLink: any, lineItems: any[]): Record<string, unknown> {
  const firstLineItem = lineItems[0] || {};
  const firstProduct = firstLineItem?.price?.product;
  const firstPrice = firstLineItem?.price;
  const name = normalizeText(
    firstLineItem.description
      ?? paymentLink?.metadata?.name
      ?? (typeof firstProduct === 'object' ? firstProduct?.name : '')
      ?? paymentLink?.id,
    '',
  );
  const created = Number(
    paymentLink?.created
      ?? paymentLink?.metadata?.created
      ?? paymentLink?.metadata?.created_at
      ?? firstPrice?.created
      ?? (typeof firstProduct === 'object' ? firstProduct?.created : null)
      ?? 0,
  );
  const createdDate = created ? new Date(created * 1000) : null;
  return {
    id: normalizeText(paymentLink?.id, ''),
    name,
    price: formatStripePaymentLinkPrice(lineItems, paymentLink?.currency),
    created,
    createdLabel: createdDate ? createdDate.toISOString() : '',
    createdDisplay: createdDate ? formatStripeCreatedDisplay(createdDate) : '',
    status: paymentLink?.active === false ? 'Deactivated' : 'Active',
    automaticTax: Boolean(paymentLink?.automatic_tax?.enabled),
    url: normalizeText(paymentLink?.url, ''),
  };
}

export function formatStripeCreatedDisplay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatStripePaymentLinkPrice(lineItems: any[], fallbackCurrency: unknown): string {
  if (lineItems.length === 0) return '';
  const currency = normalizeText(lineItems[0]?.currency ?? lineItems[0]?.price?.currency ?? fallbackCurrency, 'usd').toUpperCase();
  const totalCents = lineItems.reduce((sum, lineItem) => {
    const quantity = Number(lineItem?.quantity || 1) || 1;
    const amount = parseStripeAmountCents(lineItem?.amount_total)
      ?? parseStripeAmountCents(lineItem?.price?.unit_amount)
      ?? parseStripeAmountCents(lineItem?.price?.unit_amount_decimal);
    return sum + (amount == null ? 0 : amount * (lineItem?.amount_total == null ? quantity : 1));
  }, 0);
  const interval = normalizeText(lineItems[0]?.price?.recurring?.interval, '');
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(totalCents / 100);
  return `${amount} ${currency}${interval ? ` / ${interval}` : ''}`;
}

export function parseStripeAmountCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
