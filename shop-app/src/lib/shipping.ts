// Mirrors SHOP_BIG_SHIPPING_CATEGORIES in workers/listing-evaluator/src/constants.ts.
// This is a display-only mirror — the Worker recomputes the real charge from
// D1 at checkout time, this just keeps the on-site cart preview honest so
// customers aren't surprised when they reach Stripe's hosted checkout page.
const BIG_SHIPPING_CATEGORIES = new Set(['Guitar', 'Bass', 'Stringed Instruments', 'Amplification']);

export function getRootCategoryName(categoryPath: string): string {
  return categoryPath.split('>')[0]?.trim() || '';
}

export function isBigShippingCategory(categoryPath: string): boolean {
  return BIG_SHIPPING_CATEGORIES.has(getRootCategoryName(categoryPath));
}

export type CartShippingItem = {
  allowShipping?: boolean;
  isBigShippingItem?: boolean;
  fixedShippingAmount?: number;
  quantity: number;
};

export type CartShippingResult = {
  amountCents: number;
  label: 'FREE' | 'IN-STORE' | string;
  combineNotice: boolean;
  addressRequired: boolean;
};

// Mirrors calculateShopCheckoutShipping in workers/listing-evaluator/src/shop/checkout-draft.ts.
export function calculateCartShipping(items: CartShippingItem[], isAssociateMode: boolean): CartShippingResult {
  const shippableItems = items.filter((item) => item.allowShipping);
  if (isAssociateMode || shippableItems.length === 0) {
    return { amountCents: 0, label: 'IN-STORE', combineNotice: false, addressRequired: false };
  }

  const itemCents = (item: CartShippingItem) => Math.round((item.fixedShippingAmount || 0) * 100) * item.quantity;
  const bigItems = shippableItems.filter((item) => item.isBigShippingItem);

  let amountCents: number;
  let combineNotice = false;
  if (bigItems.length > 0) {
    amountCents = bigItems.reduce((sum, item) => sum + itemCents(item), 0);
  } else {
    amountCents = shippableItems.reduce((sum, item) => sum + itemCents(item), 0);
    const shippableUnitCount = shippableItems.reduce((sum, item) => sum + item.quantity, 0);
    combineNotice = shippableUnitCount > 1 && amountCents > 0;
  }

  return {
    amountCents,
    label: amountCents > 0 ? `$${(amountCents / 100).toFixed(2)}` : 'FREE',
    combineNotice,
    addressRequired: true,
  };
}
