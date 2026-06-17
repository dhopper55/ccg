import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse, generateRunId } from '../utils/misc.js';
import { sanitizePatternLookupHtml } from '../utils/html.js';
import { SINGLE_FIELD_KEYS } from '../constants.js';
import { ALLOWED_ARCHIVE_REASONS } from '../types/core.js';
import type { ListingSource } from '../types/core.js';
import {
  dbGetListing,
  dbUpdateListing,
  dbListListings,
  dbListListingsForMap,
  dbFindListingByUrl,
  dbSetListingArchived,
} from './db.js';
import {
  buildCustomListingFromRecordFields,
  detectSource,
  normalizeQueuedListingUrl,
  isSupportedListingUrl,
  resolveFacebookShareUrl,
} from './submit.js';
import { deleteR2ImagesForListing } from './images.js';

import { processCustomListing, processDirectListing } from './submit2.js';
import { startApifyRun, waitForApifyRun } from '../apify/handlers2.js';
import { fetchReverbListingById, extractReverbListingId } from '../pricing/reverb.js';
import { processRun } from '../apify/process.js';

export function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  let parsed: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    parsed = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const next = Number.parseInt(value.trim(), 10);
    parsed = Number.isFinite(next) ? next : null;
  }
  if (parsed == null) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const ADMIN_V2_LIST_FIELD_KEYS = [
  'pricing_notes',
  'value_pawn_shop_notes',
  'value_online_notes',
  'known_weak_points',
  'typical_repair_needs',
  'buyers_worry',
  'og_specs_pickups',
  'og_specs_tuners',
  'og_specs_common_mods',
  'buyer_what_to_check',
  'buyer_common_misrepresent',
  'seller_how_to_price_realistic',
  'seller_fixes_add_value_or_waste',
  'seller_as_is_notes',
];

export function normalizeAdminV2ListField(value: unknown): string[] {
  if (typeof value !== 'string') return [];

  const cleaned = value
    .replace(/\bGeneral:\s*/gi, '')
    .replace(/[؛；﹔;]/g, ';')
    .trim();

  if (!cleaned) return [];

  const hasBulletMarkers = /[•●▪◦]/.test(cleaned) || /(?:^|\n)\s*[-*]\s+/.test(cleaned);
  const segments = hasBulletMarkers
    ? cleaned
        .replace(/[•●▪◦]\s*/g, '\n• ')
        .replace(/(?:^|\n)\s*[-*]\s+/g, '\n• ')
        .split(/\r?\n/)
    : cleaned.split(/\r?\n/);

  return segments
    .map((part) => part.replace(/^[-–—•*]+\s*/g, '').trim())
    .filter(Boolean)
    .filter((part) => !/^unknown\.?$/i.test(part));
}

export function buildAdminV2ListingRecord(record: { id: string; fields: Record<string, unknown> }) {
  const normalizedLists: Record<string, string[]> = {};

  for (const key of ADMIN_V2_LIST_FIELD_KEYS) {
    const items = normalizeAdminV2ListField(record.fields[key]);
    if (items.length > 0) {
      normalizedLists[key] = items;
    }
  }

  return {
    ...record,
    normalizedLists,
  };
}

export async function handleList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset') || undefined;
  const showSaved = url.searchParams.get('showSaved') === '1';
  const showArchived = url.searchParams.get('showArchived') === '1';
  const titleSearch = normalizeText(url.searchParams.get('titleSearch'), '').trim();
  const archiveReason = normalizeText(url.searchParams.get('archiveReason'), '').trim();

  const DEFAULT_PAGE_SIZE = 20;
  const MAX_PAGE_SIZE = 50;

  let limit = DEFAULT_PAGE_SIZE;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_PAGE_SIZE);
    }
  }

  const mode: 'default' | 'saved' | 'archived' = showSaved ? 'saved' : (showArchived ? 'archived' : 'default');
  const data = await dbListListings(limit, offset, mode, titleSearch, archiveReason, env);
  if (!data) {
    return jsonResponse({ message: 'Unable to fetch listings.' }, 500);
  }

  return jsonResponse(data);
}

export async function handleMapListings(env: Env): Promise<Response> {
  const data = await dbListListingsForMap(env);
  if (!data) {
    return jsonResponse({ message: 'Unable to fetch map listings.' }, 500);
  }
  return jsonResponse(data);
}

