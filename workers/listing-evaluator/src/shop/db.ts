import type { Env } from '../env.js';
import type { ShopProductRow } from '../types/inventory.js';
import type { ShopCheckoutInventoryRow } from '../types/orders.js';
import { normalizeText, expandInventoryCategoryIds, parseOptionalPositiveInt } from '../utils/misc.js';
import { toPublicShopImageUrl, parseStoredInventoryImageUrls } from '../utils/image.js';
import { getInventoryCategoryLabel, dbListInventoryCategories } from '../inventory/categories.js';
import { getShopRuntimeSettings } from '../system/runtime.js';
import {
  INVENTORY_CATEGORY_SELECT_SQL,
  INVENTORY_CATEGORY_JOIN_SQL,
} from '../inventory/db-core.js';
import {
  normalizeGoogleMerchantCondition,
  normalizeMerchantDescription,
  normalizeMerchantGtin,
  normalizeMerchantShippingWeight,
  buildMerchantProductLink,
  getMerchantProductId,
  MERCHANT_CENTER_CATEGORY_MAP,
} from './merchant.js';
import type { GoogleMerchantFeedProduct } from './merchant.js';

export function slugifyShopCategory(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSaleUrlSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

export async function dbListShopProducts(
  filters: {
    categoryIds: number[];
    search: string;
    brands: string[];
    sort: string;
    randomSeed: string;
    showSold: boolean;
    associateMode: boolean;
    priceMin: number;
    priceMax: number;
    condition: string;
  },
  env: Env,
): Promise<{ records: Array<Record<string, unknown>>; brands: string[] }> {
  const categoryRows = await dbListInventoryCategories(env);
  const allowedCategoryIds = expandInventoryCategoryIds(filters.categoryIds, categoryRows);

  const baseClauses: string[] = [
    'COALESCE(i.is_active, 0) = 1',
    filters.showSold ? 'COALESCE(i.is_sold, 0) = 1' : 'COALESCE(i.is_sold, 0) = 0',
  ];
  const baseBinds: unknown[] = [];

  if (!filters.showSold) {
    baseClauses.push('COALESCE(i.for_sale, 0) = 1');
  }
  if (!filters.associateMode) {
    baseClauses.push('COALESCE(i.only_in_store, 0) = 0');
  }
  baseClauses.push('COALESCE(i.is_rented, 0) = 0');

  if (allowedCategoryIds.length > 0) {
    const placeholders = allowedCategoryIds.map(() => '?').join(', ');
    baseClauses.push(`(
      i.category_id IN (${placeholders})
      OR COALESCE(i.secondary_category_id, 0) IN (${placeholders})
    )`);
    baseBinds.push(...allowedCategoryIds, ...allowedCategoryIds);
  }

  if (filters.search) {
    baseClauses.push(`(
      LOWER(COALESCE(i.sale_title, '')) LIKE ?
      OR LOWER(COALESCE(i.title, '')) LIKE ?
    )`);
    const term = `%${filters.search.toLowerCase()}%`;
    baseBinds.push(term, term);
  }

  if (filters.condition) {
    baseClauses.push('LOWER(COALESCE(i."condition", \'\')) = LOWER(?)');
    baseBinds.push(filters.condition);
  }

  if (!(filters.priceMin === 0 && filters.priceMax === 0)) {
    baseClauses.push(`(
      CASE
        WHEN COALESCE(i.sale_price, 0) > 0 THEN COALESCE(i.sale_price, 0)
        ELSE COALESCE(i.regular_price, 0)
      END
    ) >= ? AND (
      CASE
        WHEN COALESCE(i.sale_price, 0) > 0 THEN COALESCE(i.sale_price, 0)
        ELSE COALESCE(i.regular_price, 0)
      END
    ) <= ?`);
    baseBinds.push(filters.priceMin, filters.priceMax > 0 ? filters.priceMax : Number.MAX_SAFE_INTEGER);
  }

  const brandWhereSql = baseClauses.join(' AND ');
  const brandResult = await env.DB.prepare(
    `SELECT DISTINCT TRIM(i.brand) AS brand
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE ${brandWhereSql}
       AND TRIM(COALESCE(i.brand, '')) <> ''
     ORDER BY LOWER(TRIM(i.brand)) ASC`
  ).bind(...baseBinds).all<{ brand: string }>();
  const brands = (brandResult.results ?? [])
    .map((row) => normalizeText(row.brand, ''))
    .filter(Boolean);

  const clauses = [...baseClauses];
  const binds = [...baseBinds];
  if (filters.brands.length > 0) {
    const placeholders = filters.brands.map(() => '?').join(', ');
    clauses.push(`LOWER(TRIM(COALESCE(i.brand, ''))) IN (${placeholders})`);
    binds.push(...filters.brands.map((brand) => brand.toLowerCase()));
  }

  const whereSql = clauses.join(' AND ');
  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM ccg_inventory_item_images sii_exists
           WHERE sii_exists.inventory_item_id = i.id
         ) THEN COALESCE((
           SELECT sii.image_url
           FROM ccg_inventory_item_images sii
           WHERE sii.inventory_item_id = i.id
             AND COALESCE(sii.is_private, 0) = 0
           ORDER BY sii.display_order ASC, sii.id ASC
           LIMIT 1
         ), '')
         ELSE i.image_url
       END AS image_url,
       i.title,
       i.sale_title,
       i.sale_url,
       i.quantity,
       i.regular_price,
       i.sale_price,
       i.clearance,
       i.allow_shipping,
       i.only_in_store,
       i."condition",
       i.brand,
       i.sale_description,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE ${whereSql}
     ORDER BY ${shopProductOrderBySql(filters.sort)}`
  ).bind(...binds).all<ShopProductRow>();

  const records = (result.results ?? []).map((row) => {
    const mainImage = toPublicShopImageUrl(row.image_url, 'card');
    return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    mainImage,
    saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
    saleUrlSlug: normalizeText(row.sale_url, ''),
    quantity: Number(row.quantity ?? 0),
    saleCondition: row.condition || '',
    saleDescription: row.sale_description || '',
    regularPrice: row.regular_price,
    salePrice: row.sale_price ?? 0,
    clearance: Boolean(row.clearance),
    category: getInventoryCategoryLabel(row),
    primaryCategoryName: normalizeText(row.category_name, ''),
    secondaryCategory: normalizeText(row.secondary_category_name, ''),
    allowShipping: Boolean(row.allow_shipping),
    onlyInStore: Boolean(row.only_in_store),
    isSold: Boolean(row.is_sold),
    };
  });
  return {
    records: filters.randomSeed ? balancedRandomizeShopProducts(records, filters.randomSeed) : records,
    brands,
  };
}

export function shopProductOrderBySql(sort: string): string {
  const priceSql = `CASE
        WHEN COALESCE(i.sale_price, 0) > 0 THEN COALESCE(i.sale_price, 0)
        ELSE COALESCE(i.regular_price, 0)
      END`;

  switch (sort) {
    case 'brand-az':
      return `LOWER(COALESCE(NULLIF(TRIM(i.brand), ''), 'zzzz')) ASC,
       LOWER(COALESCE(NULLIF(TRIM(i.sale_title), ''), i.title, '')) ASC,
       i.id DESC`;
    case 'price-low-high':
      return `${priceSql} ASC,
       LOWER(COALESCE(NULLIF(TRIM(i.sale_title), ''), i.title, '')) ASC,
       i.id DESC`;
    case 'price-high-low':
      return `${priceSql} DESC,
       LOWER(COALESCE(NULLIF(TRIM(i.sale_title), ''), i.title, '')) ASC,
       i.id DESC`;
    case 'popular':
    default:
      return `CASE
         WHEN LOWER(COALESCE(gp.name, p.name, c.name, '')) LIKE 'package%' THEN 0
         WHEN LOWER(COALESCE(gp.name, p.name, c.name, '')) IN ('guitar', 'guitars') THEN 1
         ELSE 2
       END ASC,
       COALESCE(i.created_at, '') DESC,
       i.id DESC`;
  }
}

export function balancedRandomizeShopProducts(
  records: Array<Record<string, unknown>>,
  seed: string,
): Array<Record<string, unknown>> {
  if (records.length < 2) return records;

  const groups = new Map<string, Array<{
    record: Record<string, unknown>;
    priceBand: string;
    randomScore: number;
  }>>();

  records.forEach((record, index) => {
    const categoryKey = normalizeText(
      record.primaryCategoryName,
      normalizeText(record.category, 'Other'),
    ).toLowerCase() || 'other';
    const salePrice = typeof record.salePrice === 'number' ? record.salePrice : 0;
    const regularPrice = typeof record.regularPrice === 'number' ? record.regularPrice : 0;
    const price = salePrice > 0 ? salePrice : regularPrice;
    const item = {
      record,
      priceBand: getShopProductPriceBand(price),
      randomScore: seededUnitScore(`${seed}:${record.id ?? index}`),
    };
    const group = groups.get(categoryKey) ?? [];
    group.push(item);
    groups.set(categoryKey, group);
  });

  for (const group of groups.values()) {
    group.sort((a, b) => a.randomScore - b.randomScore);
  }

  const output: Array<Record<string, unknown>> = [];
  let lastCategory = '';
  let lastPriceBand = '';

  while (output.length < records.length) {
    const candidates = Array.from(groups.entries())
      .filter(([, group]) => group.length > 0)
      .sort((a, b) => {
        if (a[0] === lastCategory && b[0] !== lastCategory) return 1;
        if (b[0] === lastCategory && a[0] !== lastCategory) return -1;
        if (b[1].length !== a[1].length) return b[1].length - a[1].length;
        return seededUnitScore(`${seed}:category:${a[0]}:${output.length}`)
          - seededUnitScore(`${seed}:category:${b[0]}:${output.length}`);
      });

    const selectedCategory = candidates[0]?.[0];
    if (!selectedCategory) break;

    const group = groups.get(selectedCategory);
    if (!group || group.length === 0) break;
    let selectedIndex = group.findIndex((item) => item.priceBand !== lastPriceBand);
    if (selectedIndex < 0) selectedIndex = 0;
    const [selected] = group.splice(selectedIndex, 1);
    if (!selected) continue;

    output.push(selected.record);
    lastCategory = selectedCategory;
    lastPriceBand = selected.priceBand;
  }

  return output.length === records.length ? output : records;
}

function getShopProductPriceBand(price: number): string {
  if (price < 25) return 'under-25';
  if (price < 75) return '25-74';
  if (price < 200) return '75-199';
  if (price < 500) return '200-499';
  if (price < 1000) return '500-999';
  return '1000-plus';
}

function seededUnitScore(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export async function dbSearchShopProductsByTitle(
  query: string,
  env: Env,
  options: { associateMode: boolean },
): Promise<Array<Record<string, unknown>>> {
  const term = `%${query.toLowerCase()}%`;
  const onlyInStoreClause = options.associateMode ? '' : '       AND COALESCE(i.only_in_store, 0) = 0\n';
  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM ccg_inventory_item_images sii_exists
           WHERE sii_exists.inventory_item_id = i.id
         ) THEN COALESCE((
           SELECT sii.image_url
           FROM ccg_inventory_item_images sii
           WHERE sii.inventory_item_id = i.id
             AND COALESCE(sii.is_private, 0) = 0
           ORDER BY sii.display_order ASC, sii.id ASC
           LIMIT 1
         ), '')
         ELSE i.image_url
       END AS image_url,
       i.title,
       i.sale_title,
       i.sale_url,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_active, 0) = 1
       AND COALESCE(i.for_sale, 0) = 1
       AND COALESCE(i.is_sold, 0) = 0
${onlyInStoreClause}       AND COALESCE(i.is_rented, 0) = 0
       AND LOWER(COALESCE(NULLIF(TRIM(i.sale_title), ''), i.title, '')) LIKE ?
     ORDER BY
       LOWER(COALESCE(NULLIF(TRIM(i.sale_title), ''), i.title, '')) ASC,
       i.id DESC
     LIMIT 10`
  ).bind(term).all<ShopProductRow>();

  return (result.results ?? []).map((row) => {
    const mainImage = toPublicShopImageUrl(row.image_url, 'thumb');

    return {
      id: String(row.id),
      ccgNumber: normalizeText(row.ccg_number, ''),
      mainImage,
      saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
      saleUrlSlug: normalizeText(row.sale_url, ''),
      primaryCategoryName: normalizeText(row.category_name, ''),
      isSold: Boolean(row.is_sold),
    };
  });
}

