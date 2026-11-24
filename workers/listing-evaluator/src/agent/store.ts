// CCG Agent data layer: instances (one active at a time), the generic job queue, shipped log
// lines and agent-wide settings. Tables: d1-add-ccg-agent.sql. Endpoints: ./handlers.ts.

import type { Env } from '../env.js';

export const LEASE_MS = 5 * 60 * 1000;          // a claimed job is requeued/failed if not renewed for this long
export const HEARTBEAT_SECONDS = 60;            // how often the agent heartbeats (also renews its job lease)
export const CLAIM_INTERVAL_SECONDS = 20;       // how often an idle, active agent asks for work
export const LOG_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const DEFAULT_DESIRED_REF = 'main';

export type InstanceRow = {
  id: string;
  label: string;
  key_hash: string;
  key_hint: string;
  active: number;
  created_at: number;
  last_seen_at: number | null;
  hostname: string | null;
  platform: string | null;
  version: string | null;
  managed: number;
  status: string | null;
  status_detail: string | null;
  current_job_id: string | null;
  modules_json: string | null;
};

export type JobRow = {
  id: string;
  module: string;
  type: string;
  payload_json: string | null;
  status: 'queued' | 'claimed' | 'done' | 'failed' | 'cancelled';
  dedupe_key: string | null;
  attempts: number;
  max_attempts: number;
  created_at: number;
  created_by: string | null;
  claimed_by: string | null;
  claimed_at: number | null;
  lease_expires_at: number | null;
  finished_at: number | null;
  result_json: string | null;
  error: string | null;
};

export type LogRow = {
  id: number;
  instance_id: string;
  job_id: string | null;
  ts: number;
  level: string;
  message: string;
};

export function isMissingTableError(error: unknown): boolean {
  return /no such table/i.test(error instanceof Error ? error.message : String(error));
}

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------- keys ----------

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateAgentKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `ccga_${b64}`;
}

// ---------- instances ----------

export function serializeInstance(row: InstanceRow) {
  return {
    id: row.id,
    label: row.label,
    keyHint: row.key_hint,
    active: row.active === 1,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    hostname: row.hostname,
    platform: row.platform,
    version: row.version,
    managed: row.managed === 1,
    status: row.status,
    statusDetail: row.status_detail,
    currentJobId: row.current_job_id,
    modules: (parseJson(row.modules_json) as string[] | null) ?? [],
  };
}

export async function dbListInstances(env: Env): Promise<InstanceRow[]> {
  const { results } = await env.DB.prepare('SELECT * FROM agent_instances ORDER BY created_at ASC').all<InstanceRow>();
  return results ?? [];
}

export async function dbGetInstanceByKey(env: Env, key: string): Promise<InstanceRow | null> {
  const hash = await sha256Hex(key);
  return env.DB.prepare('SELECT * FROM agent_instances WHERE key_hash = ?').bind(hash).first<InstanceRow>();
}

export async function dbCreateInstance(env: Env, label: string): Promise<{ row: InstanceRow; key: string }> {
  const key = generateAgentKey();
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO agent_instances (id, label, key_hash, key_hint, active, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
  ).bind(id, label, await sha256Hex(key), key.slice(-4), now).run();
  const row = await env.DB.prepare('SELECT * FROM agent_instances WHERE id = ?').bind(id).first<InstanceRow>();
  return { row: row!, key };
}

/** Makes `id` the only active instance (deactivating any other in the same transaction). */
export async function dbActivateInstance(env: Env, id: string): Promise<boolean> {
  const exists = await env.DB.prepare('SELECT id FROM agent_instances WHERE id = ?').bind(id).first();
  if (!exists) return false;
  await env.DB.batch([
    env.DB.prepare('UPDATE agent_instances SET active = 0 WHERE active = 1 AND id != ?').bind(id),
    env.DB.prepare('UPDATE agent_instances SET active = 1 WHERE id = ?').bind(id),
  ]);
  return true;
}

