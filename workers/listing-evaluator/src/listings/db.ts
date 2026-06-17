import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { SINGLE_FIELD_KEYS, DEFAULT_TEXT, ACTIVITY_BASE_URL } from '../constants.js';
import type { ListingListItem, ListingMapItem } from '../types/core.js';

export function hasOwnField(fields: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, key);
}

export function toDbBoolean(value: unknown): number | null {
  if (value == null) return null;
  return isArchivedValue(value) ? 1 : 0;
}

export function toDbMulti(value: unknown): number | null {
  if (value == null) return null;
  return isMultiValue(value) ? 1 : 0;
}

export function listingFieldsToColumns(fields: Record<string, unknown>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  const assign = (fieldKey: string, columnKey = fieldKey, transform?: (value: unknown) => unknown) => {
    if (!hasOwnField(fields, fieldKey)) return;
    const raw = fields[fieldKey];
    columns[columnKey] = transform ? transform(raw) : raw;
  };

  assign('submitted_at');
  assign('source');
  assign('url');
  assign('status');
  assign('title');
  assign('price_asking');
  assign('location');
  assign('description');
  assign('photos');
  assign('image_url');
  assign('ai_summary');
  assign('ai_summary2');
  assign('ai_summary3');
  assign('ai_summary4');
  assign('ai_summary5');
  assign('ai_summary6');
  assign('ai_summary7');
  assign('ai_summary8');
  assign('ai_summary9');
  assign('ai_summary10');
  assign('ai_analysis_text');
  assign('price_private_party');
  assign('price_ideal');
  assign('score');
  assign('category');
  assign('brand');
  assign('model');
  assign('finish');
  assign('year');
  assign('condition');
  assign('serial');
  assign('serial_brand');
  assign('serial_year');
  assign('serial_model');
  assign('value_private_party_low');
  assign('value_private_party_low_notes');
  assign('value_private_party_medium');
  assign('value_private_party_medium_notes');
  assign('value_private_party_high');
  assign('value_private_party_high_notes');
  assign('pricing_source');
  assign('pricing_confidence');
  assign('pricing_comp_count');
  assign('pricing_notes');
  assign('value_pawn_shop_notes');
  assign('value_online_notes');
  assign('known_weak_points');
  assign('typical_repair_needs');
  assign('buyers_worry');
  assign('og_specs_pickups');
  assign('og_specs_tuners');
  assign('og_specs_common_mods');
  assign('buyer_what_to_check');
  assign('buyer_common_misrepresent');
  assign('seller_how_to_price_realistic');
  assign('seller_fixes_add_value_or_waste');
  assign('seller_as_is_notes');
  assign('archived', 'archived', toDbBoolean);
  assign('archive_reason');
  assign('saved', 'saved', toDbBoolean);
  assign('IsMulti', 'is_multi', toDbMulti);

  return columns;
}

export function buildInsertStatement(table: string, columns: Record<string, unknown>): { sql: string; values: unknown[] } | null {
  const keys = Object.keys(columns);
  if (keys.length === 0) return null;
  const placeholders = keys.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    values: keys.map((key) => columns[key]),
  };
}

export function buildUpdateStatement(table: string, columns: Record<string, unknown>, whereKey: string): { sql: string; values: unknown[] } | null {
  const keys = Object.keys(columns);
  if (keys.length === 0) return null;
  const assignments = keys.map((key) => `${key} = ?`).join(', ');
  return {
    sql: `UPDATE ${table} SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE ${whereKey} = ?`,
    values: keys.map((key) => columns[key]),
  };
}