export async function handleMapsConfig(env: Env): Promise<Response> {
  const apiKey = typeof env.GOOGLE_MAPS_API_KEY === 'string'
    ? env.GOOGLE_MAPS_API_KEY.trim()
    : '';
  return jsonResponse({
    hasApiKey: Boolean(apiKey),
    apiKey: apiKey || null,
  });
}

export async function handleGetListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

  if (!id || id === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await dbGetListing(id, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse(record);
}

export async function handlePurgeOldListings(env: Env): Promise<Response> {
  const FOUR_WEEKS_AGO_SQL = "datetime('now', '-28 days')";

  // Get IDs of archived listings referenced by inventory (to exclude)
  const inventoryRefResult = await env.DB.prepare(
    `SELECT DISTINCT source_listing_id FROM ccg_inventory_items WHERE source_listing_id IS NOT NULL`
  ).all<{ source_listing_id: number }>();
  const inventoryRefs = new Set((inventoryRefResult.results ?? []).map((r) => r.source_listing_id));

  // Delete in batches directly — avoids loading all candidates into memory
  let totalDeleted = 0;
  let totalImagesDeleted = 0;
  let skippedInventory = 0;
  const deleteBatchSize = 50;

  // Loop until no more candidates
  for (let pass = 0; pass < 20; pass++) {
    const candidates = await env.DB.prepare(
      `SELECT id, photos, image_url FROM listings
       WHERE archived = 1 AND COALESCE(submitted_at, created_at) <= ${FOUR_WEEKS_AGO_SQL}
       LIMIT ${deleteBatchSize}`
    ).all<{ id: number; photos: string | null; image_url: string | null }>();

    const rows = candidates.results ?? [];
    if (rows.length === 0) break;

    const toPurge = rows.filter((r) => !inventoryRefs.has(r.id));
    skippedInventory += rows.length - toPurge.length;

    if (toPurge.length === 0) break; // remaining are all inventory-linked, stop

    // Delete R2 images only for listings that have R2-backed URLs
    for (const row of toPurge) {
      const photos = typeof row.photos === 'string' ? row.photos : '';
      const imageUrl = typeof row.image_url === 'string' ? row.image_url : '';
      if (photos.includes('/api/listing-image') || photos.includes('/api/listings/custom-image') || imageUrl.includes('/api/listing-image') || imageUrl.includes('/api/listings/custom-image')) {
        totalImagesDeleted += await deleteR2ImagesForListing(String(row.id), photos, imageUrl, env);
      }
    }

    // Delete DB rows
    const deleted = await dbDeleteListingsByIds(toPurge.map((r) => r.id), env);
    totalDeleted += deleted;
  }

  return jsonResponse({ ok: true, deleted: totalDeleted, imagesDeleted: totalImagesDeleted, skippedInventory });
}

async function dbDeleteListingsByIds(ids: number[], env: Env): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `DELETE FROM listings WHERE id IN (${placeholders})`
  ).bind(...ids).run();
  return result.meta?.changes ?? 0;
}

