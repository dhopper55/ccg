// The CCG Eval queue (table eval_queue, see d1-add-eval-queue.sql).

import type { Env } from '../env.js';
import type { EvalKind } from './db.js';
import { safeJsonParse } from './util.js';

export const STALE_IN_PROGRESS_MS = 15 * 60 * 1000;

export type QueueOptions = { build_listing: boolean; deep: boolean };

export type QueueRow = {
  id: string;
  kind: EvalKind;
  record_id: string;
  user_id: string;
  options_json: string | null;
  status: 'queued' | 'in_progress' | 'done' | 'failed' | 'removed';
  added_at: number;
  started_at: number | null;
  finished_at: number | null;
  evaluation_id: string | null;
  error: string | null;
};

export function queueOptions(row: Pick<QueueRow, 'options_json'> | null): QueueOptions {
  const raw = safeJsonParse<Partial<QueueOptions>>(row?.options_json ?? null) || {};
  return { build_listing: raw.build_listing === true, deep: raw.deep === true };
}

// An entry claimed by Claude but not finished in 15 minutes (Claude stopped mid-item) goes back
// to the front of the queue.
async function requeueStale(env: Env): Promise<void> {
  await env.DB.prepare(
    "UPDATE eval_queue SET status = 'queued', started_at = NULL WHERE status = 'in_progress' AND started_at < ?"
  ).bind(Date.now() - STALE_IN_PROGRESS_MS).run();
}

export async function dbGetActiveQueueEntry(env: Env, kind: EvalKind, recordId: string): Promise<QueueRow | null> {
  return env.DB.prepare(
    "SELECT * FROM eval_queue WHERE kind = ? AND record_id = ? AND status IN ('queued', 'in_progress') LIMIT 1"
  ).bind(kind, recordId).first<QueueRow>();
}

export async function dbGetLatestQueueEntry(env: Env, kind: EvalKind, recordId: string): Promise<QueueRow | null> {
  return env.DB.prepare(
    "SELECT * FROM eval_queue WHERE kind = ? AND record_id = ? AND status <> 'removed' ORDER BY added_at DESC LIMIT 1"
  ).bind(kind, recordId).first<QueueRow>();
}

export async function dbGetQueueEntry(env: Env, id: string): Promise<QueueRow | null> {
  return env.DB.prepare('SELECT * FROM eval_queue WHERE id = ? LIMIT 1').bind(id).first<QueueRow>();
}

// 1-based place in line among waiting entries (0 when not waiting).
export async function dbQueuePosition(env: Env, row: QueueRow): Promise<number> {
  if (row.status !== 'queued') return 0;
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS ahead FROM eval_queue WHERE status = 'queued' AND (added_at < ? OR (added_at = ? AND id < ?))"
  ).bind(row.added_at, row.added_at, row.id).first<{ ahead: number }>();
  return Number(result?.ahead || 0) + 1;
}

export async function dbCountQueued(env: Env): Promise<number> {
  const result = await env.DB.prepare("SELECT COUNT(*) AS total FROM eval_queue WHERE status = 'queued'")
    .first<{ total: number }>();
  return Number(result?.total || 0);
}

// Add an item (or return the entry it already has).
export async function dbEnqueue(
  env: Env,
  entry: { kind: EvalKind; recordId: string; userId: string; options: QueueOptions },
): Promise<{ row: QueueRow; created: boolean }> {
  const existing = await dbGetActiveQueueEntry(env, entry.kind, entry.recordId);
  if (existing) return { row: existing, created: false };
  const row: QueueRow = {
    id: crypto.randomUUID(),
    kind: entry.kind,
    record_id: entry.recordId,
    user_id: entry.userId,
    options_json: JSON.stringify(entry.options),
    status: 'queued',
    added_at: Date.now(),
    started_at: null,
    finished_at: null,
    evaluation_id: null,
    error: null,
  };
  try {
    await env.DB.prepare(
      `INSERT INTO eval_queue (id, kind, record_id, user_id, options_json, status, added_at)
       VALUES (?, ?, ?, ?, ?, 'queued', ?)`
    ).bind(row.id, row.kind, row.record_id, row.user_id, row.options_json, row.added_at).run();
  } catch (error) {
    // Lost a race with another tap: the unique index allows one active entry per item.
    const raced = await dbGetActiveQueueEntry(env, entry.kind, entry.recordId);
    if (raced) return { row: raced, created: false };
    throw error;
  }
  return { row, created: true };
}