export async function dbDeactivateInstance(env: Env, id: string): Promise<boolean> {
  const res = await env.DB.prepare('UPDATE agent_instances SET active = 0 WHERE id = ?').bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function dbRenameInstance(env: Env, id: string, label: string): Promise<boolean> {
  const res = await env.DB.prepare('UPDATE agent_instances SET label = ? WHERE id = ?').bind(label, id).run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Deleting an instance revokes its key. A job it still holds goes back through lease expiry. */
export async function dbDeleteInstance(env: Env, id: string): Promise<boolean> {
  const res = await env.DB.prepare('DELETE FROM agent_instances WHERE id = ?').bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}

export type HeartbeatInput = {
  hostname: string | null;
  platform: string | null;
  version: string | null;
  managed: boolean;
  status: string | null;
  statusDetail: string | null;
  currentJobId: string | null;
  modules: string[];
};

export async function dbRecordHeartbeat(env: Env, instance: InstanceRow, input: HeartbeatInput): Promise<void> {
  const now = Date.now();
  const statements = [
    env.DB.prepare(
      `UPDATE agent_instances SET last_seen_at = ?, hostname = ?, platform = ?, version = ?, managed = ?,
         status = ?, status_detail = ?, current_job_id = ?, modules_json = ?
       WHERE id = ?`,
    ).bind(
      now,
      input.hostname,
      input.platform,
      input.version,
      input.managed ? 1 : 0,
      input.status,
      input.statusDetail,
      input.currentJobId,
      JSON.stringify(input.modules),
      instance.id,
    ),
  ];
  // The heartbeat doubles as the lease renewal for the job this instance is running.
  if (input.currentJobId) {
    statements.push(
      env.DB.prepare(
        `UPDATE agent_jobs SET lease_expires_at = ? WHERE id = ? AND claimed_by = ? AND status = 'claimed'`,
      ).bind(now + LEASE_MS, input.currentJobId, instance.id),
    );
  }
  await env.DB.batch(statements);
}

// ---------- jobs ----------

export function serializeJob(row: JobRow, instanceLabels?: Map<string, string>) {
  return {
    id: row.id,
    module: row.module,
    type: row.type,
    payload: parseJson(row.payload_json),
    status: row.status,
    dedupeKey: row.dedupe_key,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    createdAt: row.created_at,
    createdBy: row.created_by,
    claimedBy: row.claimed_by,
    claimedByLabel: row.claimed_by ? instanceLabels?.get(row.claimed_by) ?? null : null,
    claimedAt: row.claimed_at,
    leaseExpiresAt: row.lease_expires_at,
    finishedAt: row.finished_at,
    result: parseJson(row.result_json),
    error: row.error,
  };
}

export type EnqueueInput = {
  module: string;
  type: string;
  payload?: unknown;
  createdBy?: string;
  /** At most one queued/claimed job per dedupe key; a duplicate enqueue returns the existing job. */
  dedupeKey?: string;
  /** Default 1: a job that dies mid-run is failed, not re-run. Only raise it for jobs safe to repeat. */
  maxAttempts?: number;
};

/** Queue a job for the agent. Exported for other Worker features (e.g. "Add to FBM"). */
export async function enqueueAgentJob(env: Env, input: EnqueueInput): Promise<{ job: JobRow; created: boolean }> {
  if (input.dedupeKey) {
    const existing = await env.DB.prepare(
      `SELECT * FROM agent_jobs WHERE dedupe_key = ? AND status IN ('queued', 'claimed')`,
    ).bind(input.dedupeKey).first<JobRow>();
    if (existing) return { job: existing, created: false };
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO agent_jobs (id, module, type, payload_json, status, dedupe_key, attempts, max_attempts, created_at, created_by)
     VALUES (?, ?, ?, ?, 'queued', ?, 0, ?, ?, ?)`,
  ).bind(
    id,
    input.module,
    input.type,
    input.payload === undefined ? null : JSON.stringify(input.payload),
    input.dedupeKey ?? null,
    Math.max(1, Math.floor(input.maxAttempts ?? 1)),
    Date.now(),
    input.createdBy ?? null,
  ).run();
  const job = await env.DB.prepare('SELECT * FROM agent_jobs WHERE id = ?').bind(id).first<JobRow>();
  return { job: job!, created: true };
}

/** Jobs whose lease ran out go back to the queue if they have attempts left, otherwise fail. */
export async function dbExpireLeases(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE agent_jobs SET status = 'failed', finished_at = ?, lease_expires_at = NULL,
         error = 'Lease expired: the agent stopped responding while running this job.'
       WHERE status = 'claimed' AND lease_expires_at < ? AND attempts >= max_attempts`,
    ).bind(now, now),
    env.DB.prepare(
      `UPDATE agent_jobs SET status = 'queued', claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL
       WHERE status = 'claimed' AND lease_expires_at < ? AND attempts < max_attempts`,
    ).bind(now),
  ]);
}

/** Atomically hands the oldest queued job for one of `modules` to `instanceId`. */
export async function dbClaimJob(env: Env, instanceId: string, modules: string[]): Promise<JobRow | null> {
  if (modules.length === 0) return null;
  await dbExpireLeases(env);
  const now = Date.now();
  const placeholders = modules.map(() => '?').join(', ');
  return env.DB.prepare(
    `UPDATE agent_jobs
       SET status = 'claimed', claimed_by = ?, claimed_at = ?, lease_expires_at = ?, attempts = attempts + 1
     WHERE id = (
       SELECT id FROM agent_jobs WHERE status = 'queued' AND module IN (${placeholders})
       ORDER BY created_at ASC LIMIT 1
     ) AND status = 'queued'
     RETURNING *`,
  ).bind(instanceId, now, now + LEASE_MS, ...modules).first<JobRow>();
}