export function listingRowToRecord(row: Record<string, any>): { id: string; fields: Record<string, unknown> } {
  return {
    id: String(row.id),
    fields: {
      submitted_at: row.submitted_at ?? null,
      source: row.source ?? null,
      url: row.url ?? null,
      status: row.status ?? null,
      title: row.title ?? null,
      price_asking: row.price_asking ?? null,
      location: row.location ?? null,
      description: row.description ?? null,
      photos: row.photos ?? null,
      image_url: row.image_url ?? null,
      ai_summary: row.ai_summary ?? null,
      ai_summary2: row.ai_summary2 ?? null,
      ai_summary3: row.ai_summary3 ?? null,
      ai_summary4: row.ai_summary4 ?? null,
      ai_summary5: row.ai_summary5 ?? null,
      ai_summary6: row.ai_summary6 ?? null,
      ai_summary7: row.ai_summary7 ?? null,
      ai_summary8: row.ai_summary8 ?? null,
      ai_summary9: row.ai_summary9 ?? null,
      ai_summary10: row.ai_summary10 ?? null,
      ai_analysis_text: row.ai_analysis_text ?? null,
      price_private_party: row.price_private_party ?? null,
      price_ideal: row.price_ideal ?? null,
      score: row.score ?? null,
      archived: row.archived ? true : false,
      archive_reason: row.archive_reason ?? null,
      saved: row.saved ? true : false,
      IsMulti: row.is_multi ? true : false,
      category: row.category ?? null,
      brand: row.brand ?? null,
      model: row.model ?? null,
      finish: row.finish ?? null,
      year: row.year ?? null,
      condition: row.condition ?? null,
      serial: row.serial ?? null,
      serial_brand: row.serial_brand ?? null,
      serial_year: row.serial_year ?? null,
      serial_model: row.serial_model ?? null,
      value_private_party_low: row.value_private_party_low ?? null,
      value_private_party_low_notes: row.value_private_party_low_notes ?? null,
      value_private_party_medium: row.value_private_party_medium ?? null,
      value_private_party_medium_notes: row.value_private_party_medium_notes ?? null,
      value_private_party_high: row.value_private_party_high ?? null,
      value_private_party_high_notes: row.value_private_party_high_notes ?? null,
      pricing_source: row.pricing_source ?? null,
      pricing_confidence: row.pricing_confidence ?? null,
      pricing_comp_count: row.pricing_comp_count ?? null,
      pricing_notes: row.pricing_notes ?? null,
      value_pawn_shop_notes: row.value_pawn_shop_notes ?? null,
      value_online_notes: row.value_online_notes ?? null,
      known_weak_points: row.known_weak_points ?? null,
      typical_repair_needs: row.typical_repair_needs ?? null,
      buyers_worry: row.buyers_worry ?? null,
      og_specs_pickups: row.og_specs_pickups ?? null,
      og_specs_tuners: row.og_specs_tuners ?? null,
      og_specs_common_mods: row.og_specs_common_mods ?? null,
      buyer_what_to_check: row.buyer_what_to_check ?? null,
      buyer_common_misrepresent: row.buyer_common_misrepresent ?? null,
      seller_how_to_price_realistic: row.seller_how_to_price_realistic ?? null,
      seller_fixes_add_value_or_waste: row.seller_fixes_add_value_or_waste ?? null,
      seller_as_is_notes: row.seller_as_is_notes ?? null,
    },
  };
}

// Inline helpers used by dbListListings
function isArchivedValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function isMultiValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function buildListingImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listing-image?${params.toString()}`;
}

function buildCustomImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listings/custom-image?${params.toString()}`;
}

function buildInventoryImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/inventory-image?${params.toString()}`;
}

type CloudflareImagePreset = 'thumb' | 'card' | 'detail';

const CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS: Record<CloudflareImagePreset, string> = {
  thumb: 'fit=scale-down,width=180,quality=80,format=auto,onerror=redirect',
  card: 'fit=scale-down,width=640,quality=82,format=auto,onerror=redirect',
  detail: 'fit=scale-down,width=1400,quality=85,format=auto,onerror=redirect',
};

function normalizeInventoryImageUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (!raw.startsWith('/api/') && !/^https?:\/\//i.test(raw) && !raw.startsWith('/cdn-cgi/image/')) {
    if (raw.startsWith('listing-images/')) return buildListingImageUrl(raw);
    if (raw.startsWith('custom-items/')) return buildCustomImageUrl(raw);
    return buildInventoryImageUrl(raw);
  }
  return raw;
}

function toCloudflareImageTransformUrl(
  imageUrl: string,
  preset: CloudflareImagePreset,
  options: { absolute?: boolean } = {},
): string {
  const normalized = imageUrl.trim();
  if (!normalized || normalized.startsWith('/cdn-cgi/image/')) return normalized;

  const transformOptions = CLOUDFLARE_IMAGE_TRANSFORM_OPTIONS[preset];
  const baseUrl = options.absolute ? ACTIVITY_BASE_URL : '';

  if (normalized.startsWith('/api/')) {
    return `${baseUrl}/cdn-cgi/image/${transformOptions}${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    const siteOrigin = new URL(ACTIVITY_BASE_URL).origin;
    if (parsed.origin !== siteOrigin) return normalized;
    return `${parsed.origin}/cdn-cgi/image/${transformOptions}${parsed.pathname}${parsed.search}`;
  } catch {
    return normalized;
  }
}

export function toAdminImageUrl(value: unknown, preset?: CloudflareImagePreset): string {
  const imageUrl = normalizeInventoryImageUrl(value);
  if (!imageUrl || !preset) return imageUrl;
  return toCloudflareImageTransformUrl(imageUrl, preset);
}

export async function dbListListings(
  limit: number,
  offset: string | undefined,
  mode: 'default' | 'saved' | 'archived',
  titleSearch: string,
  archiveReason: string,
  env: Env
): Promise<{ records: ListingListItem[]; nextOffset?: string | null; total?: number } | null> {
  const offsetValue = offset ? Math.max(0, Number.parseInt(offset, 10) || 0) : 0;
  const whereParts = ['(l.archived IS NULL OR l.archived = 0)', '(l.saved IS NULL OR l.saved = 0)'];
  if (mode === 'saved') {
    whereParts.length = 0;
    whereParts.push('(l.archived IS NULL OR l.archived = 0)', 'l.saved = 1');
  } else if (mode === 'archived') {
    whereParts.length = 0;
    whereParts.push('l.archived = 1');
  }

  const queryBindings: unknown[] = [];
  if (titleSearch) {
    whereParts.push('LOWER(COALESCE(l.title, \'\')) LIKE ?');
    queryBindings.push(`%${titleSearch.toLowerCase()}%`);
  }
  if (mode === 'archived' && archiveReason) {
    whereParts.push('l.archive_reason = ?');
    queryBindings.push(archiveReason);
  }
  const whereClause = `WHERE ${whereParts.join(' AND ')}`;
  const totalResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM listings l ${whereClause}`
  ).bind(...queryBindings).first<{ total: number }>();
  const total = typeof totalResult?.total === 'number' ? totalResult.total : 0;
  const result = await env.DB.prepare(
    `SELECT
       l.id,
       l.url,
       l.source,
       l.status,
       l.title,
       l.archive_reason,
       l.price_asking,
       l.score,
       l.saved,
       l.image_url,
       l.submitted_at,
       l.created_at,
       l.updated_at,
       CASE WHEN i.id IS NULL THEN 0 ELSE 1 END AS in_inventory
     FROM listings l
     LEFT JOIN ccg_inventory_items i
       ON i.source_listing_id = l.id
     ${whereClause}
     ORDER BY
       CASE WHEN l.status = 'queued' THEN 1 ELSE 0 END ASC,
       COALESCE(l.submitted_at, l.created_at) DESC,
       l.id DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...queryBindings, limit, offsetValue)
    .all<{
      id: number;
      url: string | null;
      source: string | null;
      status: string | null;
      title: string | null;
      archive_reason: string | null;
      price_asking: number | string | null;
      score: number | string | null;
      saved: number | null;
      image_url: string | null;
      submitted_at: string | null;
      created_at: string | null;
      updated_at: string | null;
      in_inventory: number | null;
    }>();

  const records = (result.results ?? []).map((row) => ({
    id: String(row.id),
    url: row.url ?? '',
    source: row.source ?? '',
    status: row.status ?? '',
    title: row.title ?? '',
    archiveReason: row.archive_reason ?? null,
    askingPrice: row.price_asking ?? null,
    score: row.score ?? null,
    saved: row.saved ? true : false,
    imageUrl: toAdminImageUrl(row.image_url ? String(row.image_url).trim().split(/\s+/)[0] : null, 'thumb') || null,
    submittedAt: row.submitted_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    inInventory: Boolean(row.in_inventory),
  }));

  const nextOffset = records.length === limit ? String(offsetValue + limit) : null;
  return { records, nextOffset, total };
}

