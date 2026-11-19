import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';

// Finds inventory photos in R2 that nothing in D1 references any more (uploads from
// cancelled "New" items, photos removed from an item, etc.) and optionally deletes them.
//
// Reference detection is deliberately broad and fails closed:
//   - Every text column of every D1 table is scanned for cells mentioning an inventory
//     image (raw or URL-encoded key), so a reference added by future code is still seen.
//   - Objects are matched by the UUID in their file name, which is the same whether the
//     stored URL is encoded (inventory-items%2F...) or not.
//   - Any D1 error aborts the run before anything is deleted.
//   - Objects whose key has no UUID are never deleted.
//   - Objects younger than minAgeDays are never deleted (protects in-progress new items).

const PREFIX = 'inventory-items/';
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const DEFAULT_MIN_AGE_DAYS = 7;
const MIN_MIN_AGE_DAYS = 1;
// R2's multi-key delete accepts up to 1000 keys, but large batches trip its
// per-request rate limit (error 10058). Small batches with backoff are reliable.
const R2_DELETE_BATCH = 50;
const DELETE_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];
// Stop deleting after this long and report the remainder; just re-run to continue.
const DELETE_TIME_BUDGET_MS = 60_000;
const SAMPLE_SIZE = 25;

type Mode = 'report' | 'delete';

type ObjectInfo = { key: string; size: number; uploaded: Date };

type Bucket = { count: number; bytes: number };

function emptyBucket(): Bucket {
  return { count: 0, bytes: 0 };
}

