// Marketplace scout for the CCG Agent (module 'scout'): the front end of the eval pipeline.
//
// scout.scan = what the owner does by hand: Facebook Marketplace, local pickup, newest first,
// run each saved search, scroll, and add new listings to the evaluator. The agent collects
// Marketplace item IDs; new ones go through the normal listing intake (submitListingUrls: Apify
// scrape + auto-queue for Claude), and the eval module then evaluates them. "Blind" on purpose
// (decided 2026-11-25): no price or keyword filtering, only ads and already-known listings are
// skipped.
//
// Scans run every N hours when automatic scans are on (off by default), or on demand from
// Admin > Settings > Agent ("Run scout now", optionally ignoring limits).

import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { submitListingUrls } from '../listings/submit.js';
import { autoQueueListings } from '../eval/queue.js';
import { dbGetJob, dbSetSetting, enqueueAgentJob, type InstanceRow, type JobRow } from './store.js';

// Hard-coded for now (decided 2026-11-25); may become a D1 table. The misspellings are real
// seller spellings that Facebook's search doesn't reliably fold into the correct brand.
export const SCOUT_SEARCHES = [
  'guitar',
  'gibson guitar',
  'fender guitar',
  'kramer guitar',
  'squier guitar',
  'squire guitar',
  'bc rich guitar',
  'b.c. rich guitar',
  'schecter guitar',
  'shecter guitar',
];

export const SCOUT_SCROLLS_PER_SEARCH = 4;
const IGNORE_LIMITS_MAX = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type ScoutSettings = {
  auto: boolean;
  intervalHours: number;
  maxPerScan: number;
  maxPerDay: number;
};

const DEFAULTS: ScoutSettings = { auto: false, intervalHours: 2, maxPerScan: 10, maxPerDay: 30 };

function boundedInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : null;
}

export async function dbGetScoutSettings(env: Env): Promise<ScoutSettings> {
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM agent_settings WHERE key LIKE 'scout_%'",
  ).all<{ key: string; value: string }>();
  const map = new Map((results ?? []).map((row) => [row.key, row.value]));
  return {
    auto: map.has('scout_auto') ? map.get('scout_auto') === '1' : DEFAULTS.auto,
    intervalHours: boundedInt(map.get('scout_interval_hours'), 1, 48) ?? DEFAULTS.intervalHours,
    maxPerScan: boundedInt(map.get('scout_max_per_scan'), 1, IGNORE_LIMITS_MAX) ?? DEFAULTS.maxPerScan,
    maxPerDay: boundedInt(map.get('scout_max_per_day'), 1, 1000) ?? DEFAULTS.maxPerDay,
  };
}

export async function dbSaveScoutSettings(env: Env, body: Record<string, unknown>): Promise<string | null> {
  const updates: Array<[string, string]> = [];
  if (body.auto !== undefined) updates.push(['scout_auto', body.auto === true ? '1' : '0']);
  if (body.intervalHours !== undefined) {
    const n = boundedInt(body.intervalHours, 1, 48);
    if (n == null) return 'Scan interval must be 1–48 hours.';
    updates.push(['scout_interval_hours', String(n)]);
  }
  if (body.maxPerScan !== undefined) {
    const n = boundedInt(body.maxPerScan, 1, IGNORE_LIMITS_MAX);
    if (n == null) return `New listings per scan must be 1–${IGNORE_LIMITS_MAX}.`;
    updates.push(['scout_max_per_scan', String(n)]);
  }
  if (body.maxPerDay !== undefined) {
    const n = boundedInt(body.maxPerDay, 1, 1000);
    if (n == null) return 'New listings per 24 hours must be 1–1000.';
    updates.push(['scout_max_per_day', String(n)]);
  }
  for (const [key, value] of updates) await dbSetSetting(env, key, value);
  return null;
}