export async function dbFindShopProductByBarcode(
  barcode: string,
  env: Env,
  options: { associateMode: boolean },
): Promise<Record<string, unknown> | null> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) return null;

  const onlyInStoreClause = options.associateMode ? '' : '       AND COALESCE(i.only_in_store, 0) = 0\n';
  const row = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM ccg_inventory_item_images sii_exists
           WHERE sii_exists.inventory_item_id = i.id
         ) THEN COALESCE((
           SELECT sii.image_url
           FROM ccg_inventory_item_images sii
           WHERE sii.inventory_item_id = i.id
             AND COALESCE(sii.is_private, 0) = 0
           ORDER BY sii.display_order ASC, sii.id ASC
           LIMIT 1
         ), '')
         ELSE i.image_url
       END AS image_url,
       i.title,
       i.sale_title,
       i.sale_url,
       i.barcode,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_active, 0) = 1
       AND COALESCE(i.for_sale, 0) = 1
       AND COALESCE(i.is_sold, 0) = 0
${onlyInStoreClause}       AND COALESCE(i.is_rented, 0) = 0
       AND TRIM(COALESCE(i.barcode, '')) = ?
     ORDER BY i.id DESC
     LIMIT 1`
  ).bind(normalizedBarcode).first<ShopProductRow>();

  if (!row) return null;

  const mainImage = toPublicShopImageUrl(row.image_url, 'thumb');

  return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    mainImage,
    saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
    saleUrlSlug: normalizeText(row.sale_url, ''),
    primaryCategoryName: normalizeText(row.category_name, ''),
    isSold: Boolean(row.is_sold),
  };
}

export async function dbListShopSitemapProducts(env: Env): Promise<Array<Record<string, unknown>>> {
  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.sale_url,
       i.updated_at,
       i.for_sale,
       i.is_sold,
       ${INVENTORY_CATEGORY_SELECT_SQL}
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_active, 0) = 1
       AND COALESCE(i.only_in_store, 0) = 0
       AND COALESCE(i.is_rented, 0) = 0
       AND TRIM(COALESCE(i.sale_url, '')) != ''
     ORDER BY
       c."order" ASC,
       LOWER(COALESCE(i.sale_title, i.title, '')) ASC,
       i.id DESC`
  ).all<ShopProductRow & { updated_at: string | null }>();

  return (result.results ?? []).map((row) => {
    const categorySlug = slugifyShopCategory(normalizeText(row.category_name, ''));
    const productSlug = normalizeText(row.sale_url, '');
    if (!isValidSaleUrlSlug(productSlug)) return null;
    return {
      id: String(row.id),
      urlPath: categorySlug && productSlug
        ? `/guitars-and-gear-for-sale/${categorySlug}/${productSlug}`
        : '',
      updatedAt: normalizeText(row.updated_at, ''),
      forSale: Boolean(row.for_sale),
      isSold: Boolean(row.is_sold),
    };
  }).filter((record): record is Record<string, unknown> => Boolean(record?.urlPath));
}