function addTo(bucket: Bucket, size: number): void {
  bucket.count += 1;
  bucket.bytes += size;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

function withHuman(bucket: Bucket) {
  return { ...bucket, size: formatBytes(bucket.bytes) };
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function uuidFromKey(key: string): string | null {
  const fileName = key.slice(key.lastIndexOf('/') + 1);
  const match = fileName.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

async function collectReferencedUuids(env: Env): Promise<{
  uuids: Set<string>;
  sources: Record<string, number>;
  tablesScanned: number;
  columnsScanned: number;
}> {
  const tables = await env.DB.prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '_cf_%'
       AND name NOT LIKE 'd1_%'`
  ).all<{ name: string }>();

  const uuids = new Set<string>();
  const sources: Record<string, number> = {};
  let columnsScanned = 0;
  const tableNames = (tables.results ?? []).map((row) => row.name);

  for (const table of tableNames) {
    const columns = await env.DB.prepare(`PRAGMA table_info(${quoteIdent(table)})`)
      .all<{ name: string; type: string }>();
    for (const column of columns.results ?? []) {
      const type = (column.type || '').toUpperCase();
      // SQLite text affinity: TEXT/CHAR/CLOB, or untyped columns (which can hold anything).
      const isTextLike = type === '' || type.includes('TEXT') || type.includes('CHAR') || type.includes('CLOB');
      if (!isTextLike) continue;
      columnsScanned += 1;

      const col = quoteIdent(column.name);
      const rows = await env.DB.prepare(
        `SELECT ${col} AS v FROM ${quoteIdent(table)}
         WHERE ${col} LIKE '%inventory-items%' OR ${col} LIKE '%inventory-image%'`
      ).all<{ v: unknown }>();

      let hits = 0;
      for (const row of rows.results ?? []) {
        if (typeof row.v !== 'string') continue;
        const found = row.v.match(UUID_RE);
        if (!found) continue;
        hits += 1;
        for (const id of found) uuids.add(id.toLowerCase());
      }
      if (hits > 0) sources[`${table}.${column.name}`] = hits;
    }
  }

  return { uuids, sources, tablesScanned: tableNames.length, columnsScanned };
}

async function listInventoryObjects(bucket: R2Bucket): Promise<ObjectInfo[]> {
  const objects: ObjectInfo[] = [];
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const obj of listed.objects) {
      objects.push({ key: obj.key, size: obj.size, uploaded: obj.uploaded });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return objects;
}

async function deleteBatchWithRetry(bucket: R2Bucket, keys: string[]): Promise<string | null> {
  let lastError = '';
  for (let attempt = 0; attempt <= DELETE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await bucket.delete(keys);
      return null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < DELETE_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, DELETE_RETRY_DELAYS_MS[attempt]));
      }
    }
  }
  return lastError;
}

function parseOptions(url: URL, body: Record<string, unknown>) {
  const pick = (name: string): unknown => body[name] ?? url.searchParams.get(name) ?? undefined;

  const rawMode = String(pick('mode') ?? 'report').trim().toLowerCase();
  if (rawMode !== 'report' && rawMode !== 'delete') {
    return { error: `mode must be "report" or "delete" (got "${rawMode}").` } as const;
  }

  const rawAge = pick('minAgeDays');
  const minAgeDays = rawAge === undefined || rawAge === '' ? DEFAULT_MIN_AGE_DAYS : Number(rawAge);
  if (!Number.isFinite(minAgeDays) || minAgeDays < MIN_MIN_AGE_DAYS) {
    return { error: `minAgeDays must be a number >= ${MIN_MIN_AGE_DAYS}.` } as const;
  }

  const rawLimit = pick('limit');
  const limit = rawLimit === undefined || rawLimit === '' ? null : Number(rawLimit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    return { error: 'limit must be a positive integer.' } as const;
  }

  return { mode: rawMode as Mode, minAgeDays, limit } as const;
}

export async function handleInventoryImageOrphans(request: Request, env: Env): Promise<Response> {
  const bucket = env.CUSTOM_ITEMS_BUCKET;
  if (!bucket) {
    return jsonResponse({ message: 'R2 bucket is not configured.' }, 500);
  }

  let body: Record<string, unknown> = {};
  if ((request.headers.get('content-type') || '').includes('application/json')) {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
    }
  }

  const options = parseOptions(new URL(request.url), body);
  if ('error' in options) {
    return jsonResponse({ message: options.error }, 400);
  }
  const { mode, minAgeDays, limit } = options;

  const startedAt = Date.now();

  let refs: Awaited<ReturnType<typeof collectReferencedUuids>>;
  try {
    refs = await collectReferencedUuids(env);
  } catch (error) {
    console.error('Orphan scan: D1 reference scan failed', { error });
    return jsonResponse({
      message: 'Reference scan failed; nothing was deleted.',
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }

  const objects = await listInventoryObjects(bucket);
  const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;

  const total = emptyBucket();
  const referenced = emptyBucket();
  const unrecognized = emptyBucket();
  const orphanTooNew = emptyBucket();
  const orphanEligible = emptyBucket();
  const eligibleByMonth: Record<string, Bucket> = {};
  const eligible: ObjectInfo[] = [];
  const unrecognizedSample: string[] = [];

  for (const obj of objects) {
    addTo(total, obj.size);
    const id = uuidFromKey(obj.key);
    if (!id) {
      addTo(unrecognized, obj.size);
      if (unrecognizedSample.length < SAMPLE_SIZE) unrecognizedSample.push(obj.key);
      continue;
    }
    if (refs.uuids.has(id)) {
      addTo(referenced, obj.size);
      continue;
    }
    if (obj.uploaded.getTime() > cutoff) {
      addTo(orphanTooNew, obj.size);
      continue;
    }
    addTo(orphanEligible, obj.size);
    eligible.push(obj);
    const month = obj.uploaded.toISOString().slice(0, 7);
    eligibleByMonth[month] ??= emptyBucket();
    addTo(eligibleByMonth[month], obj.size);
  }

  eligible.sort((a, b) => a.uploaded.getTime() - b.uploaded.getTime());

  const result: Record<string, unknown> = {
    ok: true,
    mode,
    minAgeDays,
    limit,
    scan: {
      d1TablesScanned: refs.tablesScanned,
      d1TextColumnsScanned: refs.columnsScanned,
      referenceSources: refs.sources,
      referencedUuidCount: refs.uuids.size,
    },
    r2: {
      prefix: PREFIX,
      total: withHuman(total),
      referenced: withHuman(referenced),
      orphanEligible: withHuman(orphanEligible),
      orphanTooNew: withHuman(orphanTooNew),
      unrecognizedKeys: withHuman(unrecognized),
      eligibleByMonth: Object.fromEntries(
        Object.entries(eligibleByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([m, b]) => [m, withHuman(b)]),
      ),
    },
    sampleEligibleKeys: eligible.slice(0, SAMPLE_SIZE).map((o) => ({
      key: o.key,
      size: formatBytes(o.size),
      uploaded: o.uploaded.toISOString(),
    })),
    sampleUnrecognizedKeys: unrecognizedSample,
  };

  if (mode === 'delete') {
    // Sanity guard: if objects exist but nothing at all looked referenced, the scan is
    // almost certainly wrong (schema change, encoding change). Refuse to delete.
    if (total.count > 0 && referenced.count === 0) {
      return jsonResponse({
        ...result,
        ok: false,
        message: 'Refusing to delete: no R2 objects matched any D1 reference, which suggests the scan is broken.',
      }, 409);
    }

    const toDelete = limit === null ? eligible : eligible.slice(0, limit);
    const deleted = emptyBucket();
    const failures: Array<{ keys: number; error: string }> = [];
    const deleteStartedAt = Date.now();
    let stoppedEarly = false;
    for (let i = 0; i < toDelete.length; i += R2_DELETE_BATCH) {
      if (Date.now() - deleteStartedAt > DELETE_TIME_BUDGET_MS) {
        stoppedEarly = true;
        break;
      }
      const batch = toDelete.slice(i, i + R2_DELETE_BATCH);
      const error = await deleteBatchWithRetry(bucket, batch.map((o) => o.key));
      if (error) {
        failures.push({ keys: batch.length, error });
      } else {
        for (const o of batch) addTo(deleted, o.size);
      }
    }
    result.stoppedEarly = stoppedEarly;
    result.deleted = withHuman(deleted);
    result.remainingEligible = withHuman({
      count: orphanEligible.count - deleted.count,
      bytes: orphanEligible.bytes - deleted.bytes,
    });
    if (failures.length > 0) {
      result.ok = false;
      result.deleteFailures = failures;
    }
    console.log('Orphan inventory image purge', { deleted, failures: failures.length });
  }

  result.elapsedMs = Date.now() - startedAt;
  return jsonResponse(result, result.ok ? 200 : 500);
}
