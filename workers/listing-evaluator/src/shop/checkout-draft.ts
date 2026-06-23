import type { Env } from '../env.js';
import { jsonResponse, numberOrZero, parseOptionalPositiveInt } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { toPublicShopImageUrl } from '../utils/image.js';
import { dbListCheckoutInventoryItems } from './db.js';
import {
  SHOP_SALES_TAX_RATE,
  SHOP_FLAT_RATE_SHIPPING_CENTS,
  SHOP_FREE_SHIPPING_THRESHOLD_CENTS,
  SHOP_COUPONS,
} from '../constants.js';
import type {
  ShopCheckoutRequestPayload,
  ShopCheckoutLineItem,
  ShopCheckoutDraft,
  ShopCheckoutInventoryRow,
} from '../types/orders.js';

function normalizeCheckoutItems(input: unknown): Array<{ inventoryItemId: number; quantity: number }> {
  if (!Array.isArray(input)) return [];

  const byInventoryItemId = new Map<number, number>();
  for (const item of input) {
    const inventoryItemId = parseOptionalPositiveInt((item as any)?.inventoryItemId);
    if (!inventoryItemId) continue;
    const quantityValue = Number((item as any)?.quantity ?? 1);
    const quantity = Math.max(1, Math.min(99, Math.floor(Number.isFinite(quantityValue) ? quantityValue : 1)));
    byInventoryItemId.set(inventoryItemId, (byInventoryItemId.get(inventoryItemId) || 0) + quantity);
  }

  return Array.from(byInventoryItemId.entries()).map(([inventoryItemId, quantity]) => ({
    inventoryItemId,
    quantity,
  }));
}

function getCheckoutItemTitle(row: ShopCheckoutInventoryRow): string {
  return normalizeText(row.sale_title, '') || normalizeText(row.title, '') || `Inventory item ${row.id}`;
}

function getCheckoutInventoryUnavailableReason(
  row: ShopCheckoutInventoryRow,
  input: { includeInStoreOnly: boolean; requestedQuantity: number },
): string | null {
  const title = getCheckoutItemTitle(row);
  if (Number(row.is_active || 0) !== 1) return `${title} is no longer available.`;
  if (Number(row.is_sold || 0) === 1) return `${title} has already sold.`;
  if (Number(row.is_rented || 0) === 1) return `${title} is not available for checkout.`;
  if (Number(row.for_sale || 0) !== 1) return `${title} is not available for checkout.`;
  if (Number(row.only_in_store || 0) === 1 && !input.includeInStoreOnly) {
    return `${title} is only available in store.`;
  }
  const availableQuantity = Math.max(0, Number(row.quantity ?? 0));
  if (availableQuantity <= 0) return `${title} is currently out of stock.`;
  if (input.requestedQuantity > availableQuantity) {
    return `${title} has only ${availableQuantity} available.`;
  }
  if (normalizeText(row.availability_status, 'available') === 'sold') return `${title} has already sold.`;
  return null;
}

