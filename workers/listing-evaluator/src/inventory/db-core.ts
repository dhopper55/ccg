import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import type { InventoryItemRow, InventoryItemImageRow } from '../types/inventory.js';
import { INVENTORY_UNIT_COST_BASIS_SQL } from '../types/inventory.js';
import { parseStoredInventoryImageUrls } from './db-images.js';
import { dbListInventoryImagesForItemIds } from './db-write.js';

export const INVENTORY_QUEUE_OPTIONS = new Set([
  'Triage',
  'Repair',
  'To Sell',
  'For Sale',
  'Sold',
  'Rented',
  'Parking Lot',
]);

export function normalizeInventoryQueue(input: unknown): string {
  const normalized = normalizeText(input, '').slice(0, 25);
  return INVENTORY_QUEUE_OPTIONS.has(normalized) ? normalized : '';
}

export type InventoryTriState = 'all' | 'yes' | 'no';
export type InventorySortKey = 'ccgNumber' | 'title' | 'paid' | 'private' | 'soldPrice' | 'addDate';
export type InventorySortDir = 'asc' | 'desc';

export type InventoryListFilters = {
  categoryId: number | null;
  brand: string;
  queue: string;
  sold: InventoryTriState;
  active: InventoryTriState;
  marked: InventoryTriState;
  personal: InventoryTriState;
  page: number;
  limit: number;
  sortBy: InventorySortKey;
  sortDir: InventorySortDir;
};

export function parseInventorySortKey(input: string | null): InventorySortKey {
  switch ((input || '').trim()) {
    case 'ccgNumber':
      return 'ccgNumber';
    case 'paid':
      return 'paid';
    case 'private':
      return 'private';
    case 'soldPrice':
      return 'soldPrice';
    case 'addDate':
      return 'addDate';
    case 'title':
    default:
      return 'title';
  }
}

