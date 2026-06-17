import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { parseStringArray, dbGetColumnNames } from '../utils/misc.js';
import type { SerialDecodeEventInsert, SerialPatternContextPayload, SerialPatternContextRow } from '../types/core.js';
import { SERIAL_DECODE_DUPLICATE_WINDOW_HOURS } from '../constants.js';
import { normalizeBrandKey } from '../../../../src/serial-decode-service.js';
import { deriveRegexFromPatternKey, isCatchAllSerialRegex, normalizeSerialKey, deriveSerialPatternMeta } from './utils.js';

// ---------------------------------------------------------------------------
// Serial decode events
// ---------------------------------------------------------------------------

export async function insertSerialDecodeEvent(env: Env, payload: SerialDecodeEventInsert): Promise<number | null> {
  const allValues: Record<string, unknown> = {
    event_time_utc: new Date().toISOString(),
    brand: payload.brand,
    serial: payload.serial,
    pattern: payload.pattern || null,
    pattern_key: payload.patternKey || null,
    pattern_label: payload.patternLabel || null,
    pattern_lookup_id: payload.patternLookupId ?? null,
    normalized_brand: payload.normalizedBrand || normalizeBrandKey(payload.brand),
    normalized_serial: payload.normalizedSerial || normalizeSerialKey(payload.serial),
    success: payload.success ? 1 : 0,
    evaluated: payload.evaluated ? 1 : 0,
    is_invalid: payload.isInvalid ? 1 : 0,
    needs_context: payload.needsContext ? 1 : 0,
    used_ai: payload.usedAi ? 1 : 0,
    is_listing_eval: 0,
    year: payload.year || null,
    month: payload.month || null,
    factory: payload.factory || null,
    country: payload.country || null,
    model: payload.model || null,
    notes: payload.notes || null,
    error: payload.error || null,
    email: payload.email || null,
    ai_cache_hit: payload.aiCacheHit ? 1 : 0,
    ai_model: payload.aiModel || null,
    ai_response_json: payload.aiResponseJson || null,
    ai_attempted_at: payload.aiAttemptedAt || null,
    page_path: payload.pagePath || null,
    user_agent: payload.userAgent || null,
    client_timestamp: payload.clientTimestamp || null,
    ip_address: payload.ipAddress || null,
    cf_country: payload.countryCode || null,
    cf_colo: payload.colo || null,
  };

  const schemaRows = await env.DB.prepare(`PRAGMA table_info(serial_decode_events)`).all<{ name: string | null }>();
  const existingColumns = new Set(
    (schemaRows.results ?? []).map((r) => normalizeText(r.name, '').toLowerCase()).filter(Boolean)
  );

  const columns = Object.keys(allValues).filter((col) => existingColumns.has(col));
  const result = await env.DB.prepare(
    `INSERT INTO serial_decode_events (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
  ).bind(...columns.map((col) => allValues[col])).run();
  return Number(result.meta?.last_row_id || 0) || null;
}

export async function findRecentSerialDecodeDuplicateId(
  env: Env,
  normalizedBrand: string,
  normalizedSerial: string,
  ipAddress: string,
): Promise<number | null> {
  if (!normalizedBrand || !normalizedSerial || !ipAddress) return null;

  try {
    const row = await env.DB.prepare(
      `SELECT id
       FROM serial_decode_events
       WHERE normalized_brand = ?
         AND normalized_serial = ?
         AND ip_address = ?
         AND is_listing_eval = 0
         AND datetime(COALESCE(event_time_utc, created_at)) >= datetime('now', ?)
       ORDER BY datetime(COALESCE(event_time_utc, created_at)) DESC, id DESC
       LIMIT 1`
    ).bind(
      normalizedBrand,
      normalizedSerial,
      ipAddress,
      `-${SERIAL_DECODE_DUPLICATE_WINDOW_HOURS} hours`,
    ).first<{ id: number | null }>();

    if (row?.id == null) return null;
    return Number(row.id);
  } catch {
    return null;
  }
}

export async function dbFindPatternLookupIdForFailure(
  normalizedBrand: string,
  serial: string,
  env: Env,
): Promise<{ id: number; pattern: string } | null> {
  if (!normalizedBrand || !serial) return null;
  try {
    const rows = await env.DB.prepare(
      `SELECT id, pattern, regex_pattern
       FROM serial_decode_pattern_lookup
       WHERE brand = ?
         AND regex_pattern IS NOT NULL
         AND regex_pattern != ''`
    ).bind(normalizedBrand).all<{ id: number; pattern: string; regex_pattern: string }>();
    for (const row of rows.results ?? []) {
      try {
        if (new RegExp(row.regex_pattern, 'i').test(serial)) {
          return { id: Number(row.id), pattern: normalizeText(row.pattern, '') };
        }
      } catch {
        // skip invalid regex
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function dbPatternIsKnownInvalid(patternLookupId: number, env: Env): Promise<boolean> {
  if (!(patternLookupId > 0)) return false;
  try {
    const row = await env.DB.prepare(
      `SELECT 1 AS found
       FROM serial_decode_events
       WHERE pattern_lookup_id = ?
         AND COALESCE(evaluated, 0) = 1
         AND COALESCE(is_invalid, 0) = 1
       LIMIT 1`
    ).bind(patternLookupId).first<{ found: number }>();
    return row?.found === 1;
  } catch {
    return false;
  }
}

export async function touchSerialDecodeEventTimestamp(
  env: Env,
  id: number,
  payload: Pick<SerialDecodeEventInsert, 'pagePath' | 'userAgent' | 'clientTimestamp' | 'countryCode' | 'colo'>,
): Promise<void> {
  if (!(id > 0)) return;

  const existingCols = await dbGetColumnNames('serial_decode_events', env);
  const allUpdates: Record<string, unknown> = {
    event_time_utc: new Date().toISOString(),
    page_path: payload.pagePath || null,
    user_agent: payload.userAgent || null,
    client_timestamp: payload.clientTimestamp || null,
    cf_country: payload.countryCode || null,
    cf_colo: payload.colo || null,
  };
  const setCols = Object.keys(allUpdates).filter((col) => existingCols.has(col));
  if (!setCols.length) return;
  await env.DB.prepare(
    `UPDATE serial_decode_events
     SET ${setCols.map((col) => `${col} = ?`).join(', ')}
     WHERE id = ?`
  ).bind(...setCols.map((col) => allUpdates[col]), id).run();
}

export async function ensureSerialDecodePatternLookup(brand: string, pattern: string, env: Env): Promise<number | null> {
  const brandKey = normalizeText(brand, '').slice(0, 120);
  const cleaned = normalizeText(pattern, '').slice(0, 180);
  if (!brandKey || !cleaned) return null;
  const regexPattern = deriveRegexFromPatternKey(cleaned).slice(0, 1000);
  if (!regexPattern || isCatchAllSerialRegex(regexPattern)) return null;
  try {
    await env.DB.prepare(
      `INSERT INTO serial_decode_pattern_lookup (brand, pattern, regex_pattern, rich_text)
       VALUES (?, ?, ?, '')
       ON CONFLICT(brand, pattern) DO UPDATE SET
         regex_pattern = CASE
           WHEN trim(COALESCE(serial_decode_pattern_lookup.regex_pattern, '')) = ''
             OR trim(COALESCE(serial_decode_pattern_lookup.regex_pattern, '')) = '^.{1,}$'
             THEN excluded.regex_pattern
           ELSE serial_decode_pattern_lookup.regex_pattern
         END`
    ).bind(brandKey, cleaned, regexPattern).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/no column named regex_pattern/i.test(message) && !/has no column named regex_pattern/i.test(message)) {
      throw error;
    }
    await env.DB.prepare(
      `INSERT OR IGNORE INTO serial_decode_pattern_lookup (brand, pattern, rich_text)
       VALUES (?, ?, '')`
    ).bind(brandKey, cleaned).run();
  }
  try {
    const row = await env.DB.prepare(
      `SELECT id
       FROM serial_decode_pattern_lookup
       WHERE brand = ?
         AND pattern = ?
       LIMIT 1`
    ).bind(brandKey, cleaned).first<{ id: number | null }>();
    if (row?.id == null) return null;
    return Number(row.id);
  } catch {
    return null;
  }
}

export async function getSerialDecodePatternRichText(brand: string, pattern: string, env: Env): Promise<string> {
  const brandKey = normalizeText(brand, '').slice(0, 120);
  const cleaned = normalizeText(pattern, '').slice(0, 180);
  if (!brandKey || !cleaned) return '';
  const row = await env.DB.prepare(
    `SELECT rich_text
     FROM serial_decode_pattern_lookup
     WHERE brand = ?
       AND pattern = ?
     LIMIT 1`
  ).bind(brandKey, cleaned).first<{ rich_text: string | null }>();
  return normalizeText(row?.rich_text, '').slice(0, 12000);
}

// ---------------------------------------------------------------------------
// Serial pattern contexts
// ---------------------------------------------------------------------------

export async function dbGetPublishedSerialPatternContext(
  normalizedBrand: string,
  patternKey: string,
  env: Env,
): Promise<SerialPatternContextPayload | null> {
  if (!normalizedBrand || !patternKey) return null;
  const row = await env.DB.prepare(
    `SELECT
      title,
      summary,
      highlights_json,
      caveats_json,
      verification_json
     FROM serial_pattern_contexts
     WHERE normalized_brand = ?
       AND pattern_key = ?
       AND published = 1
     LIMIT 1`
  ).bind(normalizedBrand, patternKey).first<SerialPatternContextRow>();

  if (!row) return null;
  return {
    title: normalizeText(row.title, ''),
    summary: normalizeText(row.summary, ''),
    highlights: parseStringArray(row.highlights_json),
    caveats: parseStringArray(row.caveats_json),
    verificationTips: parseStringArray(row.verification_json),
  };
}

export async function dbUpsertSerialPatternContext(
  payload: {
    brand: string;
    normalizedBrand: string;
    patternKey: string;
    patternLabel: string;
    title: string;
    summary: string;
    highlights: string[];
    caveats: string[];
    verificationTips: string[];
    sourceSerial?: string;
    aiModel?: string;
    aiResponseJson?: string;
    published?: boolean;
  },
  env: Env,
): Promise<{ id: number; context: SerialPatternContextPayload }> {
  const db = env.DB.withSession('first-primary');
  await db.prepare(
    `INSERT INTO serial_pattern_contexts (
      brand,
      normalized_brand,
      pattern_key,
      pattern_label,
      title,
      summary,
      highlights_json,
      caveats_json,
      verification_json,
      source_serial,
      ai_model,
      ai_response_json,
      published,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(normalized_brand, pattern_key)
    DO UPDATE SET
      brand = excluded.brand,
      pattern_label = excluded.pattern_label,
      title = excluded.title,
      summary = excluded.summary,
      highlights_json = excluded.highlights_json,
      caveats_json = excluded.caveats_json,
      verification_json = excluded.verification_json,
      source_serial = excluded.source_serial,
      ai_model = excluded.ai_model,
      ai_response_json = excluded.ai_response_json,
      published = excluded.published,
      updated_at = CURRENT_TIMESTAMP`
  ).bind(
    payload.brand,
    payload.normalizedBrand,
    payload.patternKey,
    payload.patternLabel,
    payload.title,
    payload.summary,
    JSON.stringify(payload.highlights || []),
    JSON.stringify(payload.caveats || []),
    JSON.stringify(payload.verificationTips || []),
    payload.sourceSerial || null,
    payload.aiModel || null,
    payload.aiResponseJson || null,
    payload.published === false ? 0 : 1,
  ).run();

  const row = await db.prepare(
    `SELECT id
     FROM serial_pattern_contexts
     WHERE normalized_brand = ? AND pattern_key = ?
     LIMIT 1`
  ).bind(payload.normalizedBrand, payload.patternKey).first<{ id: number | null }>();

  return {
    id: Number(row?.id || 0),
    context: {
      title: payload.title,
      summary: payload.summary,
      highlights: payload.highlights || [],
      caveats: payload.caveats || [],
      verificationTips: payload.verificationTips || [],
    },
  };
}

export async function dbSetSerialDecodeEvaluated(
  recordId: string,
  evaluated: boolean,
  env: Env,
  isValid?: boolean,
): Promise<{
  evaluated: boolean;
  updatedCount: number;
  activityCandidate?: {
    brand: string;
    serial: string;
    normalizedBrand: string;
    success: boolean;
    wasEvaluated: boolean;
  };
} | null> {
  const id = normalizeText(recordId, '');
  if (!/^\d+$/.test(id)) return null;
  const numericId = parseInt(id, 10);

  if (evaluated) {
    const keyRow = await env.DB.prepare(
      `SELECT brand, serial, normalized_brand, success, evaluated
       FROM serial_decode_events
       WHERE id = ?`
    ).bind(numericId).first<{
      brand: string | null;
      serial: string | null;
      normalized_brand: string | null;
      success: number | null;
      evaluated: number | null;
    }>();
    if (!keyRow) return null;

    const brand = normalizeText(keyRow.brand, '');
    const serial = normalizeText(keyRow.serial, '');
    if (!brand || !serial) return null;
    const normalizedBrand = normalizeText(keyRow.normalized_brand, '') || normalizeBrandKey(brand);
    const success = Number(keyRow.success || 0) === 1;
    const wasEvaluated = Number(keyRow.evaluated || 0) === 1;

    const isInvalidValue = isValid === true ? 0 : isValid === false ? 1 : null;
    const updateResult = await env.DB.prepare(
      isInvalidValue !== null
        ? `UPDATE serial_decode_events
           SET evaluated = 1, is_invalid = ${isInvalidValue}
           WHERE lower(trim(brand)) = lower(trim(?))
             AND lower(trim(serial)) = lower(trim(?))`
        : `UPDATE serial_decode_events
           SET evaluated = 1
           WHERE lower(trim(brand)) = lower(trim(?))
             AND lower(trim(serial)) = lower(trim(?))`
    ).bind(brand, serial).run();

    if (isValid !== undefined) {
      try {
        let patternLookupId: number | null = null;
        const existingMatch = await dbFindPatternLookupIdForFailure(normalizedBrand, serial, env);
        if (existingMatch !== null) {
          patternLookupId = existingMatch.id;
        } else {
          const patternMeta = deriveSerialPatternMeta(normalizedBrand, serial);
          if (patternMeta.patternKey) {
            patternLookupId = await ensureSerialDecodePatternLookup(normalizedBrand, patternMeta.patternKey, env);
          }
        }
        if (patternLookupId !== null) {
          const existingCols = await dbGetColumnNames('serial_decode_events', env);
          if (existingCols.has('pattern_lookup_id')) {
            await env.DB.prepare(
              `UPDATE serial_decode_events
               SET pattern_lookup_id = ?
               WHERE lower(trim(brand)) = lower(trim(?))
                 AND lower(trim(serial)) = lower(trim(?))
                 AND (pattern_lookup_id IS NULL OR pattern_lookup_id = 0)`
            ).bind(patternLookupId, brand, serial).run();
          }
        }
      } catch (error) {
        console.error('pattern linkage backfill failed', { error });
      }
    }

    return {
      evaluated: true,
      updatedCount: Number(updateResult.meta.changes || 0),
      activityCandidate: {
        brand,
        serial,
        normalizedBrand,
        success,
        wasEvaluated,
      },
    };
  }

  const updateResult = await env.DB.prepare(
    `UPDATE serial_decode_events
     SET evaluated = 0
     WHERE id = ?`
  ).bind(numericId).run();

  const row = await env.DB.prepare(
    `SELECT evaluated
     FROM serial_decode_events
     WHERE id = ?`
  ).bind(numericId).first<{ evaluated: number | null }>();

  if (!row) return null;
  return {
    evaluated: Number(row.evaluated || 0) === 1,
    updatedCount: Number(updateResult.meta.changes || 0),
  };
}

export async function dbMarkPriorDecodeFailuresAsValid(brand: string, serial: string, env: Env): Promise<void> {
  if (!brand || !serial) return;
  await env.DB.prepare(
    `UPDATE serial_decode_events
     SET evaluated = 1, is_invalid = 0
     WHERE lower(trim(brand)) = lower(trim(?))
       AND lower(trim(serial)) = lower(trim(?))
       AND COALESCE(success, 0) = 0
       AND COALESCE(evaluated, 0) = 0`
  ).bind(brand, serial).run();
}

export async function dbDeleteSerialDecodeRecord(
  recordId: string,
  env: Env,
): Promise<{ deletedCount: number } | null> {
  const id = normalizeText(recordId, '');
  if (!/^\d+$/.test(id)) return null;

  const deleteResult = await env.DB.prepare(
    `DELETE FROM serial_decode_events
     WHERE id = ?`
  ).bind(parseInt(id, 10)).run();

  return {
    deletedCount: Number(deleteResult.meta.changes || 0),
  };
}

// sanitizePatternContextPayload and sanitizePatternContextList moved to db2.ts (500-line limit)
