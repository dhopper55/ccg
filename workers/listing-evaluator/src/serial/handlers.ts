import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { isValidEmailAddress } from '../utils/text.js';
import { jsonResponse, parseBoundedInt } from '../utils/misc.js';

const SERIAL_DECODE_EVENT_COLS = new Set(['pattern_lookup_id', 'evaluated', 'is_invalid']);
import type { SerialDecodeEventPayload, DecodeRequestPayload, DecodeEmailRequestPayload, SerialDecodeEventInsert, SerialPatternContextPayload, ActivityLogInsert } from '../types/core.js';
import type { ActivityEventKey } from '../constants.js';
import { ACTIVITY_BASE_URL, BRAND_ACTIVITY_META, ACTIVITY_EVENT_TYPE_SEEDS } from '../constants.js';
import { normalizeBrandKey } from '../../../../src/serial-decode-service.js';
import { decodeSerialV2 } from '../v2-serial-decode.js';
import { decodeSerialForBackend } from '../../../../src/serial-decode-service.js';
import {
  normalizeSerialKey,
  deriveSerialPatternMeta,
  hasMeaningfulServerDecodeInfo,
} from './utils.js';
import {
  isSerialDecodeRateLimited,
} from './rate-limit.js';
import {
  insertSerialDecodeEvent,
  findRecentSerialDecodeDuplicateId,
  touchSerialDecodeEventTimestamp,
  ensureSerialDecodePatternLookup,
  getSerialDecodePatternRichText,
  dbFindPatternLookupIdForFailure,
  dbPatternIsKnownInvalid,
  dbGetPublishedSerialPatternContext,
  dbMarkPriorDecodeFailuresAsValid,
} from './db.js';

// ---------------------------------------------------------------------------
// Local helpers (not yet extracted into their own modules)
// ---------------------------------------------------------------------------

function parseSysInfoBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeText(value, '').toLowerCase();
  if (['1', 'true', 'yes', 'y', 'sandbox'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'prod', 'production'].includes(normalized)) return false;
  return fallback;
}