// Only a waiting entry can be removed (one Claude is working on finishes on its own).
export async function dbRemoveFromQueue(env: Env, id: string): Promise<boolean> {
  const result = await env.DB.prepare(
    "UPDATE eval_queue SET status = 'removed', finished_at = ? WHERE id = ? AND status = 'queued'"
  ).bind(Date.now(), id).run();
  return Number(result.meta?.changes || 0) === 1;
}

// A listing shared from the phone is queued before its scrape finishes. Claude skips it until
// the scrape is done (listing status no longer 'queued'/'processing'), or for at most this long
// so a stuck scrape cannot hold its place forever.
export const LOADING_GRACE_MS = 10 * 60 * 1000;

const STILL_LOADING_SQL = `q.kind = 'listing' AND q.added_at >= ? AND EXISTS (
  SELECT 1 FROM listings l WHERE l.id = CAST(q.record_id AS INTEGER) AND l.status IN ('queued', 'processing'))`;

// Waiting listings whose photos and details are still being fetched.
export async function dbCountLoading(env: Env): Promise<number> {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM eval_queue q WHERE q.status = 'queued' AND ${STILL_LOADING_SQL}`
  ).bind(Date.now() - LOADING_GRACE_MS).first<{ total: number }>();
  return Number(result?.total || 0);
}

// Claim the oldest waiting entry that is ready for Claude.
export async function dbClaimNext(env: Env): Promise<QueueRow | null> {
  await requeueStale(env);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = await env.DB.prepare(
      `SELECT q.* FROM eval_queue q WHERE q.status = 'queued' AND NOT (${STILL_LOADING_SQL})
       ORDER BY q.added_at ASC, q.id ASC LIMIT 1`
    ).bind(Date.now() - LOADING_GRACE_MS).first<QueueRow>();
    if (!next) return null;
    const now = Date.now();
    const claimed = await env.DB.prepare(
      "UPDATE eval_queue SET status = 'in_progress', started_at = ? WHERE id = ? AND status = 'queued'"
    ).bind(now, next.id).run();
    if (Number(claimed.meta?.changes || 0) === 1) return { ...next, status: 'in_progress', started_at: now };
  }
  return null;
}

export function dbMarkQueueDoneStatement(env: Env, id: string, evaluationId: string): D1PreparedStatement {
  return env.DB.prepare(
    "UPDATE eval_queue SET status = 'done', finished_at = ?, evaluation_id = ?, error = NULL WHERE id = ? AND status IN ('in_progress', 'queued')"
  ).bind(Date.now(), evaluationId, id);
}

export async function dbMarkQueueFailed(env: Env, id: string, reason: string): Promise<boolean> {
  const result = await env.DB.prepare(
    "UPDATE eval_queue SET status = 'failed', finished_at = ?, error = ? WHERE id = ? AND status IN ('in_progress', 'queued')"
  ).bind(Date.now(), reason.slice(0, 300), id).run();
  return Number(result.meta?.changes || 0) === 1;
}

// ---------------------------------------------------------------------------------------------
// Listing evaluator results list: a Claude status per row, and "Queue All".
// ---------------------------------------------------------------------------------------------

export type ListingClaudeState = {
  state: 'queued' | 'evaluating' | 'evaluated' | 'skipped' | 'none';
  position?: number;
  at?: number | null;
  // Marked evaluated in bulk (no saved analysis from Claude).
  marked?: boolean;
};

// Claude status for each listing id: the latest queue entry plus any saved evaluation.
export async function dbListingClaudeStates(env: Env, ids: string[]): Promise<Map<string, ListingClaudeState>> {
  const states = new Map<string, ListingClaudeState>();
  if (!ids.length) return states;
  const marks = ids.map(() => '?').join(',');
  const [entries, evaluations, waiting] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, record_id, status, finished_at FROM eval_queue
       WHERE kind = 'listing' AND status <> 'removed' AND record_id IN (${marks})
       ORDER BY added_at DESC`
    ).bind(...ids),
    env.DB.prepare(
      `SELECT record_id, MAX(created_at) AS at FROM evaluations
       WHERE kind = 'listing' AND status = 'saved' AND record_id IN (${marks})
       GROUP BY record_id`
    ).bind(...ids),
    env.DB.prepare("SELECT id FROM eval_queue WHERE status = 'queued' ORDER BY added_at ASC, id ASC"),
  ]);

  const latestEntry = new Map<string, { id: string; status: QueueRow['status']; finished_at: number | null }>();
  for (const row of (entries.results ?? []) as Array<{ id: string; record_id: string; status: QueueRow['status']; finished_at: number | null }>) {
    if (!latestEntry.has(row.record_id)) latestEntry.set(row.record_id, row);
  }
  const evaluatedAt = new Map<string, number>();
  for (const row of (evaluations.results ?? []) as Array<{ record_id: string; at: number }>) {
    evaluatedAt.set(row.record_id, Number(row.at));
  }
  const position = new Map<string, number>();
  ((waiting.results ?? []) as Array<{ id: string }>).forEach((row, index) => position.set(row.id, index + 1));

  for (const id of ids) {
    const entry = latestEntry.get(id);
    const savedAt = evaluatedAt.get(id) ?? null;
    if (entry?.status === 'queued') states.set(id, { state: 'queued', position: position.get(entry.id) ?? 0 });
    else if (entry?.status === 'in_progress') states.set(id, { state: 'evaluating' });
    else if (savedAt != null) states.set(id, { state: 'evaluated', at: savedAt });
    else if (entry?.status === 'done') states.set(id, { state: 'evaluated', at: entry.finished_at, marked: true });
    else if (entry?.status === 'failed') states.set(id, { state: 'skipped', at: entry.finished_at });
    else states.set(id, { state: 'none' });
  }
  return states;
}

