import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';

export type AdminV2SerialDecodeRow = {
  id: number;
  eventTimeUtc: string | null;
  clientTimestamp: string | null;
  brand: string;
  serial: string;
  email: string | null;
  patternLookupId: number | null;
  success: boolean;
  evaluated: boolean;
  year: string | null;
  factory: string | null;
  country: string | null;
  error: string | null;
};

export type AdminV2SerialDecodeBrandResponseRow = {
  brand: string;
  responseCount: number;
};

export type AdminV2SerialLookupVolumeView = 'day' | 'month';

export type AdminV2SerialLookupVolumeBucket = {
  key: string;
  label: string;
  responseCount: number;
  successCount: number;
  failureCount: number;
};

export async function dbListAdminV2SerialDecodes(
  page: number,
  limit: number,
  brand: string,
  onlyErrors: boolean,
  unevaluated: boolean,
  sortDir: 'asc' | 'desc',
  env: Env,
): Promise<{
  records: AdminV2SerialDecodeRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  availableBrands: string[];
}> {
  const where: string[] = [];
  const values: unknown[] = [];
  const db = env.DB.withSession('first-primary');

  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }
  if (onlyErrors) {
    where.push(`COALESCE(success, 0) = 0`);
  }
  if (unevaluated) {
    where.push(`COALESCE(evaluated, 0) = 0`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await db.prepare(
    `SELECT COUNT(*) AS total FROM serial_decode_events ${whereSql}`
  ).bind(...values).first<{ total: number | null }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectivePage = Math.min(Math.max(1, page), totalPages);
  const offset = (effectivePage - 1) * limit;

  const availableBrands = await dbGetSerialDecodeBrandOptions(env);

  let rows;
  try {
    rows = await db.prepare(
      `SELECT
        e.id,
        e.event_time_utc,
        e.client_timestamp,
        e.brand,
        e.serial,
        e.email,
        e.pattern_lookup_id,
        e.success,
        e.evaluated,
        e.year,
        e.factory,
        e.country,
        e.error,
        CASE WHEN COALESCE(e.g_ai_analysis, '') <> '' THEN 1 ELSE 0 END AS has_g_ai_analysis,
        COALESCE(
          datetime(e.client_timestamp),
          datetime(e.event_time_utc),
          datetime(e.created_at)
        ) AS sort_ts
       FROM serial_decode_events e
       ${whereSql}
       ORDER BY sort_ts ${sortDir.toUpperCase()}, id ${sortDir.toUpperCase()}
       LIMIT ? OFFSET ?`
    ).bind(...values, limit, offset).all<{
      id: number | null;
      event_time_utc: string | null;
      client_timestamp: string | null;
      brand: string | null;
      serial: string | null;
      email: string | null;
      pattern_lookup_id: number | null;
      success: number | null;
      evaluated: number | null;
      year: string | null;
      factory: string | null;
      country: string | null;
      error: string | null;
      has_g_ai_analysis: number | null;
    }>();
  } catch (error) {
    console.warn('Serial decode list query fell back to legacy schema', { error });
    rows = await db.prepare(
      `SELECT
        e.id,
        e.event_time_utc,
        e.client_timestamp,
        e.brand,
        e.serial,
        e.success,
        e.evaluated,
        e.year,
        e.factory,
        e.country,
        e.error,
        COALESCE(
          datetime(e.client_timestamp),
          datetime(e.event_time_utc),
          datetime(e.created_at)
        ) AS sort_ts
       FROM serial_decode_events e
       ${whereSql}
       ORDER BY sort_ts ${sortDir.toUpperCase()}, id ${sortDir.toUpperCase()}
       LIMIT ? OFFSET ?`
    ).bind(...values, limit, offset).all<{
      id: number | null;
      event_time_utc: string | null;
      client_timestamp: string | null;
      brand: string | null;
      serial: string | null;
      success: number | null;
      evaluated: number | null;
      year: string | null;
      factory: string | null;
      country: string | null;
      error: string | null;
    }>();
  }

  const records = (rows.results ?? []).map((row) => ({
    id: Number(row.id || 0),
    eventTimeUtc: typeof row.event_time_utc === 'string' ? row.event_time_utc : null,
    clientTimestamp: typeof row.client_timestamp === 'string' ? row.client_timestamp : null,
    brand: normalizeText(row.brand, ''),
    serial: normalizeText(row.serial, ''),
    patternLookupId: Number((row as { pattern_lookup_id?: number | null }).pattern_lookup_id || 0) || null,
    email: normalizeText((row as { email?: string | null }).email, '') || null,
    success: Number(row.success || 0) === 1,
    evaluated: Number(row.evaluated || 0) === 1,
    year: normalizeText(row.year, '') || null,
    factory: normalizeText(row.factory, '') || null,
    country: normalizeText(row.country, '') || null,
    error: normalizeText(row.error, '') || null,
    hasGAiAnalysis: Number((row as { has_g_ai_analysis?: number | null }).has_g_ai_analysis || 0) === 1,
  }));

  return {
    records,
    page: effectivePage,
    limit,
    total,
    totalPages,
    availableBrands,
  };
}

export async function dbGetAdminV2SerialDecodeBrandResponses(
  brand: string,
  env: Env,
): Promise<AdminV2SerialDecodeBrandResponseRow[]> {
  const where: string[] = [`trim(COALESCE(brand, '')) <> ''`];
  const values: unknown[] = [];

  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT
      trim(brand) AS brand,
      COUNT(*) AS response_count
     FROM serial_decode_events
     ${whereSql}
     GROUP BY lower(trim(brand))
     ORDER BY response_count DESC, lower(trim(brand)) ASC`
  ).bind(...values).all<{
    brand: string | null;
    response_count: number | null;
  }>();

  return (rows.results ?? []).map((row) => ({
    brand: normalizeText(row.brand, ''),
    responseCount: Number(row.response_count || 0),
  }));
}

export async function dbGetAdminV2SerialDecodeLookupVolume(
  view: AdminV2SerialLookupVolumeView,
  brand: string,
  env: Env,
): Promise<{
  view: AdminV2SerialLookupVolumeView;
  records: AdminV2SerialLookupVolumeBucket[];
  availableBrands: string[];
}> {
  const db = env.DB.withSession('first-primary');
  const bucketDates = getRecentDenverBucketDates(view, 30);
  // Oldest bucket's noon anchor, less a day (or a month) of margin; buckets outside the
  // window are dropped when bucketing.
  const windowStart = new Date(bucketDates[bucketDates.length - 1].getTime());
  if (view === 'month') windowStart.setUTCMonth(windowStart.getUTCMonth() - 1);
  else windowStart.setUTCDate(windowStart.getUTCDate() - 1);

  const where: string[] = [`event_time_utc >= ?`];
  const values: unknown[] = [windowStart.toISOString()];
  if (brand) {
    where.push(`lower(trim(brand)) = lower(trim(?))`);
    values.push(brand);
  }

  // Counted per UTC hour in SQL (Denver's offset is always whole hours, so each hour maps
  // cleanly onto one Denver day); shipping every event row to the Worker and formatting each
  // one in JS took seconds of CPU and stalled the other admin requests behind it.
  const [hourRows, availableBrands] = await Promise.all([
    db.prepare(
      `SELECT
        substr(event_time_utc, 1, 13) AS utc_hour,
        COUNT(*) AS total,
        SUM(CASE WHEN COALESCE(success, 0) = 1 THEN 1 ELSE 0 END) AS successes
       FROM serial_decode_events
       WHERE ${where.join(' AND ')}
       GROUP BY utc_hour`,
    ).bind(...values).all<{ utc_hour: string | null; total: number | null; successes: number | null }>(),
    dbGetSerialDecodeBrandOptions(env),
  ]);

  const records = buildSerialLookupVolumeBuckets(view, bucketDates, hourRows.results ?? []);
  return {
    view,
    records,
    availableBrands,
  };
}

export async function dbGetAdminV2SerialDecodeDailyVolume(
  dateStr: string,
  env: Env,
): Promise<number[]> {
  const { startUtc, endUtc } = getDenverDayUtcBounds(dateStr);

  const rows = await env.DB.prepare(
    `SELECT event_time_utc
     FROM serial_decode_events
     WHERE event_time_utc >= ? AND event_time_utc < ?`,
  ).bind(startUtc, endUtc).all<{ event_time_utc: string | null }>();

  const buckets = new Array(48).fill(0) as number[];

  for (const row of (rows.results ?? [])) {
    if (!row.event_time_utc) continue;
    const date = new Date(row.event_time_utc);
    if (Number.isNaN(date.getTime())) continue;
    const idx = getDenverHalfHourBucketIndex(date);
    if (idx >= 0 && idx < 48) buckets[idx]++;
  }

  return buckets;
}

// The brand dropdown scans every event; the brand list barely changes, so it is cached per
// Worker isolate for a few minutes.
const BRAND_OPTIONS_TTL_MS = 5 * 60_000;
let brandOptionsCache: { brands: string[]; expiresAt: number } | null = null;

async function dbGetSerialDecodeBrandOptions(env: Env): Promise<string[]> {
  if (brandOptionsCache && brandOptionsCache.expiresAt > Date.now()) return brandOptionsCache.brands;
  const brandRows = await env.DB.prepare(
    `SELECT MIN(trim(brand)) AS brand
     FROM serial_decode_events
     WHERE trim(COALESCE(brand, '')) <> ''
     GROUP BY lower(trim(brand))
     ORDER BY lower(trim(brand)) ASC`
  ).all<{ brand: string | null }>();
  const brands = (brandRows.results ?? [])
    .map((row) => normalizeText(row.brand, ''))
    .filter(Boolean);
  brandOptionsCache = { brands, expiresAt: Date.now() + BRAND_OPTIONS_TTL_MS };
  return brands;
}

function buildSerialLookupVolumeBuckets(
  view: AdminV2SerialLookupVolumeView,
  bucketDates: Date[],
  rows: Array<{ utc_hour: string | null; total: number | null; successes: number | null }>,
): AdminV2SerialLookupVolumeBucket[] {
  const counts = new Map<string, number>();
  const successCounts = new Map<string, number>();
  const failureCounts = new Map<string, number>();
  for (const bucketDate of bucketDates) {
    const k = getDenverBucketKey(view, bucketDate);
    counts.set(k, 0);
    successCounts.set(k, 0);
    failureCounts.set(k, 0);
  }

  for (const row of rows) {
    if (!row.utc_hour) continue;
    const eventDate = new Date(`${row.utc_hour}:00:00Z`);
    if (Number.isNaN(eventDate.getTime())) continue;
    const key = getDenverBucketKey(view, eventDate);
    if (!counts.has(key)) continue;
    const total = Number(row.total || 0);
    const successes = Number(row.successes || 0);
    counts.set(key, Number(counts.get(key) || 0) + total);
    successCounts.set(key, Number(successCounts.get(key) || 0) + successes);
    failureCounts.set(key, Number(failureCounts.get(key) || 0) + total - successes);
  }

  return bucketDates.map((bucketDate) => {
    const key = getDenverBucketKey(view, bucketDate);
    return {
      key,
      label: formatDenverBucketLabel(view, bucketDate),
      responseCount: Number(counts.get(key) || 0),
      successCount: Number(successCounts.get(key) || 0),
      failureCount: Number(failureCounts.get(key) || 0),
    };
  });
}

function getRecentDenverBucketDates(view: AdminV2SerialLookupVolumeView, count: number): Date[] {
  const now = new Date();
  const denverNowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const denverYear = Number(denverNowParts.find((part) => part.type === 'year')?.value || now.getUTCFullYear());
  const denverMonth = Number(denverNowParts.find((part) => part.type === 'month')?.value || now.getUTCMonth() + 1);
  const denverDay = Number(denverNowParts.find((part) => part.type === 'day')?.value || now.getUTCDate());

  const anchor = view === 'month'
    ? new Date(Date.UTC(denverYear, denverMonth - 1, 1, 12, 0, 0))
    : new Date(Date.UTC(denverYear, denverMonth - 1, denverDay, 12, 0, 0));

  const dates: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const cursor = new Date(anchor.getTime());
    if (view === 'month') {
      cursor.setUTCMonth(cursor.getUTCMonth() - index);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() - index);
    }
    dates.push(cursor);
  }
  return dates;
}

const DENVER_DATE_PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getDenverBucketKey(view: AdminV2SerialLookupVolumeView, date: Date): string {
  const parts = DENVER_DATE_PARTS_FORMAT.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  if (view === 'month') {
    return `${year}-${month}`;
  }
  return `${year}-${month}-${day}`;
}

function formatDenverBucketLabel(view: AdminV2SerialLookupVolumeView, date: Date): string {
  if (view === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      month: 'short',
      year: 'numeric',
    }).format(date).replace(/\s+/g, '-');
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getDenverDayUtcBounds(dateStr: string): { startUtc: string; endUtc: string } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  for (const offsetHours of [6, 7]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0));
    const parts = fmt.formatToParts(candidate);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '99', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '99', 10);
    if (h === 0 && m === 0) {
      const end = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      return { startUtc: candidate.toISOString(), endUtc: end.toISOString() };
    }
  }

  // Fallback: assume MST (UTC-7)
  const start = new Date(Date.UTC(year, month - 1, day, 7, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

function getDenverHalfHourBucketIndex(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return Math.floor((hour * 60 + minute) / 30);
}
