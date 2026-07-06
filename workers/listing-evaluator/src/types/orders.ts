export interface ShopCheckoutRequestPayload {
  fulfillmentType?: unknown;
  paymentMode?: unknown;
  couponCode?: unknown;
  discountCents?: unknown;
  taxIncluded?: unknown;
  otdMode?: unknown;
  splitTender?: {
    cardAmountCents?: unknown;
  };
  customer?: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
  };
  readerId?: unknown;
  items?: Array<{
    inventoryItemId?: unknown;
    quantity?: unknown;
    overrideUnitPriceCents?: unknown;
  }>;
}

export type ShopCheckoutLineItem = {
  inventoryItemId: number;
  quantity: number;
  row: ShopCheckoutInventoryRow;
  title: string;
  unitAmountCents: number;
  imageUrl: string;
};

export type ShopCheckoutDraft = {
  items: ShopCheckoutLineItem[];
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  taxIncluded: boolean;
  shippingStatus: 'flat_rate' | 'free' | 'in_store';
  shippingLabel: '$6.00' | 'FREE' | 'IN-STORE';
  shippingCents: number;
  shippingTaxCents: number;
  shippingAddressRequired: boolean;
  taxCents: number;
  totalCents: number;
};

export interface ShopCheckoutInventoryRow {
  id: number;
  title: string | null;
  quantity?: number | null;
  sale_title: string | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  image_url: string | null;
  regular_price: number | null;
  sale_price: number | null;
  unit_purchase_price: number | null;
  quantity: number | null;
  for_sale: number | null;
  only_in_store: number | null;
  is_sold: number | null;
  is_active: number | null;
  is_rented: number | null;
  availability_status: string | null;
  active_order_id: string | null;
  reserved_until: string | null;
  allow_shipping?: number | null;
  sales_tax_included?: number | null;
  sale_url?: string | null;
  primaryCategoryName?: string | null;
}