async function dbGetV2DecodeLogicEnabled(env: Env): Promise<boolean> {
  try {
    const row = await env.DB.prepare('SELECT use_v2_decode_logic FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    return parseSysInfoBoolean(row?.use_v2_decode_logic, false);
  } catch {
    return false;
  }
}

async function ensureActivityEventTypeId(eventKey: ActivityEventKey, env: Env): Promise<number | null> {
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

async function insertActivityLogBestEffort(env: Env, payload: ActivityLogInsert): Promise<void> {
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

function buildBrandActivityContext(brandInput: string, normalizedBrandInput = ''): {
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

// ---------------------------------------------------------------------------
// Exported handlers
// ---------------------------------------------------------------------------

export async function handleSerialDecodeEvent(request: Request, env: Env): Promise<Response> {
  let body: SerialDecodeEventPayload = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const brand = normalizeText(body.brand, '').slice(0, 120);
  const serial = normalizeText(body.serial, '').slice(0, 180);
  const year = normalizeText(body.year, '').slice(0, 120);
  const factory = normalizeText(body.factory, '').slice(0, 180);
  const country = normalizeText(body.country, '').slice(0, 120);
  const error = normalizeText(body.error, '').slice(0, 1200);
  const pagePath = normalizeText(body.pagePath, '').slice(0, 300);
  const userAgent = normalizeText(body.userAgent, '').slice(0, 500);
  const clientTimestamp = normalizeText(body.clientTimestamp, '').slice(0, 120);
  const success = Boolean(body.success);
  const normalizedBrand = normalizeBrandKey(brand);
  let pattern = '';
  let patternLookupId: number | null = null;

  if (!brand) return jsonResponse({ message: 'Brand is required.' }, 400);
  if (!serial) return jsonResponse({ message: 'Serial is required.' }, 400);

  if (success && normalizedBrand) {
    const decodeResult = decodeSerialForBackend(brand, serial);
    if (decodeResult.success && decodeResult.info) {
      pattern = deriveSerialPatternMeta(normalizedBrand, decodeResult.info.serialNumber || serial).patternKey;
      patternLookupId = await ensureSerialDecodePatternLookup(normalizedBrand, pattern, env);
    }
  }

  const cf = (request as Request & { cf?: Record<string, unknown> }).cf || {};
  const countryCode = normalizeText(cf.country, '').slice(0, 8);
  const colo = normalizeText(cf.colo, '').slice(0, 32);
  const ipAddress = normalizeText(request.headers.get('CF-Connecting-IP'), '').slice(0, 64);

  if (await isSerialDecodeRateLimited(env, ipAddress)) {
    return jsonResponse({ message: 'Too many decode requests. Please try again later.' }, 429);
  }

  const duplicateId = await findRecentSerialDecodeDuplicateId(
    env,
    normalizedBrand,
    normalizeSerialKey(serial).slice(0, 180),
    ipAddress,
  );
  if (duplicateId) {
    await touchSerialDecodeEventTimestamp(env, duplicateId, {
      pagePath,
      userAgent,
      clientTimestamp,
      countryCode,
      colo,
    });
    return jsonResponse({ ok: true, duplicateSuppressed: true });
  }

  await insertSerialDecodeEvent(env, {
    brand,
    serial,
    pattern: pattern || null,
    patternLookupId,
    success,
    year,
    factory,
    country,
    error,
    pagePath,
    userAgent,
    clientTimestamp,
    ipAddress,
    countryCode,
    colo,
  });

  return jsonResponse({ ok: true });
}

export async function handleDecodeRequest(request: Request, env: Env): Promise<Response> {
  let body: DecodeRequestPayload = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const brand = normalizeText(body.brand, '').slice(0, 120);
  const serial = normalizeText(body.serial, '').slice(0, 180);
  const pagePath = normalizeText(body.pagePath, '').slice(0, 300);
  const userAgent = normalizeText(body.userAgent, '').slice(0, 500);
  const clientTimestamp = normalizeText(body.clientTimestamp, '').slice(0, 120);
  const normalizedBrand = normalizeBrandKey(brand);
  const normalizedSerial = normalizeSerialKey(serial).slice(0, 180);

  const useV2 = await dbGetV2DecodeLogicEnabled(env);
  let result = useV2
    ? ((await decodeSerialV2(normalizedBrand, serial, env)) ?? decodeSerialForBackend(brand, serial))
    : decodeSerialForBackend(brand, serial);
  if (result.success && result.info && !hasMeaningfulServerDecodeInfo(result.info)) {
    result = {
      success: false,
      error: 'Unable to decode this serial number.',
      normalizedBrand,
    };
  }

  const cf = (request as Request & { cf?: Record<string, unknown> }).cf || {};
  const countryCode = normalizeText(cf.country, '').slice(0, 8);
  const colo = normalizeText(cf.colo, '').slice(0, 32);
  const ipAddress = normalizeText(request.headers.get('CF-Connecting-IP'), '').slice(0, 64);

  let usedAi = false;
  let aiCacheHit = false;
  let aiModel = '';
  let aiResponseJson = '';
  let aiAttemptedAt = '';
  let aiLogText = normalizeText(result.error, '').slice(0, 1200);

  // AI serial decode fallback is intentionally disabled.
  // We want rule-based failures to remain visible so decoder support can be
  // added explicitly instead of masking gaps with an AI-assisted guess.

  let patternKey = '';
  let patternLabel = '';
  let needsAdditionalContext = false;
  let additionalContext: SerialPatternContextPayload | null = null;
  let additionalContextRichText = '';
  let patternLookupId: number | null = null;

  if (result.success && result.info && normalizedBrand) {
    const decodedSerial = normalizeText(result.info.serialNumber, serial).slice(0, 180);
    const decoderPatternKey = normalizeText(result.patternKey, '').slice(0, 180);
    const decoderPatternLabel = normalizeText(result.patternLabel, '').slice(0, 180);
    const patternMeta = decoderPatternKey
      ? {
          patternKey: decoderPatternKey,
          patternLabel: decoderPatternLabel || decoderPatternKey,
        }
      : deriveSerialPatternMeta(normalizedBrand, decodedSerial);
    patternKey = patternMeta.patternKey;
    patternLabel = patternMeta.patternLabel;
    if (result.additionalContext) {
      additionalContext = result.additionalContext;
    } else {
      const contextRow = await dbGetPublishedSerialPatternContext(normalizedBrand, patternMeta.patternKey, env);
      if (contextRow) {
        additionalContext = contextRow;
      } else {
        needsAdditionalContext = true;
      }
    }
    additionalContextRichText = normalizeText(result.additionalContextRichText, '').slice(0, 12000);
  }

  if (patternKey) {
    patternLookupId = await ensureSerialDecodePatternLookup(normalizedBrand, patternKey, env);
    if (!additionalContextRichText) {
      additionalContextRichText = await getSerialDecodePatternRichText(normalizedBrand, patternKey, env);
    }
  }

  let autoEvaluated = false;
  let autoIsInvalid = false;
  if (!result.success && normalizedBrand) {
    const failureMatch = await dbFindPatternLookupIdForFailure(normalizedBrand, serial, env);
    if (failureMatch !== null) {
      patternLookupId = failureMatch.id;
      patternKey = failureMatch.pattern;
      if (await dbPatternIsKnownInvalid(failureMatch.id, env)) {
        autoEvaluated = true;
        autoIsInvalid = true;
      }
      if (!additionalContextRichText && failureMatch.pattern) {
        additionalContextRichText = await getSerialDecodePatternRichText(normalizedBrand, failureMatch.pattern, env);
      }
    }
  }

  const eventPayload: SerialDecodeEventInsert = {
    brand: (result.info?.brand || brand).slice(0, 120),
    serial: (result.info?.serialNumber || serial).slice(0, 180),
    pattern: patternKey || null,
    patternKey: patternKey || null,
    patternLabel: patternLabel || null,
    patternLookupId,
    normalizedBrand: normalizedBrand.slice(0, 120),
    normalizedSerial,
    success: result.success,
    evaluated: autoEvaluated || undefined,
    isInvalid: autoIsInvalid || undefined,
    needsContext: needsAdditionalContext,
    year: normalizeText(result.info?.year, '').slice(0, 120),
    month: normalizeText(result.info?.month, '').slice(0, 120),
    factory: normalizeText(result.info?.factory, '').slice(0, 180),
    country: normalizeText(result.info?.country, '').slice(0, 120),
    model: normalizeText(result.info?.model, '').slice(0, 180),
    notes: normalizeText(result.info?.notes, '').slice(0, 4000),
    error: (usedAi ? aiLogText : normalizeText(result.error, '')).slice(0, 1200),
    usedAi,
    aiCacheHit,
    aiModel,
    aiResponseJson,
    aiAttemptedAt,
    pagePath,
    userAgent,
    clientTimestamp,
    ipAddress,
    countryCode,
    colo,
  };

  const duplicateId = await findRecentSerialDecodeDuplicateId(
    env,
    normalizedBrand.slice(0, 120),
    normalizedSerial,
    ipAddress,
  );

  let serialDecodeEventId: number | null = duplicateId || null;

  if (duplicateId) {
    try {
      await touchSerialDecodeEventTimestamp(env, duplicateId, eventPayload);
    } catch (error) {
      console.error('serial decode event duplicate touch failed', { error, duplicateId });
    }
    if (patternLookupId !== null || autoEvaluated) {
      try {
        const existingCols = SERIAL_DECODE_EVENT_COLS;
        const setClauses: string[] = [];
        const binds: unknown[] = [];
        if (patternLookupId !== null && existingCols.has('pattern_lookup_id')) {
          setClauses.push('pattern_lookup_id = CASE WHEN pattern_lookup_id IS NULL OR pattern_lookup_id = 0 THEN ? ELSE pattern_lookup_id END');
          binds.push(patternLookupId);
        }
        if (autoEvaluated && existingCols.has('evaluated')) {
          setClauses.push('evaluated = CASE WHEN COALESCE(evaluated, 0) = 0 THEN 1 ELSE evaluated END');
        }
        if (autoIsInvalid && existingCols.has('is_invalid')) {
          setClauses.push('is_invalid = CASE WHEN COALESCE(evaluated, 0) = 0 THEN 1 ELSE is_invalid END');
        }
        if (setClauses.length > 0) {
          binds.push(duplicateId);
          await env.DB.prepare(
            `UPDATE serial_decode_events SET ${setClauses.join(', ')} WHERE id = ?`
          ).bind(...binds).run();
        }
      } catch (error) {
        console.error('duplicate row pattern/evaluation backfill failed', { error, duplicateId });
      }
    }
  } else {
    try {
      serialDecodeEventId = await insertSerialDecodeEvent(env, eventPayload);
    } catch (error) {
      console.error('serial decode event insert failed', { error });
    }
  }

  const decodeBrand = normalizeText(result.info?.brand || brand, '').slice(0, 120);
  const decodeSerial = normalizeText(result.info?.serialNumber || serial, '').slice(0, 180);
  const decodeBrandContext = buildBrandActivityContext(decodeBrand, normalizedBrand);
  const decodeEventText = result.success
    ? `User decoded serial #${decodeSerial} in the ${decodeBrandContext.brandLabel} decoder`
    : `User attempted to decode serial #${decodeSerial} in ${decodeBrandContext.brandLabel} decoder`;
  if (!duplicateId) {
    await insertActivityLogBestEffort(env, {
      eventKey: result.success ? 'decode_success' : 'decode_failure',
      eventText: decodeEventText,
      eventUrl: decodeBrandContext.decoderUrl,
      imageUrl: decodeBrandContext.imageUrl,
      entityType: 'serial_decode',
      metadata: {
        brand: decodeBrandContext.brandLabel,
        serial: decodeSerial,
        success: result.success,
      },
    });
  }

  if (result.success) {
    const successBrand = (result.info?.brand || brand).slice(0, 120);
    const successSerial = (result.info?.serialNumber || serial).slice(0, 180);
    try {
      await dbMarkPriorDecodeFailuresAsValid(successBrand, successSerial, env);
    } catch (error) {
      console.error('prior failure auto-mark failed', { error });
    }
  }

  return jsonResponse({
    ...result,
    patternKey: patternKey || undefined,
    patternLabel: patternLabel || undefined,
    needsAdditionalContext,
    additionalContext,
    additionalContextRichText: additionalContextRichText || undefined,
    serialDecodeEventId: serialDecodeEventId || undefined,
  });
}

export async function handleDecodeEmailRequest(request: Request, env: Env): Promise<Response> {
  let body: DecodeEmailRequestPayload = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const decodeEventId = parseBoundedInt(String(body.decodeEventId || ''), 0, 1, 1_000_000_000);
  const brand = normalizeText(body.brand, '').slice(0, 120);
  const serial = normalizeText(body.serial, '').slice(0, 180);
  const email = normalizeText(body.email, '').slice(0, 200).toLowerCase();
  const normalizedBrand = normalizeBrandKey(brand).slice(0, 120);
  const normalizedSerial = normalizeSerialKey(serial).slice(0, 180);

  if (!decodeEventId) return jsonResponse({ message: 'Decode record is required.' }, 400);
  if (!normalizedBrand || !normalizedSerial) return jsonResponse({ message: 'Brand and serial are required.' }, 400);
  if (!isValidEmailAddress(email)) return jsonResponse({ message: 'Enter a valid email address.' }, 400);

  const where = ['id = ?', 'COALESCE(success, 0) = 0', 'normalized_brand = ?', 'normalized_serial = ?'];
  const values: unknown[] = [email, decodeEventId, normalizedBrand, normalizedSerial];

  const result = await env.DB.prepare(
    `UPDATE serial_decode_events
     SET email = ?
     WHERE ${where.join(' AND ')}`
  ).bind(...values).run();

  const updatedCount = Number(result.meta?.changes || 0);
  if (updatedCount < 1) {
    return jsonResponse({ message: 'Unable to attach email to this decode record.' }, 404);
  }

  return jsonResponse({ ok: true });
}