export async function dbListListingsForMap(
  env: Env
): Promise<{ records: ListingMapItem[] } | null> {
  const result = await env.DB.prepare(
    `SELECT
       l.id,
       l.url,
       l.source,
       l.status,
       l.title,
       l.price_asking,
       l.saved,
       l.location
     FROM listings l
     WHERE (l.archived IS NULL OR l.archived = 0)
     ORDER BY
       CASE WHEN l.status = 'queued' THEN 1 ELSE 0 END ASC,
       COALESCE(l.submitted_at, l.created_at) DESC,
       l.id DESC
     LIMIT 2000`
  ).all<{
    id: number;
    url: string | null;
    source: string | null;
    status: string | null;
    title: string | null;
    price_asking: number | string | null;
    saved: number | null;
    location: string | null;
  }>();

  const records = (result.results ?? []).map((row) => ({
    id: String(row.id),
    url: row.url ?? '',
    source: row.source ?? '',
    status: row.status ?? '',
    title: row.title ?? '',
    askingPrice: row.price_asking ?? null,
    saved: row.saved ? true : false,
    location: row.location ?? '',
  }));

  return { records };
}

export async function dbGetListing(recordId: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return null;
  const row = await env.DB.prepare('SELECT * FROM listings WHERE id = ?')
    .bind(idValue)
    .first<Record<string, any>>();
  return row ? listingRowToRecord(row) : null;
}

export async function dbFindListingByUrl(url: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const row = await env.DB.prepare('SELECT * FROM listings WHERE url = ? LIMIT 1')
    .bind(url)
    .first<Record<string, any>>();
  return row ? listingRowToRecord(row) : null;
}

export async function dbCreateListing(fields: Record<string, unknown>, env: Env): Promise<string | null> {
  const columns = listingFieldsToColumns(fields);
  const insert = buildInsertStatement('listings', columns);
  if (!insert) return null;
  const result = await env.DB.prepare(insert.sql).bind(...insert.values).run();
  return result.meta?.last_row_id ? String(result.meta.last_row_id) : null;
}

export async function dbUpdateListing(recordId: string, fields: Record<string, unknown>, env: Env): Promise<void> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return;
  const columns = listingFieldsToColumns(fields);
  const update = buildUpdateStatement('listings', columns, 'id');
  if (!update) return;
  await env.DB.prepare(update.sql).bind(...update.values, idValue).run();
}

export async function dbSetListingArchived(
  recordId: string,
  archived: boolean,
  archiveReason: string | null,
  env: Env,
): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  await env.DB.prepare(
    'UPDATE listings SET archived = ?, archive_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(archived ? 1 : 0, archiveReason, idValue)
    .run();
  return true;
}

export async function getIsMultiFromRecord(recordId: string, env: Env): Promise<boolean> {
  const record = await dbGetListing(recordId, env);
  return isMultiValue(record?.fields?.IsMulti);
}