export async function buildShopCheckoutDraft(
  body: ShopCheckoutRequestPayload,
  options: { includeInStoreOnly: boolean; allowTaxIncluded: boolean; allowManualDiscount: boolean },
  env: Env,
): Promise<ShopCheckoutDraft | Response> {
  const requestedItems = normalizeCheckoutItems(body?.items);
  if (requestedItems.length === 0) {
    return jsonResponse({ message: 'Your cart is empty.' }, 400);
  }

  const inventoryRows = await dbListCheckoutInventoryItems(
    requestedItems.map((item) => item.inventoryItemId),
    env,
  );
  const byId = new Map(inventoryRows.map((row) => [row.id, row]));

  const checkoutItems: ShopCheckoutLineItem[] = [];
  for (const requestedItem of requestedItems) {
    const row = byId.get(requestedItem.inventoryItemId);
    if (!row) {
      return jsonResponse({ message: 'One of the cart items is no longer available.' }, 400);
    }
    const unavailableReason = getCheckoutInventoryUnavailableReason(row, {
      includeInStoreOnly: options.includeInStoreOnly,
      requestedQuantity: requestedItem.quantity,
    });
    if (unavailableReason) {
      return jsonResponse({ message: unavailableReason }, 409);
    }
    const price = Number(row.sale_price || row.regular_price || 0);
    const unitAmountCents = Math.round(price * 100);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      return jsonResponse({ message: `${getCheckoutItemTitle(row)} is missing a checkout price.` }, 409);
    }
    checkoutItems.push({
      inventoryItemId: requestedItem.inventoryItemId,
      quantity: requestedItem.quantity,
      row,
      title: getCheckoutItemTitle(row),
      unitAmountCents,
      imageUrl: toPublicShopImageUrl(row.image_url, 'thumb'),
    });
  }

  let subtotalCents = checkoutItems.reduce(
    (sum, item) => sum + item.unitAmountCents * item.quantity,
    0,
  );

  const otdMode = options.allowManualDiscount && body?.otdMode === true;
  if (otdMode) {
    const hasEligibleItem = checkoutItems.some((item) => item.unitAmountCents > 10000);
    if (!hasEligibleItem) {
      return jsonResponse({ message: 'OTD mode requires at least one item priced over $100.' }, 400);
    }
    const expensiveIndex = checkoutItems.reduce(
      (bestIdx, item, idx) =>
        item.unitAmountCents > checkoutItems[bestIdx].unitAmountCents ? idx : bestIdx,
      0,
    );
    // OTD: only back out tax from taxable items (sales_tax_included=0)
    const taxableForOtdCents = checkoutItems.reduce(
      (sum, item) => Number(item.row.sales_tax_included) === 1 ? sum : sum + item.unitAmountCents * item.quantity,
      0,
    );
    const reducedTaxableCents = Math.round(taxableForOtdCents / (1 + SHOP_SALES_TAX_RATE));
    const adjustmentCents = taxableForOtdCents - reducedTaxableCents;
    const expensiveItem = checkoutItems[expensiveIndex];
    const perUnitAdjCents = Math.round(adjustmentCents / expensiveItem.quantity);
    checkoutItems[expensiveIndex] = {
      ...expensiveItem,
      unitAmountCents: Math.max(1, expensiveItem.unitAmountCents - perUnitAdjCents),
    };
    subtotalCents = checkoutItems.reduce((sum, item) => sum + item.unitAmountCents * item.quantity, 0);
  }

  const couponCode = normalizeText(body?.couponCode, '').toUpperCase();
  const coupon = couponCode ? SHOP_COUPONS.get(couponCode) : null;
  if (couponCode && !coupon) {
    return jsonResponse({ message: 'Coupon is no longer valid.' }, 400);
  }
  const manualDiscountCents = options.allowManualDiscount ? numberOrZero(body?.discountCents) : 0;
  if (!options.allowManualDiscount && numberOrZero(body?.discountCents) > 0) {
    return jsonResponse({ message: 'Manual discounts are only available in associate mode.' }, 403);
  }
  if (manualDiscountCents > subtotalCents) {
    return jsonResponse({ message: 'Discount cannot exceed the order subtotal.' }, 400);
  }
  const couponDiscountCents = coupon ? Math.min(coupon.amountOffCents, subtotalCents) : 0;
  const discountCents = manualDiscountCents > 0
    ? manualDiscountCents
    : couponDiscountCents;
  const shipping = calculateShopCheckoutShipping({
    items: checkoutItems,
    subtotalCents,
    discountCents,
    isAssociateMode: options.includeInStoreOnly,
  });
  // Only items where sales_tax_included=0 are subject to sales tax
  const taxableItemsCents = checkoutItems.reduce(
    (sum, item) => Number(item.row.sales_tax_included) === 1 ? sum : sum + item.unitAmountCents * item.quantity,
    0,
  );
  // Pro-rate the discount proportionally across taxable vs tax-included items
  const taxableDiscountCents = subtotalCents > 0 ? Math.round(discountCents * taxableItemsCents / subtotalCents) : 0;
  const taxableBaseCents = Math.max(0, taxableItemsCents - taxableDiscountCents + shipping.shippingCents);
  const taxIncluded = options.allowTaxIncluded && body?.taxIncluded === true;
  const taxCents = taxIncluded ? 0 : Math.round(taxableBaseCents * SHOP_SALES_TAX_RATE);
  const shippingTaxCents = taxIncluded || shipping.shippingCents <= 0
    ? 0
    : Math.round(shipping.shippingCents * SHOP_SALES_TAX_RATE);
  const totalCents = Math.max(0, subtotalCents - discountCents + shipping.shippingCents) + taxCents;

  return {
    items: checkoutItems,
    subtotalCents,
    discountCents,
    couponCode: manualDiscountCents > 0 ? null : coupon ? couponCode : null,
    taxIncluded,
    shippingStatus: shipping.shippingStatus,
    shippingLabel: shipping.shippingLabel,
    shippingCents: shipping.shippingCents,
    shippingTaxCents,
    shippingAddressRequired: shipping.shippingAddressRequired,
    taxCents,
    totalCents,
  };
}

export function calculateShopCheckoutShipping(input: {
  items: ShopCheckoutLineItem[];
  subtotalCents: number;
  discountCents: number;
  isAssociateMode: boolean;
}): Pick<ShopCheckoutDraft, 'shippingStatus' | 'shippingLabel' | 'shippingCents' | 'shippingAddressRequired'> {
  const hasShippableItems = input.items.some((item) => Number(item.row.allow_shipping || 0) === 1);
  if (input.isAssociateMode || !hasShippableItems) {
    return {
      shippingStatus: 'in_store',
      shippingLabel: 'IN-STORE',
      shippingCents: 0,
      shippingAddressRequired: false,
    };
  }

  const thresholdSubtotalCents = Math.max(0, input.subtotalCents - input.discountCents);
  if (thresholdSubtotalCents >= SHOP_FREE_SHIPPING_THRESHOLD_CENTS) {
    return {
      shippingStatus: 'free',
      shippingLabel: 'FREE',
      shippingCents: 0,
      shippingAddressRequired: true,
    };
  }

  return {
    shippingStatus: 'flat_rate',
    shippingLabel: '$6.00',
    shippingCents: SHOP_FLAT_RATE_SHIPPING_CENTS,
    shippingAddressRequired: true,
  };
}