/**
 * Finish a job. Allowed for the instance that claimed it even if that instance has since been
 * deactivated — it did the work, so the result is recorded rather than the job re-run.
 */
export async function dbCompleteJob(
  env: Env,
  instanceId: string,
  jobId: string,
  outcome: { status: 'done' | 'failed'; result?: unknown; error?: string | null },
): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE agent_jobs SET status = ?, finished_at = ?, lease_expires_at = NULL, result_json = ?, error = ?
     WHERE id = ? AND claimed_by = ? AND status = 'claimed'`,
  ).bind(
    outcome.status,
    Date.now(),
    outcome.result === undefined ? null : JSON.stringify(outcome.result),
    outcome.error ?? null,
    jobId,
    instanceId,
  ).run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function dbGetJob(env: Env, id: string): Promise<JobRow | null> {
  return env.DB.prepare('SELECT * FROM agent_jobs WHERE id = ?').bind(id).first<JobRow>();
}

export async function dbListJobs(env: Env, opts: { status?: string; limit: number }): Promise<JobRow[]> {
  await dbExpireLeases(env);
  const stmt = opts.status
    ? env.DB.prepare('SELECT * FROM agent_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?').bind(opts.status, opts.limit)
    : env.DB.prepare('SELECT * FROM agent_jobs ORDER BY created_at DESC LIMIT ?').bind(opts.limit);
  const { results } = await stmt.all<JobRow>();
  return results ?? [];
}

export async function dbJobCounts(env: Env): Promise<Record<string, number>> {
  const { results } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM agent_jobs GROUP BY status')
    .all<{ status: string; n: number }>();
  return Object.fromEntries((results ?? []).map((r) => [r.status, r.n]));
}

/** Cancels a queued or claimed job. A running agent learns of it on its next heartbeat. */
export async function dbCancelJob(env: Env, id: string): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'cancelled', finished_at = ?, lease_expires_at = NULL
     WHERE id = ? AND status IN ('queued', 'claimed')`,
  ).bind(Date.now(), id).run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Re-queues a finished (failed/cancelled/done) job as a fresh copy, keeping the original for history. */
export async function dbRetryJob(env: Env, id: string, createdBy: string): Promise<JobRow | null> {
  const job = await dbGetJob(env, id);
  if (!job || job.status === 'queued' || job.status === 'claimed') return null;
  const { job: copy } = await enqueueAgentJob(env, {
    module: job.module,
    type: job.type,
    payload: parseJson(job.payload_json) ?? undefined,
    createdBy,
    dedupeKey: job.dedupe_key ?? undefined,
    maxAttempts: job.max_attempts,
  });
  return copy;
}

// ---------- logs ----------

export type LogInput = { ts: number; level: string; message: string; jobId: string | null };

export async function dbInsertLogs(env: Env, instanceId: string, entries: LogInput[]): Promise<void> {
  if (entries.length === 0) return;
  const stmt = env.DB.prepare('INSERT INTO agent_logs (instance_id, job_id, ts, level, message) VALUES (?, ?, ?, ?, ?)');
  const statements = entries.map((e) => stmt.bind(instanceId, e.jobId, e.ts, e.level, e.message));
  if (Math.random() < 0.02) {
    statements.push(env.DB.prepare('DELETE FROM agent_logs WHERE ts < ?').bind(Date.now() - LOG_RETENTION_MS));
  }
  await env.DB.batch(statements);
}

export async function dbListLogs(
  env: Env,
  opts: { instanceId?: string; jobId?: string; limit: number },
): Promise<LogRow[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (opts.instanceId) {
    where.push('instance_id = ?');
    binds.push(opts.instanceId);
  }
  if (opts.jobId) {
    where.push('job_id = ?');
    binds.push(opts.jobId);
  }
  const sql = `SELECT * FROM agent_logs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`;
  const { results } = await env.DB.prepare(sql).bind(...binds, opts.limit).all<LogRow>();
  return results ?? [];
}

// ---------- settings ----------

export async function dbGetSettings(env: Env): Promise<{ desiredRef: string }> {
  const { results } = await env.DB.prepare('SELECT key, value FROM agent_settings').all<{ key: string; value: string }>();
  const map = new Map((results ?? []).map((r) => [r.key, r.value]));
  return { desiredRef: map.get('desired_ref') || DEFAULT_DESIRED_REF };
}

export async function dbSetSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO agent_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(key, value, Date.now()).run();
}