// Listings on the main results list (not saved, not archived, scrape not failed) that Claude has
// never been asked about: no queue entry other than removed ones and no saved evaluation.
// Skipped listings are left out (they would just be skipped again). Newest first, like the list.
export async function dbUnqueuedListingIds(env: Env): Promise<string[]> {
  const result = await env.DB.prepare(
    `SELECT l.id FROM listings l
     WHERE (l.archived IS NULL OR l.archived = 0)
       AND (l.saved IS NULL OR l.saved = 0)
       AND COALESCE(l.status, '') <> 'failed'
       AND NOT EXISTS (SELECT 1 FROM eval_queue q
                       WHERE q.kind = 'listing' AND q.record_id = CAST(l.id AS TEXT) AND q.status <> 'removed')
       AND NOT EXISTS (SELECT 1 FROM evaluations e
                       WHERE e.kind = 'listing' AND e.record_id = CAST(l.id AS TEXT) AND e.status = 'saved')
     ORDER BY COALESCE(l.submitted_at, l.created_at) DESC, l.id DESC`
  ).all<{ id: number }>();
  return (result.results ?? []).map((row) => String(row.id));
}

// Queue many listings at once, in the order given (Claude works through them in that order).
export async function dbEnqueueListings(env: Env, ids: string[], userId: string): Promise<number> {
  const base = Date.now();
  const options = JSON.stringify({ build_listing: false, deep: false });
  let added = 0;
  for (let start = 0; start < ids.length; start += 50) {
    const results = await env.DB.batch(
      ids.slice(start, start + 50).map((id, offset) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO eval_queue (id, kind, record_id, user_id, options_json, status, added_at)
           VALUES (?, 'listing', ?, ?, ?, 'queued', ?)`
        ).bind(crypto.randomUUID(), id, userId, options, base + start + offset)
      ),
    );
    added += results.reduce((sum, result) => sum + Number(result.meta?.changes || 0), 0);
  }
  return added;
}