export async function dbListGoogleMerchantProducts(env: Env): Promise<GoogleMerchantFeedProduct[]> {
  const baseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const result = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM ccg_inventory_item_images sii_exists
           WHERE sii_exists.inventory_item_id = i.id
         ) THEN COALESCE((
           SELECT sii.image_url
           FROM ccg_inventory_item_images sii
           WHERE sii.inventory_item_id = i.id
             AND COALESCE(sii.is_private, 0) = 0
           ORDER BY sii.display_order ASC, sii.id ASC
           LIMIT 1
         ), '')
         ELSE i.image_url
       END AS image_url,
       COALESCE((
         SELECT GROUP_CONCAT(sii.image_url, CHAR(31))
         FROM ccg_inventory_item_images sii
         WHERE sii.inventory_item_id = i.id
           AND COALESCE(sii.is_private, 0) = 0
       ), '') AS feed_image_urls,
       i.image_urls,
       i.title,
       i.sale_title,
       i.sale_url,
       i.quantity,
       i.regular_price,
       i.sale_price,
       i."condition",
       i.brand,
       i.barcode,
       i.sale_description,
       i.weight_lbs,
       i.allow_shipping,
       i.merchant_center_cat_code,
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_active, 0) = 1
       AND COALESCE(i.for_sale, 0) = 1
       AND COALESCE(i.is_sold, 0) = 0
       AND COALESCE(i.only_in_store, 0) = 0
       AND COALESCE(i.is_rented, 0) = 0
       AND TRIM(COALESCE(i.sale_url, '')) != ''
       AND (
         CASE
           WHEN COALESCE(i.sale_price, 0) > 0 THEN COALESCE(i.sale_price, 0)
           ELSE COALESCE(i.regular_price, 0)
         END
       ) > 0
     ORDER BY
       c."order" ASC,
       LOWER(COALESCE(i.sale_title, i.title, '')) ASC,
       i.id DESC`
  ).all<ShopProductRow & { feed_image_urls: string | null }>();

  return (result.results ?? []).map((row) => {
    const title = normalizeText(row.sale_title, '') || normalizeText(row.title, '');
    const link = buildMerchantProductLink(row, baseUrl);
    const regularPrice = Number(row.regular_price ?? row.sale_price ?? 0);
    const salePrice = Number(row.sale_price ?? 0);
    const effectivePrice = salePrice > 0 ? salePrice : regularPrice;
    const feedImages = normalizeText(row.feed_image_urls, '')
      .split(String.fromCharCode(31))
      .map((imageUrl) => toPublicShopImageUrl(imageUrl, 'detail'))
      .filter(Boolean);
    const storedImages = parseStoredInventoryImageUrls(row.image_urls || null, row.image_url || null)
      .map((imageUrl) => toPublicShopImageUrl(imageUrl, 'detail'))
      .filter(Boolean);
    const images = Array.from(new Set([
      toPublicShopImageUrl(row.image_url, 'detail'),
      ...feedImages,
      ...storedImages,
    ].filter(Boolean)));
    const gtin = normalizeMerchantGtin(row.barcode);
    const productType = normalizeText(row.category_path || row.category_name, '');
    const shippingWeight = normalizeMerchantShippingWeight(row.weight_lbs);
    if (!title || !link || images.length === 0 || effectivePrice <= 0) return null;

    return {
      id: getMerchantProductId(row),
      title: title.slice(0, 150),
      description: normalizeMerchantDescription(row.sale_description, title),
      link,
      imageLink: images[0],
      additionalImageLinks: images.slice(1),
      availability: Number(row.quantity ?? 0) > 0 ? 'in stock' : 'out of stock',
      price: regularPrice > 0 ? regularPrice : effectivePrice,
      salePrice: salePrice > 0 && salePrice < regularPrice ? salePrice : 0,
      condition: normalizeGoogleMerchantCondition(row.condition),
      brand: normalizeText(row.brand, ''),
      gtin,
      identifierExists: Boolean(gtin),
      productType,
      shippingWeight,
      allowShipping: Boolean(row.allow_shipping),
      googleProductCategory: MERCHANT_CENTER_CATEGORY_MAP[normalizeText(row.merchant_center_cat_code, '')] ?? '',
    };
  }).filter((record): record is GoogleMerchantFeedProduct => Boolean(record));
}

export async function dbCreateNewsletterSubscriber(email: string, env: Env): Promise<boolean> {
  const existing = await env.DB.prepare(
    `SELECT 1 FROM email_newsletter WHERE LOWER(email) = LOWER(?) LIMIT 1`
  ).bind(email).first();
  if (existing) return false;

  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO email_newsletter (email)
     VALUES (?)`
  ).bind(email).run();
  return Number((result as any)?.meta?.changes || 0) > 0;
}

