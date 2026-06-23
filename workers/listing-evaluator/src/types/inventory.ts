export type InventoryItemRow = {
  id: number;
  source_listing_id: number | null;
  ccg_number: string;
  image_url: string;
  image_urls: string | null;
  title: string;
  quantity: number | null;
  category_id: number | null;
  category_name: string | null;
  category_path: string | null;
  secondary_category_id: number | null;
  secondary_category_name: string | null;
  secondary_category_path: string | null;
  brand: string | null;
  queue: string | null;
  year_range: string | null;
  model: string | null;
  finish: string | null;
  repair_notes: string | null;
  original_listing_desc: string | null;
  video_url: string | null;
  sale_title: string | null;
  regular_price: number | null;
  sale_price: number | null;
  condition: string | null;
  allow_shipping: number | null;
  sales_tax_included: number | null;
  sale_description: string | null;
  clearance: number | null;
  bullet_1_text: string | null;
  bullet_1_danger: number | null;
  bullet_1_highlight: number | null;
  bullet_2_text: string | null;
  bullet_2_danger: number | null;
  bullet_2_highlight: number | null;
  bullet_3_text: string | null;
  bullet_3_danger: number | null;
  bullet_3_highlight: number | null;
  bullet_4_text: string | null;
  bullet_4_danger: number | null;
  bullet_4_highlight: number | null;
  bullet_5_text: string | null;
  bullet_5_danger: number | null;
  bullet_5_highlight: number | null;
  bullet_6_text: string | null;
  bullet_6_danger: number | null;
  bullet_6_highlight: number | null;
  barcode: string | null;
  purchased_date: string | null;
  unit_purchase_price: number | null;
  map_price: number | null;
  private_party_value: number | null;
  miles: number | null;
  minutes_spent: number | null;
  ship_cost: number | null;
  purchase_notes: string | null;
  ai_analysis_text: string | null;
  serial_number: string | null;
  is_active: number | null;
  is_marked: number | null;
  is_personal: number | null;
  is_rented: number | null;
  is_custom: number | null;
  for_sale: number | null;
  only_in_store: number | null;
  sales_channel_ccg: number | null;
  sales_channel_fbm: number | null;
  sales_channel_cl: number | null;
  sales_channel_reverb: number | null;
  sales_channel_gear_exchange: number | null;
  sales_channel_offerup: number | null;
  sales_channel_ebay: number | null;
  sales_channel_nextdoor: number | null;
  sales_channel_other: number | null;
  for_sale_date: string | null;
  is_sold: number | null;
  sold_date: string | null;
  sold_amount: number | null;
  sell_notes: string | null;
  subscription_id: number | null;
  package_id: number | null;
  sale_url: string | null;
  sale_zip: string | null;
  storage_location: string | null;
  sold_channel: string | null;
  merchant_center_cat_code: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type InventorySummaryTotals = {
  totalListed: number;
  totalSold: number;
  totalPurchased: number;
  ccgPaidUnsold: number;
  ccgPrivatePartyUnsold: number;
  ccgSoldPaid: number;
  ccgSoldPrivateParty: number;
  ccgSoldProfitMarginPercent: number;
  ccgActiveItems: number;
  ccgNotForSaleItems: number;
  ccgForSaleItems: number;
  ccgSoldItems: number;
};

export type AdminV2DashboardSummary = {
  inventoryCostBasis: number;
  privatePartyValue: number;
  currentAskingValue: number;
  realizedProfitMTD: number;
  soldMargin30DayPercent: number;
  soldMargin60DayPercent: number;
  soldMargin90DayPercent: number;
  postStoreLaunchMarginPercent: number;
  postStoreLaunchDate: string;
  forSaleItems: number;
  avgDaysToSell: number;
  activeItems: number;
  notForSaleItems: number;
  soldItems: number;
  allTimeSoldMarginPercent: number;
};

export type AdminV2ProfitTrendPoint = {
  month: string;
  label: string;
  soldCount: number;
  revenue: number;
  cost: number;
  profit: number;
};

export type AdminV2InventoryAgingBucket = {
  key: string;
  label: string;
  itemCount: number;
  costBasis: number;
  privatePartyValue: number;
  currentAskingValue: number;
};

export type AdminV2InventoryCategoryBucket = {
  category: string;
  itemCount: number;
};

export type AdminV2RecentSaleRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  category: string | null;
  brand: string | null;
  soldDate: string | null;
  unitPurchasePrice: number;
  soldAmount: number;
  profitAmount: number;
  daysHeld: number | null;
};

export type AdminV2OldestInventoryRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  category: string | null;
  brand: string | null;
  purchasedDate: string | null;
  daysHeld: number | null;
  unitPurchasePrice: number;
  privatePartyValue: number;
  currentAskingValue: number;
  forSale: boolean;
  source: string | null;
};

export type InventoryCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  order: number;
};

export type InventoryCategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  depth: number;
  path: string;
  children: InventoryCategoryNode[];
};

export const INVENTORY_UNIT_COST_BASIS_SQL = `COALESCE(i.unit_purchase_price, 0) *
        CASE
          WHEN COALESCE(i.quantity, 0) > 0 THEN COALESCE(i.quantity, 0)
          WHEN COALESCE(i.is_sold, 0) = 1 THEN 1
          ELSE 0
        END`;

export type ShopProductRow = {
  id: number;
  ccg_number?: string | null;
  image_url: string | null;
  image_urls?: string | null;
  title: string | null;
  sale_title: string | null;
  sale_url: string | null;
  sale_zip?: string | null;
  brand?: string | null;
  model?: string | null;
  finish?: string | null;
  regular_price: number | null;
  sale_price: number | null;
  clearance?: number | null;
  condition: string | null;
  allow_shipping?: number | null;
  sales_tax_included?: number | null;
  sale_description?: string | null;
  bullet_1_text?: string | null;
  bullet_1_danger?: number | null;
  bullet_1_highlight?: number | null;
  bullet_2_text?: string | null;
  bullet_2_danger?: number | null;
  bullet_2_highlight?: number | null;
  bullet_3_text?: string | null;
  bullet_3_danger?: number | null;
  bullet_3_highlight?: number | null;
  bullet_4_text?: string | null;
  bullet_4_danger?: number | null;
  bullet_4_highlight?: number | null;
  bullet_5_text?: string | null;
  bullet_5_danger?: number | null;
  bullet_5_highlight?: number | null;
  bullet_6_text?: string | null;
  bullet_6_danger?: number | null;
  bullet_6_highlight?: number | null;
  barcode?: string | null;
  category_id: number | null;
  category_name: string | null;
  category_path: string | null;
  secondary_category_id: number | null;
  secondary_category_name: string | null;
  secondary_category_path: string | null;
  weight_lbs?: string | null;
  neck_profile?: string | null;
  neck_thickness?: string | null;
  nut_width?: string | null;
  width_12_fret?: string | null;
  fretboard_radius?: string | null;
  twelve_fret_action?: string | null;
  for_sale?: number | null;
  only_in_store?: number | null;
  is_sold: number | null;
  merchant_center_cat_code?: string | null;
};

export type InventoryItemImageRow = {
  id: number;
  inventory_item_id: number;
  image_url: string;
  display_order: number;
  is_private: number;
};

export type InventoryImageInput = {
  url: string;
  isPrivate: boolean;
};
