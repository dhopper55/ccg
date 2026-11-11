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

// Claim the oldest waiting entry for Claude.
export async function dbClaimNext(env: Env): Promise<QueueRow | null> {
  await requeueStale(env);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = await env.DB.prepare(
      "SELECT * FROM eval_queue WHERE status = 'queued' ORDER BY added_at ASC, id ASC LIMIT 1"
    ).first<QueueRow>();
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
