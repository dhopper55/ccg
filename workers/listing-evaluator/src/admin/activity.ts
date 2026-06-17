import type { Env } from '../env.js';
import { BRAND_ACTIVITY_META, ACTIVITY_EVENT_TYPE_SEEDS, ACTIVITY_BASE_URL } from '../constants.js';
import type { ActivityEventKey } from '../constants.js';
import { normalizeText, normalizeUrl } from '../utils/text.js';

export interface ActivityLogInsert {
  eventKey: ActivityEventKey;
  eventText: string;
  eventUrl?: string | null;
  imageUrl?: string | null;
  eventTimeUtc?: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

function normalizeBrandKey(input: string): string {
  return input.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export function buildBrandActivityContext(brandInput: string, normalizedBrandInput = ''): {
  brandLabel: string;
  decoderUrl: string | null;
  imageUrl: string | null;
} {
  const normalized = normalizeBrandKey(normalizedBrandInput || brandInput);
  const meta = BRAND_ACTIVITY_META[normalized];
  const brandLabel = meta?.label || normalizeText(brandInput, '') || 'Unknown';
  const decoderUrl = meta
    ? `${ACTIVITY_BASE_URL}/decoders/${meta.decoderSlug}-guitar-serial-number-decoder.html`
    : null;
  const imageUrl = meta
    ? `${ACTIVITY_BASE_URL}/images/brand-logos/${meta.logoFile}`
    : null;
  return { brandLabel, decoderUrl, imageUrl };
}

export function buildAdminInventoryItemUrl(recordId: string): string {
  return `${ACTIVITY_BASE_URL}/admin/inventory-item?id=${encodeURIComponent(recordId)}`;
}

export function buildAdminListingEvaluatorItemUrl(recordId: string): string {
  return `${ACTIVITY_BASE_URL}/admin/listing-evaluator-item?id=${encodeURIComponent(recordId)}`;
}

export function toAbsoluteSiteUrl(input: string): string | null {
  const trimmed = normalizeText(input, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    try {
      return new URL(trimmed, ACTIVITY_BASE_URL).toString();
    } catch {
      return null;
    }
  }
  return normalizeUrl(trimmed);
}

export async function ensureActivityEventTypeId(eventKey: ActivityEventKey, env: Env): Promise<number | null> {
  const db = env.DB.withSession('first-primary');
  let row = await db.prepare(
    `SELECT id
     FROM activity_event_type
     WHERE event_key = ?
     LIMIT 1`
  ).bind(eventKey).first<{ id: number | null }>();

  if (row?.id != null) return Number(row.id);

  const seed = ACTIVITY_EVENT_TYPE_SEEDS.find((entry) => entry.key === eventKey);
  if (!seed) return null;

  await db.prepare(
    `INSERT OR IGNORE INTO activity_event_type (event_key, template_text, icon_key)
     VALUES (?, ?, ?)`
  ).bind(seed.key, seed.templateText, seed.iconKey).run();

  row = await db.prepare(
    `SELECT id
     FROM activity_event_type
     WHERE event_key = ?
     LIMIT 1`
  ).bind(eventKey).first<{ id: number | null }>();

  if (row?.id == null) return null;
  return Number(row.id);
}

export async function insertActivityLogBestEffort(env: Env, payload: ActivityLogInsert): Promise<void> {
  try {
    const eventTypeId = await ensureActivityEventTypeId(payload.eventKey, env);
    if (eventTypeId == null) {
      console.warn('Activity log event type missing', { eventKey: payload.eventKey });
      return;
    }

    const metadataJson = payload.metadata ? JSON.stringify(payload.metadata) : null;
    await env.DB.prepare(
      `INSERT INTO activity_log (
        event_time_utc,
        event_type_id,
        event_url,
        event_text,
        image_url,
        entity_type,
        entity_id,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.eventTimeUtc || new Date().toISOString(),
      eventTypeId,
      payload.eventUrl || null,
      payload.eventText,
      payload.imageUrl || null,
      payload.entityType || null,
      payload.entityId || null,
      metadataJson,
    ).run();
  } catch (error) {
    console.error('Activity log insert failed', {
      eventKey: payload.eventKey,
      error,
    });
  }
}

export async function dbListAdminV2ActivityLog(
  page: number,
  limit: number,
  env: Env,
): Promise<{
  records: Array<{
    id: number;
    eventTimeUtc: string;
    eventKey: string;
    iconKey: string;
    eventText: string;
    eventUrl: string | null;
    imageUrl: string | null;
    entityType: string | null;
    entityId: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(25, limit));
  const offset = (safePage - 1) * safeLimit;

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM activity_log`
  ).first<{ total: number | null }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const result = await env.DB.prepare(
    `SELECT
      l.id,
      l.event_time_utc,
      l.event_text,
      l.event_url,
      l.image_url,
      l.entity_type,
      l.entity_id,
      t.event_key,
      t.icon_key
     FROM activity_log l
     INNER JOIN activity_event_type t
       ON t.id = l.event_type_id
     ORDER BY l.event_time_utc DESC, l.id DESC
     LIMIT ? OFFSET ?`
  ).bind(safeLimit, offset).all<{
    id: number;
    event_time_utc: string | null;
    event_text: string | null;
    event_url: string | null;
    image_url: string | null;
    entity_type: string | null;
    entity_id: string | null;
    event_key: string | null;
    icon_key: string | null;
  }>();

  const records = (result.results ?? []).map((row) => ({
    id: Number(row.id),
    eventTimeUtc: normalizeText(row.event_time_utc, ''),
    eventKey: normalizeText(row.event_key, ''),
    iconKey: normalizeText(row.icon_key, ''),
    eventText: normalizeText(row.event_text, ''),
    eventUrl: normalizeText(row.entity_type, '') === 'listing_eval' && normalizeText(row.entity_id, '')
      ? buildAdminListingEvaluatorItemUrl(normalizeText(row.entity_id, ''))
      : normalizeUrl(normalizeText(row.event_url, '')),
    imageUrl: normalizeUrl(normalizeText(row.image_url, '')),
    entityType: normalizeText(row.entity_type, '') || null,
    entityId: normalizeText(row.entity_id, '') || null,
  }));

  return {
    records,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasMore: safePage * safeLimit < total,
  };
}