export async function dbGetShopProductDetail(
  lookup: { id: number } | { slug: string },
  env: Env,
  options: { includeInStoreOnly?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  const lookupClause = 'id' in lookup ? 'i.id = ?' : 'LOWER(i.sale_url) = LOWER(?)';
  const lookupValue = 'id' in lookup ? lookup.id : lookup.slug;
  const row = await env.DB.prepare(
    `SELECT
       i.id,
       i.ccg_number,
       i.image_url,
       i.image_urls,
       i.title,
       i.quantity,
       i.sale_title,
       i.sale_url,
       i.sale_zip,
       i.brand,
       i.model,
       i.finish,
       i.video_url,
       i.weight_lbs,
       i.neck_profile,
       i.neck_thickness,
       i.nut_width,
       i.width_12_fret,
       i.fretboard_radius,
       i.twelve_fret_action,
       i.regular_price,
       i.sale_price,
       i.clearance,
       i.allow_shipping,
       i.only_in_store,
       i."condition",
       i.sale_description,
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
       ${INVENTORY_CATEGORY_SELECT_SQL},
       i.for_sale,
       i.is_sold
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE ${lookupClause}
       AND COALESCE(i.is_active, 0) = 1
       ${options.includeInStoreOnly ? '' : 'AND COALESCE(i.only_in_store, 0) = 0'}
       AND COALESCE(i.is_rented, 0) = 0
     LIMIT 1`
  ).bind(lookupValue).first<ShopProductRow>();

  if (!row) return null;

  const imageRows = await env.DB.prepare(
    `SELECT image_url, is_private
     FROM ccg_inventory_item_images
     WHERE inventory_item_id = ?
     ORDER BY display_order ASC, id ASC`
  ).bind(row.id).all<{ image_url: string | null; is_private: number | null }>();

  const storedImageRows = imageRows.results ?? [];
  const sourceImages = storedImageRows.length > 0
    ? storedImageRows
      .filter((imageRow) => !imageRow.is_private)
      .map((imageRow) => imageRow.image_url)
    : parseStoredInventoryImageUrls(row.image_urls || null, row.image_url || null);
  const images = Array.from(new Set(sourceImages.map((imageUrl) => toPublicShopImageUrl(imageUrl, 'detail')).filter(Boolean)));

  const mainImage = images[0] || '';
  const highlights = [
    { text: normalizeText(row.bullet_1_text, ''), danger: Boolean(row.bullet_1_danger), highlight: Boolean(row.bullet_1_highlight) },
    { text: normalizeText(row.bullet_2_text, ''), danger: Boolean(row.bullet_2_danger), highlight: Boolean(row.bullet_2_highlight) },
    { text: normalizeText(row.bullet_3_text, ''), danger: Boolean(row.bullet_3_danger), highlight: Boolean(row.bullet_3_highlight) },
    { text: normalizeText(row.bullet_4_text, ''), danger: Boolean(row.bullet_4_danger), highlight: Boolean(row.bullet_4_highlight) },
    { text: normalizeText(row.bullet_5_text, ''), danger: Boolean(row.bullet_5_danger), highlight: Boolean(row.bullet_5_highlight) },
    { text: normalizeText(row.bullet_6_text, ''), danger: Boolean(row.bullet_6_danger), highlight: Boolean(row.bullet_6_highlight) },
  ].filter((item) => item.text);
  const saleDescriptionPostfix = (await getShopRuntimeSettings(env)).saleDescriptionPostfix;

  return {
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    mainImage,
    images,
    saleTitle: normalizeText(row.sale_title, '') || normalizeText(row.title, ''),
    quantity: Number(row.quantity ?? 1),
    saleUrlSlug: normalizeText(row.sale_url, ''),
    saleZip: normalizeText(row.sale_zip, ''),
    saleCondition: row.condition || '',
    saleDescription: appendSaleDescriptionPostfix(row.sale_description || '', saleDescriptionPostfix),
    highlights,
    brand: normalizeText(row.brand, ''),
    model: normalizeText(row.model, ''),
    finish: normalizeText(row.finish, ''),
    youtubeUrl: normalizeText(row.video_url, ''),
    regularPrice: row.regular_price,
    salePrice: row.sale_price ?? 0,
    clearance: Boolean(row.clearance),
    allowShipping: Boolean(row.allow_shipping),
    onlyInStore: Boolean(row.only_in_store),
    category: getInventoryCategoryLabel(row),
    primaryCategoryName: normalizeText(row.category_name, ''),
    secondaryCategory: normalizeText(row.secondary_category_name, ''),
    forSale: Boolean(row.for_sale),
    guitarSpecs: [
      { label: 'Weight (lbs)', value: normalizeText(row.weight_lbs, '') },
      { label: 'Neck Profile', value: normalizeText(row.neck_profile, '') },
      { label: 'Neck Thickness', value: normalizeText(row.neck_thickness, '') },
      { label: 'Nut Width', value: normalizeText(row.nut_width, '') },
      { label: 'Neck Width (12th Fret)', value: normalizeText(row.width_12_fret, '') },
      { label: 'Fretboard Radius', value: normalizeText(row.fretboard_radius, '') },
      { label: '12th Fret Action', value: normalizeText(row.twelve_fret_action, '') },
    ].filter((item) => item.value && item.value.toLowerCase() !== 'unknown'),
    isSold: Boolean(row.is_sold),
  };
}

export function appendSaleDescriptionPostfix(description: string, postfix: string): string {
  const base = stripKnownSaleDescriptionFooter(normalizeText(description, '').trim());
  const footer = normalizeText(postfix, '').trim();
  if (!footer) return base;

  const baseWithoutConfiguredFooter = stripTrailingText(base, footer);
  const baseWithoutDefaultFooter = stripTrailingText(baseWithoutConfiguredFooter, DEFAULT_SALE_DESCRIPTION_POSTFIX);
  return [baseWithoutDefaultFooter.trim(), footer].filter(Boolean).join('\n\n');
}

const DEFAULT_SALE_DESCRIPTION_POSTFIX = `📍 Local pickup in Englewood, CO

🔐 Come to our shop in Englewood during business hours and give this item (and many others) a try 🔐
Thu: 10am-4pm
Fri: 10am-4pm
Sat: 10am-4pm
Sun: 10am-4pm
Mon: Closed
Tue: Closed
Wed: Closed
** We can still make arrangements for you to see this item outside of business hours.  Just send us a message!

⸻

💳 Payment options:
• Online checkout: credit/debit card and standard Stripe payment methods
• In-store checkout: cash, Venmo, Zelle, CashApp, PayPal, credit/debit card, or financing on eligible larger purchases
• Financing is available in-store only through Affirm or Klarna via Stripe, subject to approval

⸻

Message us with any questions!
info@coalcreekguitars.com
(303) 376-9214 (call or text anytime)

⸻

About Coal Creek Guitars:

Coal Creek Guitars has been serving the Denver area since 2017, specializing in clean, affordable, ready-to-play instruments.

Every guitar we offer is:
• Cleaned, checked, and properly set up
• Ready to play from day one
• Carefully selected to provide real value

We focus on helping people get started the right way — without overpaying or dealing with unknown online sellers.`;

function stripKnownSaleDescriptionFooter(value: string): string {
  const text = normalizeText(value, '').trim();
  if (!text) return text;

  const markers = [
    '\n\n📍 Local pickup in Englewood, CO',
    '\n\nLocal pickup in Englewood, CO',
    '\n\n🔐 Come to our shop in Englewood',
    '\n\n💳 Payment options:',
    '\n\nPayment options:',
    '\n\nCoal Creek Guitars –',
    '\n\nAbout Coal Creek Guitars:',
  ];
  const markerIndex = markers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  return markerIndex == null ? text : text.slice(0, markerIndex).trim();
}

function stripTrailingText(value: string, trailingText: string): string {
  const text = normalizeText(value, '').trim();
  const suffix = normalizeText(trailingText, '').trim();
  if (!text || !suffix) return text;
  if (text.endsWith(suffix)) return text.slice(0, -suffix.length).trim();

  const normalizedText = normalizeWhitespaceForComparison(text);
  const normalizedSuffix = normalizeWhitespaceForComparison(suffix);
  if (!normalizedText.endsWith(normalizedSuffix)) return text;

  const marker = suffix.split('\n').map((line) => line.trim()).find(Boolean) || '';
  if (marker) {
    const markerIndex = text.lastIndexOf(marker);
    if (markerIndex > 0) return text.slice(0, markerIndex).trim();
  }
  return text;
}

function normalizeWhitespaceForComparison(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export async function dbListCheckoutInventoryItems(
  itemIds: number[],
  env: Env,
): Promise<ShopCheckoutInventoryRow[]> {
  const uniqueIds = Array.from(new Set(itemIds)).filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT
       id,
       title,
       sale_title,
       brand,
       model,
       "condition",
       image_url,
      regular_price,
      sale_price,
      unit_purchase_price,
      allow_shipping,
      quantity,
       for_sale,
       only_in_store,
       is_sold,
       is_active,
       is_rented,
       availability_status,
       active_order_id,
       reserved_until
     FROM ccg_inventory_items
     WHERE id IN (${placeholders})`
  ).bind(...uniqueIds).all<ShopCheckoutInventoryRow>();
  return result.results ?? [];
}