/** Listings the scout added in the last 24 hours (sum of finished scout.scan results). */
export async function dbScoutAddedLast24h(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(CAST(json_extract(result_json, '$.added') AS INTEGER)), 0) AS n
     FROM agent_jobs WHERE module = 'scout' AND finished_at > ?`,
  ).bind(Date.now() - DAY_MS).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

async function pendingScan(env: Env): Promise<JobRow | null> {
  return env.DB.prepare(
    "SELECT * FROM agent_jobs WHERE module = 'scout' AND status IN ('queued', 'claimed') ORDER BY created_at DESC LIMIT 1",
  ).first<JobRow>();
}

/** Called when the active agent asks for work: queue a scheduled scan when one is due. */
export async function prepareScoutForClaim(env: Env): Promise<void> {
  const settings = await dbGetScoutSettings(env);
  if (!settings.auto || (await pendingScan(env))) return;
  const last = await env.DB.prepare(
    "SELECT MAX(created_at) AS t FROM agent_jobs WHERE module = 'scout'",
  ).first<{ t: number | null }>();
  if (last?.t && Date.now() - last.t < settings.intervalHours * HOUR_MS) return;
  await enqueueAgentJob(env, {
    module: 'scout', type: 'scan', payload: { trigger: 'schedule', ignoreLimits: false },
    createdBy: 'schedule', maxAttempts: 1,
  });
}

/** "Run scout now" in Admin. Reuses a scan that's already waiting (updating its limits flag). */
export async function queueScoutNow(env: Env, ignoreLimits: boolean, createdBy: string): Promise<JobRow> {
  const pending = await pendingScan(env);
  if (pending?.status === 'claimed') return pending;
  if (pending) {
    await env.DB.prepare('UPDATE agent_jobs SET payload_json = ? WHERE id = ?')
      .bind(JSON.stringify({ trigger: 'manual', ignoreLimits }), pending.id).run();
    return (await dbGetJob(env, pending.id)) ?? pending;
  }
  const { job } = await enqueueAgentJob(env, {
    module: 'scout', type: 'scan', payload: { trigger: 'manual', ignoreLimits }, createdBy, maxAttempts: 1,
  });
  return job;
}

// ---------------------------------------------------------------------------------------
// Agent-facing
// ---------------------------------------------------------------------------------------

async function heldScan(env: Env, instance: InstanceRow, jobId: string): Promise<JobRow | null> {
  const job = await dbGetJob(env, jobId);
  return job && job.module === 'scout' && job.status === 'claimed' && job.claimed_by === instance.id ? job : null;
}

/** POST /api/agent/scout/config { jobId } -> searches, scroll depth, how many new listings to add. */
export async function agentScoutConfig(env: Env, instance: InstanceRow, jobId: string): Promise<Record<string, unknown> | null> {
  const job = await heldScan(env, instance, jobId);
  if (!job) return null;
  const payload = job.payload_json ? (JSON.parse(job.payload_json) as { ignoreLimits?: boolean }) : {};
  const ignoreLimits = payload.ignoreLimits === true;
  const [settings, addedToday] = await Promise.all([dbGetScoutSettings(env), dbScoutAddedLast24h(env)]);
  return {
    searches: SCOUT_SEARCHES,
    scrollsPerSearch: SCOUT_SCROLLS_PER_SEARCH,
    ignoreLimits,
    maxNew: ignoreLimits ? IGNORE_LIMITS_MAX : Math.max(0, Math.min(settings.maxPerScan, settings.maxPerDay - addedToday)),
  };
}

function facebookItemUrl(id: string): string {
  return `https://www.facebook.com/marketplace/item/${id}/`;
}

/** POST /api/agent/scout/known { jobId, ids } -> { known: ids already in the evaluator }. */
export async function agentScoutKnown(env: Env, instance: InstanceRow, jobId: string, ids: string[]): Promise<string[] | null> {
  if (!(await heldScan(env, instance, jobId))) return null;
  const known: string[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const placeholders = chunk.map(() => '?').join(', ');
    const { results } = await env.DB.prepare(`SELECT url FROM listings WHERE url IN (${placeholders})`)
      .bind(...chunk.map(facebookItemUrl)).all<{ url: string }>();
    const urls = new Set((results ?? []).map((row) => row.url));
    known.push(...chunk.filter((id) => urls.has(facebookItemUrl(id))));
  }
  return known;
}

/** POST /api/agent/scout/submit { jobId, ids } -> adds them through the normal listing intake. */
export async function agentScoutSubmit(
  env: Env,
  ctx: ExecutionContext,
  instance: InstanceRow,
  jobId: string,
  ids: string[],
): Promise<Record<string, unknown> | null> {
  if (!(await heldScan(env, instance, jobId))) return null;
  const { queued, rejected } = await submitListingUrls(ids.map(facebookItemUrl), env, ctx);
  await autoQueueListings(env, queued.map((item) => item.recordId));
  return {
    accepted: queued.length,
    rejected: rejected.map((item) => ({ url: item.url, reason: normalizeText(item.reason, '') })),
  };
}

export async function scoutSettingsResponse(env: Env): Promise<Record<string, unknown>> {
  const [settings, last24h, pending] = await Promise.all([dbGetScoutSettings(env), dbScoutAddedLast24h(env), pendingScan(env)]);
  return {
    settings,
    searches: SCOUT_SEARCHES,
    last24h,
    pendingScan: pending ? { id: pending.id, status: pending.status } : null,
  };
}