export function parseInventorySortDir(input: string | null): InventorySortDir {
  return (input || '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
}

export function parseInventoryTriState(input: string | null, defaultValue: InventoryTriState): InventoryTriState {
  const normalized = (input || '').trim().toLowerCase();
  if (normalized === 'yes' || normalized === '1' || normalized === 'true') return 'yes';
  if (normalized === 'no' || normalized === '0' || normalized === 'false') return 'no';
  if (normalized === 'all') return 'all';
  return defaultValue;
}

export const INVENTORY_CATEGORY_SELECT_SQL = `i.category_id,
       c.name AS category_name,
       CASE
         WHEN gp.id IS NOT NULL THEN gp.name || ' > ' || p.name || ' > ' || c.name
         WHEN p.id IS NOT NULL THEN p.name || ' > ' || c.name
         ELSE c.name
       END AS category_path,
       i.secondary_category_id,
       sc.name AS secondary_category_name,
       CASE
         WHEN sgp.id IS NOT NULL THEN sgp.name || ' > ' || sp.name || ' > ' || sc.name
         WHEN sp.id IS NOT NULL THEN sp.name || ' > ' || sc.name
         ELSE sc.name
       END AS secondary_category_path`;

export const INVENTORY_CATEGORY_JOIN_SQL = `INNER JOIN ccg_inventory_categories c ON c.id = i.category_id
     LEFT JOIN ccg_inventory_categories p ON p.id = c.parent_id
     LEFT JOIN ccg_inventory_categories gp ON gp.id = p.parent_id
     LEFT JOIN ccg_inventory_categories sc ON sc.id = i.secondary_category_id
     LEFT JOIN ccg_inventory_categories sp ON sp.id = sc.parent_id
     LEFT JOIN ccg_inventory_categories sgp ON sgp.id = sp.parent_id`;

export function inventoryOrderBySql(sortBy: InventorySortKey, sortDir: InventorySortDir): string {
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
  switch (sortBy) {
    case 'ccgNumber':
      return `LOWER(i.ccg_number) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'paid':
      return `CASE WHEN i.unit_purchase_price IS NULL THEN 1 ELSE 0 END ASC, COALESCE(i.unit_purchase_price, 0) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'private':
      return `CASE WHEN i.private_party_value IS NULL THEN 1 ELSE 0 END ASC, COALESCE(i.private_party_value, 0) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'soldPrice':
      return `COALESCE(i.sold_amount, 0) ${dir}, LOWER(i.title) ASC, i.id DESC`;
    case 'addDate':
      return `COALESCE(i.created_at, '') ${dir}, i.id ${dir}`;
    case 'title':
    default:
      return `LOWER(i.title) ${dir}, LOWER(i.ccg_number) ASC, i.id DESC`;
  }
}

export function inventoryFilterClause(filters: Pick<InventoryListFilters, 'categoryId' | 'brand' | 'queue' | 'sold' | 'active' | 'marked' | 'personal'>): { sql: string; binds: unknown[] } {
  const clauses: string[] = ['1 = 1'];
  const binds: unknown[] = [];

  if (filters.sold !== 'all') {
    clauses.push('COALESCE(i.is_sold, 0) = ?');
    binds.push(filters.sold === 'yes' ? 1 : 0);
  }

  if (filters.active !== 'all') {
    clauses.push('COALESCE(i.is_active, 0) = ?');
    binds.push(filters.active === 'yes' ? 1 : 0);
  }

  if (filters.categoryId != null) {
    clauses.push('(i.category_id = ? OR i.secondary_category_id = ?)');
    binds.push(filters.categoryId, filters.categoryId);
  }
  if (filters.brand) {
    clauses.push('LOWER(COALESCE(i.brand, \'\')) = LOWER(?)');
    binds.push(filters.brand);
  }
  if (filters.queue) {
    clauses.push('COALESCE(i.queue, ?) = ?');
    binds.push('Triage', filters.queue);
  }
  if (filters.marked !== 'all') {
    clauses.push('COALESCE(i.is_marked, 0) = ?');
    binds.push(filters.marked === 'yes' ? 1 : 0);
  }
  if (filters.personal !== 'all') {
    clauses.push('COALESCE(i.is_personal, 0) = ?');
    binds.push(filters.personal === 'yes' ? 1 : 0);
  }
  return {
    sql: clauses.join(' AND '),
    binds,
  };
}

export function mapInventoryRow(
  row: InventoryItemRow & { source_listing_price_asking?: number | null },
): Record<string, unknown> {
  return {
    id: String(row.id),
    sourceListingId: row.source_listing_id != null ? String(row.source_listing_id) : null,
    ccgNumber: row.ccg_number,
    imageUrl: toAdminImageUrl(row.image_url, 'thumb'),
    imageUrls: parseStoredInventoryImageUrls(row.image_urls, row.image_url),
    title: row.title,
    quantity: Number(row.quantity ?? 0),
    categoryId: row.category_id,
    categoryName: row.category_name || '',
    categoryPath: row.category_path || row.category_name || '',
    secondaryCategoryId: row.secondary_category_id,
    secondaryCategoryName: row.secondary_category_name || '',
    secondaryCategoryPath: row.secondary_category_path || row.secondary_category_name || '',
    brand: row.brand || '',
    queue: row.queue || 'Triage',
    yearRange: row.year_range || '',
    model: row.model || '',
    finish: row.finish || '',
    repairNotes: row.repair_notes || '',
    originalListingDesc: row.original_listing_desc || '',
    videoUrl: row.video_url || '',
    saleTitle: row.sale_title || '',
    regularPrice: row.regular_price ?? null,
    salePrice: row.sale_price ?? 0,
    condition: row.condition || '',
    allowShipping: Boolean(row.allow_shipping),
    saleDescription: row.sale_description || '',
    barcode: row.barcode || '',
    purchasedDate: row.purchased_date || '',
    unitPurchasePrice: row.unit_purchase_price,
    mapPrice: row.map_price,
    privatePartyValue: row.private_party_value,
    miles: Number(row.miles || 0),
    minutesSpent: Number(row.minutes_spent || 0),
    shipCost: Number(row.ship_cost || 0),
    purchaseNotes: row.purchase_notes || '',
    aiAnalysisText: row.ai_analysis_text || '',
    serialNumber: row.serial_number || '',
    isActive: Boolean(row.is_active),
    isMarked: Boolean(row.is_marked),
    isPersonal: Boolean(row.is_personal),
    isRented: Boolean(row.is_rented),
    forSale: Boolean(row.for_sale),
    onlyInStore: Boolean(row.only_in_store),
    forSaleDate: row.for_sale_date || null,
    isSold: Boolean(row.is_sold),
    soldDate: row.sold_date || null,
    soldAmount: row.sold_amount,
    sellNotes: row.sell_notes || '',
    saleUrl: row.sale_url || '',
    merchantCenterCatCode: row.merchant_center_cat_code || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    sourceListingPriceAsking: row.source_listing_price_asking ?? null,
  };
}

type CloudflareImagePreset = 'thumb' | 'card' | 'detail';

const CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS: Record<CloudflareImagePreset, string> = {
  thumb: 'fit=scale-down,width=180,quality=80,format=auto,onerror=redirect',
  card: 'fit=scale-down,width=640,quality=82,format=auto,onerror=redirect',
  detail: 'fit=scale-down,width=1400,quality=85,format=auto,onerror=redirect',
};

function toAdminImageUrl(value: unknown, preset?: CloudflareImagePreset): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (!preset) return raw;
  const options = CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS[preset];
  return `/cdn-cgi/image/${options}/${raw}`;
}

export async function dbListInventoryItems(
  filters: InventoryListFilters,
  env: Env,
): Promise<{ records: Array<Record<string, unknown>>; total: number; page: number; limit: number; totalPages: number }> {
  const clause = inventoryFilterClause(filters);
  const orderBy = inventoryOrderBySql(filters.sortBy, filters.sortDir);

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM ccg_inventory_items i
     WHERE ${clause.sql}`
  ).bind(...clause.binds).first<{ total: number | null }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const safePage = Math.min(filters.page, totalPages);
  const safeOffset = (safePage - 1) * filters.limit;

  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.source_listing_id,
       i.ccg_number,
       i.image_url,
       i.image_urls,
       i.title,
       i.quantity,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.brand,
       i.queue,
       i.year_range,
       i.model,
       i.finish,
       i.repair_notes,
       i.original_listing_desc,
       i.video_url,
       i.sale_title,
       i.regular_price,
       i.sale_price,
       i.condition,
       i.allow_shipping,
       i.sale_description,
       i.barcode,
       i.purchased_date,
       i.unit_purchase_price,
       i.map_price,
       i.private_party_value,
       i.miles,
       i.minutes_spent,
       i.ship_cost,
       i.purchase_notes,
       i.ai_analysis_text,
       i.serial_number,
       i.is_active,
       i.is_marked,
       i.is_personal,
       i.is_rented,
       i.for_sale,
       i.only_in_store,
       i.for_sale_date,
       i.is_sold,
       i.sold_date,
       i.sold_amount,
       i.sell_notes,
       i.sale_url,
       i.created_at,
       i.updated_at,
       l.price_asking AS source_listing_price_asking
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     LEFT JOIN listings l ON l.id = i.source_listing_id
     WHERE ${clause.sql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`
  ).bind(...clause.binds, filters.limit, safeOffset).all<InventoryItemRow & {
    source_listing_price_asking: number | null;
  }>();

  return {
    records: (result.results ?? []).map((row) => mapInventoryRow(row)),
    total,
    page: safePage,
    limit: filters.limit,
    totalPages,
  };
}

export async function dbListInventoryBrands(
  filters: Pick<InventoryListFilters, 'categoryId' | 'sold' | 'active' | 'marked' | 'personal' | 'queue'>,
  env: Env,
): Promise<string[]> {
  const clause = inventoryFilterClause({ ...filters, brand: '' });
  const result = await env.DB.prepare(
    `SELECT DISTINCT TRIM(COALESCE(i.brand, '')) AS brand
     FROM ccg_inventory_items i
     WHERE ${clause.sql}
       AND TRIM(COALESCE(i.brand, '')) <> ''
     ORDER BY LOWER(TRIM(COALESCE(i.brand, ''))) ASC`
  ).bind(...clause.binds).all<{ brand: string | null }>();
  return (result.results ?? [])
    .map((row) => String(row.brand || '').trim())
    .filter(Boolean);
}

export async function dbGetInventoryItem(recordId: string, env: Env): Promise<Record<string, unknown> | null> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return null;
  const row = await env.DB.prepare(
    `SELECT
      i.id,
      i.source_listing_id,
      i.ccg_number,
      i.image_url,
      i.image_urls,
      i.title,
      i.quantity,
      ${INVENTORY_CATEGORY_SELECT_SQL},
      i.brand,
      i.queue,
      i.year_range,
      i.model,
      i.finish,
      i.repair_notes,
      i.original_listing_desc,
      i.video_url,
      i.sale_title,
      i.regular_price,
      i.sale_price,
      i."condition",
      i.allow_shipping,
      i.sale_description,
      i.clearance,
      i.bullet_1_text,
      i.bullet_1_danger,
      i.bullet_1_highlight,
      i.bullet_2_text,
      i.bullet_2_danger,
      i.bullet_2_highlight,
      i.bullet_3_text,
      i.bullet_3_danger,
      i.bullet_3_highlight,
      i.bullet_4_text,
      i.bullet_4_danger,
      i.bullet_4_highlight,
      i.bullet_5_text,
      i.bullet_5_danger,
      i.bullet_5_highlight,
      i.bullet_6_text,
      i.bullet_6_danger,
      i.bullet_6_highlight,
      i.barcode,
      i.purchased_date,
      i.unit_purchase_price,
      i.map_price,
      i.private_party_value,
      i.miles,
      i.minutes_spent,
      i.ship_cost,
      i.purchase_notes,
      i.ai_analysis_text,
      i.serial_number,
      i.weight_lbs,
      i.neck_profile,
      i.neck_thickness,
      i.nut_width,
      i.width_12_fret,
      i.fretboard_radius,
      i.twelve_fret_action,
      i.is_active,
      i.is_marked,
      i.is_personal,
      i.is_rented,
      i.is_custom,
      i.for_sale,
      i.only_in_store,
      i.sales_channel_ccg,
      i.sales_channel_fbm,
      i.sales_channel_cl,
      i.sales_channel_reverb,
      i.sales_channel_gear_exchange,
      i.sales_channel_offerup,
      i.sales_channel_ebay,
      i.sales_channel_nextdoor,
      i.sales_channel_other,
      i.for_sale_date,
      i.is_sold,
      i.sold_date,
      i.sold_amount,
      i.sell_notes,
      i.subscription_id,
      i.package_id,
      i.sale_url,
      i.sale_zip,
      i.storage_location,
      i.sold_channel,
      i.merchant_center_cat_code,
      i.created_at,
      i.updated_at
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE i.id = ?`
  ).bind(idValue).first<InventoryItemRow>();
  if (!row) return null;
  const storedImages = await dbListInventoryImagesForItemIds([row.id], env);
  const imageDetails = storedImages.get(row.id) ?? [];
  const imageUrls = imageDetails.length > 0
    ? imageDetails.map((image) => image.url)
    : parseStoredInventoryImageUrls(row.image_urls, row.image_url);
  return {
    id: String(row.id),
    sourceListingId: row.source_listing_id != null ? String(row.source_listing_id) : null,
    ccgNumber: row.ccg_number,
    imageUrl: imageUrls[0] ?? row.image_url,
    imageUrls,
    images: imageDetails,
    title: row.title,
    quantity: Number(row.quantity ?? 0),
    categoryId: row.category_id,
    categoryName: row.category_name || '',
    categoryPath: row.category_path || row.category_name || '',
    secondaryCategoryId: row.secondary_category_id,
    secondaryCategoryName: row.secondary_category_name || '',
    secondaryCategoryPath: row.secondary_category_path || row.secondary_category_name || '',
    brand: row.brand || '',
    queue: row.queue || 'Triage',
    yearRange: row.year_range || '',
    model: row.model || '',
    finish: row.finish || '',
    repairNotes: row.repair_notes || '',
    originalListingDesc: row.original_listing_desc || '',
    videoUrl: row.video_url || '',
    saleTitle: row.sale_title || '',
    regularPrice: row.regular_price ?? null,
    salePrice: row.sale_price ?? 0,
    condition: row.condition || '',
    allowShipping: Boolean(row.allow_shipping),
    saleDescription: row.sale_description || '',
    clearance: Boolean(row.clearance),
    bullet1Text: row.bullet_1_text || '',
    bullet1Danger: Boolean(row.bullet_1_danger),
    bullet1Highlight: Boolean(row.bullet_1_highlight),
    bullet2Text: row.bullet_2_text || '',
    bullet2Danger: Boolean(row.bullet_2_danger),
    bullet2Highlight: Boolean(row.bullet_2_highlight),
    bullet3Text: row.bullet_3_text || '',
    bullet3Danger: Boolean(row.bullet_3_danger),
    bullet3Highlight: Boolean(row.bullet_3_highlight),
    bullet4Text: row.bullet_4_text || '',
    bullet4Danger: Boolean(row.bullet_4_danger),
    bullet4Highlight: Boolean(row.bullet_4_highlight),
    bullet5Text: row.bullet_5_text || '',
    bullet5Danger: Boolean(row.bullet_5_danger),
    bullet5Highlight: Boolean(row.bullet_5_highlight),
    bullet6Text: row.bullet_6_text || '',
    bullet6Danger: Boolean(row.bullet_6_danger),
    bullet6Highlight: Boolean(row.bullet_6_highlight),
    barcode: row.barcode || '',
    purchasedDate: row.purchased_date || '',
    unitPurchasePrice: row.unit_purchase_price,
    mapPrice: row.map_price,
    privatePartyValue: row.private_party_value,
    miles: Number(row.miles || 0),
    minutesSpent: Number(row.minutes_spent || 0),
    shipCost: Number(row.ship_cost || 0),
    purchaseNotes: row.purchase_notes || '',
    aiAnalysisText: row.ai_analysis_text || '',
    serialNumber: row.serial_number || '',
    weightLbs: row.weight_lbs || '',
    neckProfile: row.neck_profile || '',
    neckThickness: row.neck_thickness || '',
    nutWidth: row.nut_width || '',
    width12Fret: row.width_12_fret || '',
    fretboardRadius: row.fretboard_radius || '',
    twelveFretAction: row.twelve_fret_action || '',
    isActive: Boolean(row.is_active),
    isMarked: Boolean(row.is_marked),
    isPersonal: Boolean(row.is_personal),
    isRented: Boolean(row.is_rented),
    isCustom: Boolean(row.is_custom),
    forSale: Boolean(row.for_sale),
    onlyInStore: Boolean(row.only_in_store),
    salesChannelCcg: Boolean(row.sales_channel_ccg),
    salesChannelFbm: Boolean(row.sales_channel_fbm),
    salesChannelCl: Boolean(row.sales_channel_cl),
    salesChannelReverb: Boolean(row.sales_channel_reverb),
    salesChannelGearExchange: Boolean(row.sales_channel_gear_exchange),
    salesChannelOfferUp: Boolean(row.sales_channel_offerup),
    salesChannelEbay: Boolean(row.sales_channel_ebay),
    salesChannelNextdoor: Boolean(row.sales_channel_nextdoor),
    salesChannelOther: Boolean(row.sales_channel_other),
    forSaleDate: row.for_sale_date || null,
    isSold: Boolean(row.is_sold),
    soldDate: row.sold_date || null,
    soldAmount: row.sold_amount,
    sellNotes: row.sell_notes || '',
    subscriptionId: row.subscription_id ?? null,
    packageId: row.package_id ?? null,
    saleUrl: row.sale_url || '',
    saleZip: row.sale_zip || '',
    storageLocation: row.storage_location || '',
    soldChannel: row.sold_channel || '',
    merchantCenterCatCode: row.merchant_center_cat_code || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export async function dbFindInventoryBySourceListingId(sourceListingId: number, env: Env): Promise<{ id: number } | null> {
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_items WHERE source_listing_id = ? LIMIT 1'
  ).bind(sourceListingId).first<{ id: number }>();
  return row || null;
}

export async function dbFindInventoryBySaleUrl(
  saleUrl: string,
  env: Env,
  excludeId?: string,
): Promise<{ id: number; ccg_number: string | null; title: string | null } | null> {
  const normalizedSaleUrl = saleUrl.trim();
  if (!normalizedSaleUrl) return null;

  const excludeRecordId = Number(excludeId || 0);
  if (Number.isFinite(excludeRecordId) && excludeRecordId > 0) {
    const row = await env.DB.prepare(
      `SELECT id, ccg_number, title
       FROM ccg_inventory_items
       WHERE LOWER(sale_url) = LOWER(?)
         AND id != ?
       LIMIT 1`
    ).bind(normalizedSaleUrl, excludeRecordId).first<{ id: number; ccg_number: string | null; title: string | null }>();
    return row || null;
  }

  const row = await env.DB.prepare(
    `SELECT id, ccg_number, title
     FROM ccg_inventory_items
     WHERE LOWER(sale_url) = LOWER(?)
     LIMIT 1`
  ).bind(normalizedSaleUrl).first<{ id: number; ccg_number: string | null; title: string | null }>();
  return row || null;
}

export async function dbFindRecentDuplicateInventoryCreate(
  fields: {
    source_listing_id: number | null;
    image_url: string;
    title: string;
    category_id: number;
    secondary_category_id: number | null;
    brand: string | null;
    year_range: string | null;
    model: string | null;
    finish: string | null;
    purchased_date: string;
    unit_purchase_price: number | null;
  },
  env: Env
): Promise<{ id: number; ccg_number: string } | null> {
  if (fields.source_listing_id != null) {
    const row = await env.DB.prepare(
      'SELECT id, ccg_number FROM ccg_inventory_items WHERE source_listing_id = ? LIMIT 1'
    ).bind(fields.source_listing_id).first<{ id: number; ccg_number: string }>();
    return row || null;
  }

  const row = await env.DB.prepare(
    `SELECT id, ccg_number
     FROM ccg_inventory_items
     WHERE source_listing_id IS NULL
       AND title = ?
       AND image_url = ?
       AND category_id = ?
       AND ((secondary_category_id IS NULL AND ? IS NULL) OR secondary_category_id = ?)
       AND IFNULL(brand, '') = ?
       AND IFNULL(year_range, '') = ?
       AND IFNULL(model, '') = ?
       AND IFNULL(finish, '') = ?
       AND purchased_date = ?
       AND ((unit_purchase_price IS NULL AND ? IS NULL) OR unit_purchase_price = ?)
       AND created_at >= datetime('now', '-2 minutes')
     ORDER BY id DESC
     LIMIT 1`
  ).bind(
    fields.title,
    fields.image_url,
    fields.category_id,
    fields.secondary_category_id,
    fields.secondary_category_id,
    fields.brand || '',
    fields.year_range || '',
    fields.model || '',
    fields.finish || '',
    fields.purchased_date,
    fields.unit_purchase_price,
    fields.unit_purchase_price,
  ).first<{ id: number; ccg_number: string }>();
  return row || null;
}

export async function dbCcgNumberExists(ccgNumber: string, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_items WHERE ccg_number = ? LIMIT 1'
  ).bind(ccgNumber).first<{ id: number }>();
  return Boolean(row?.id);
}

export async function dbInventoryItemHasPackageChildren(recordId: number, env: Env): Promise<boolean> {
  if (!Number.isFinite(recordId) || recordId <= 0) return false;
  const row = await env.DB.prepare(
    'SELECT id FROM ccg_inventory_items WHERE package_id = ? LIMIT 1'
  ).bind(recordId).first<{ id: number }>();
  return Boolean(row?.id);
}