export async function handleAdminV2GetListing(env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

  if (!id || id === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await dbGetListing(id, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse(buildAdminV2ListingRecord(record));
}

export async function handleAdminV2ListingAiAnalysisSave(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const aiAnalysisIndex = parts.indexOf('ai-analysis');
  const recordId = aiAnalysisIndex > 0 ? parts[aiAnalysisIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const aiAnalysisText = sanitizePatternLookupHtml(normalizeText(body.aiAnalysisText, '')).slice(0, 20000);

  try {
    await dbUpdateListing(recordId, { ai_analysis_text: aiAnalysisText || null }, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (/no such column: ai_analysis_text/i.test(message) || /no column named ai_analysis_text/i.test(message)) {
      return jsonResponse(
        { message: 'The listings.ai_analysis_text column does not exist yet. Run the one-off D1 ALTER TABLE command first.' },
        400,
      );
    }
    throw error;
  }

  return jsonResponse({ ok: true, aiAnalysisText });
}

export async function handleGetListingDebug(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const debugIndex = parts.indexOf('debug');
  const recordId = debugIndex > 0 ? parts[debugIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await dbGetListing(recordId, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse({
    ok: true,
    record,
    isMulti: isMultiValue(record.fields?.IsMulti),
    singleFieldKeys: SINGLE_FIELD_KEYS,
  });
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

export async function handleArchiveListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const archiveIndex = parts.indexOf('archive');
  const recordId = archiveIndex > 0 ? parts[archiveIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let archivedValue = true;
  let archiveReason: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.archived === 'boolean') {
      archivedValue = body.archived;
    }
    if (typeof body?.archiveReason === 'string') {
      const trimmedReason = body.archiveReason.trim();
      archiveReason = trimmedReason || null;
    }
  } catch {
    archivedValue = true;
  }

  if (archivedValue) {
    if (!archiveReason || !ALLOWED_ARCHIVE_REASONS.has(archiveReason)) {
      return jsonResponse({ message: 'Missing or invalid archive reason.' }, 400);
    }
  } else {
    archiveReason = null;
  }

  const updated = await dbSetListingArchived(recordId, archivedValue, archiveReason, env);
  if (!updated) {
    return jsonResponse({ message: 'Unable to archive listing.' }, 500);
  }

  return jsonResponse({ ok: true, archived: archivedValue, archiveReason });
}

export async function handleSaveListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const saveIndex = parts.indexOf('save');
  const recordId = saveIndex > 0 ? parts[saveIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const savedValue = typeof body?.saved === 'boolean' ? body.saved : null;
  if (savedValue === null) {
    return jsonResponse({ message: 'Missing saved state.' }, 400);
  }

  await dbUpdateListing(recordId, { saved: savedValue }, env);
  return jsonResponse({ ok: true, saved: savedValue });
}

export async function handleReprocessListing(request: Request, env: Env): Promise<Response> {
  if (env.WEBHOOK_SECRET) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const rawUrl = typeof body?.url === 'string' ? body.url : '';
  const recordId = typeof body?.id === 'string'
    ? body.id
    : (typeof body?.id === 'number' && Number.isFinite(body.id) ? String(body.id) : '');

  if (!rawUrl && !recordId) return jsonResponse({ message: 'Missing url or id.' }, 400);

  if (recordId) {
    const record = await dbGetListing(recordId, env);
    if (!record) return jsonResponse({ message: 'Listing not found.' }, 404);
    const source = typeof record.fields?.source === 'string' ? record.fields.source.trim().toLowerCase() : '';
    if (source !== 'custom') {
      return jsonResponse({ message: 'ID reprocess is only supported for custom listings.' }, 400);
    }

    const listing = buildCustomListingFromRecordFields(record.fields);
    if (!listing) {
      return jsonResponse({ message: 'Custom listing has no photos to process.' }, 400);
    }
    await dbUpdateListing(recordId, { status: 'queued' }, env);
    await processCustomListing(recordId, listing, env);
    return jsonResponse({ ok: true, recordId });
  }

  const resolvedUrl = await resolveFacebookShareUrl(rawUrl);
  const normalizedUrl = normalizeQueuedListingUrl(resolvedUrl);
  if (!normalizedUrl) return jsonResponse({ message: 'Invalid url.' }, 400);
  if (!isSupportedListingUrl(normalizedUrl)) {
    return jsonResponse({ message: 'Unsupported URL. Use a Facebook Marketplace item URL, Craigslist listing URL, or single Reverb item URL.' }, 400);
  }

  const existing = await dbFindListingByUrl(normalizedUrl, env);
  if (!existing?.id) return jsonResponse({ message: 'Listing not found.' }, 404);

  const source = detectSource(normalizedUrl);
  if (!source) return jsonResponse({ message: 'Unsupported URL source.' }, 400);

  if (source === 'reverb') {
    const listingId = extractReverbListingId(normalizedUrl);
    if (!listingId) return jsonResponse({ message: 'Unsupported Reverb URL. Use a direct Reverb item URL.' }, 400);
    const listing = await fetchReverbListingById(listingId, env);
    if (!listing) return jsonResponse({ message: 'Unable to load Reverb listing from API.' }, 500);

    const runId = generateRunId();
    await env.LISTING_JOBS.put(runId, existing.id);
    await dbUpdateListing(existing.id, { status: 'queued' }, env);
    try {
      await processDirectListing(existing.id, runId, listing, env, { isMulti: false });
      return jsonResponse({ ok: true, runId, recordId: existing.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process Reverb listing.';
      return jsonResponse({ ok: false, runId, recordId: existing.id, error: message }, 500);
    }
  }

  const runId = await startApifyRun(normalizedUrl, source as ListingSource, env);
  if (!runId) return jsonResponse({ message: 'Unable to start scraper run.' }, 500);

  await env.LISTING_JOBS.put(runId, existing.id);
  const runDetails = await waitForApifyRun(runId, env, 20);
  try {
    await processRun(runId, runDetails, runDetails?.status, env);
    return jsonResponse({ ok: true, runId, recordId: existing.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, runId, recordId: existing.id, error: message }, 500);
  }
}
