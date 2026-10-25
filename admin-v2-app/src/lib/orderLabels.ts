// Display labels for order channels and payment methods (see order_payments / orders.channel).

export const ORDER_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'fbm', label: 'FBM' },
  { value: 'reverb', label: 'Reverb' },
  { value: 'ebay', label: 'eBay' },
  { value: 'in_store', label: 'CCG In-Store' },
  { value: 'ccg_web', label: 'CCG Web' },
  { value: 'cl', label: 'Craigslist' },
  { value: 'offerup', label: 'OfferUp' },
  { value: 'nextdoor', label: 'Nextdoor' },
  { value: 'gear_exchange', label: 'Sweetwater Gear Exchange' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'fbm', label: 'FBM checkout' },
  { value: 'reverb', label: 'Reverb' },
  { value: 'ebay', label: 'eBay' },
  { value: 'stripe_link', label: 'Stripe payment link' },
  { value: 'stripe_terminal', label: 'Stripe Terminal (card in shop)' },
  { value: 'stripe_checkout', label: 'Stripe checkout (CCG web)' },
  { value: 'cash', label: 'Cash' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
];

export function orderChannelLabel(value: string): string {
  return ORDER_CHANNEL_OPTIONS.find((option) => option.value === value)?.label
    || (value === 'online' ? 'CCG Web' : value || '—');
}

export function paymentMethodLabel(value: string): string {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label || value || '—';
}

// Verbose browser-console logging for the manual-orders UI while it is being validated
// (matches the Worker's "ccg-orders" log tag). Filter the console on "ccg-orders".
export function logOrderUi(event: string, data: Record<string, unknown> = {}): void {
  console.info('[ccg-orders]', event, data);
}
