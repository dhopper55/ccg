// CCG Agent endpoints.
//
// Agent-facing (Authorization: Bearer <instance key>; NOT the admin login):
//   POST /api/agent/heartbeat            status report + job lease renewal -> { active, desiredRef, ... }
//   POST /api/agent/jobs/claim           { modules } -> { job | null }      (423 if this key isn't active)
//   POST /api/agent/jobs/:id/complete    { status: 'done'|'failed', result?, error? }
//   POST /api/agent/logs                 { entries: [{ ts, level, message, jobId? }] }
//   An unknown/deleted key gets 401 { error: 'invalid_key' }; the agent backs off and retries.
//
// Admin-facing (admin login, behind requireAuth in index.ts):
//   GET  /api/admin-v2/agent                         instances, settings, job counts, server time
//   POST /api/admin-v2/agent/instances               { label } -> { instance, key }  (key shown once)
//   POST /api/admin-v2/agent/instances/:id/activate  makes it the one active instance
//   POST /api/admin-v2/agent/instances/:id/deactivate
//   POST /api/admin-v2/agent/instances/:id/rename    { label }
//   POST /api/admin-v2/agent/instances/:id/delete    revokes the key
//   GET  /api/admin-v2/agent/jobs?status=&limit=
//   POST /api/admin-v2/agent/jobs                    { module, type, payload? }  (e.g. system/ping)
//   POST /api/admin-v2/agent/jobs/:id/cancel
//   POST /api/admin-v2/agent/jobs/:id/retry
//   GET  /api/admin-v2/agent/logs?instanceId=&jobId=&limit=
//   POST /api/admin-v2/agent/settings                { desiredRef }

import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import {
  CLAIM_INTERVAL_SECONDS,
  HEARTBEAT_SECONDS,
  dbActivateInstance,
  dbCancelJob,
  dbClaimJob,
  dbCompleteJob,
  dbCreateInstance,
  dbDeactivateInstance,
  dbDeleteInstance,
  dbExpireLeases,
  dbGetInstanceByKey,
  dbGetJob,
  dbGetSettings,
  dbInsertLogs,
  dbJobCounts,
  dbListInstances,
  dbListJobs,
  dbListLogs,
  dbRecordHeartbeat,
  dbRenameInstance,
  dbRetryJob,
  dbSetSetting,
  enqueueAgentJob,
  isMissingTableError,
  serializeInstance,
  serializeJob,
  type InstanceRow,
  type LogInput,
} from './store.js';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };
const MISSING_TABLES = 'CCG Agent tables are missing. Run d1-add-ccg-agent.sql against the database.';
const NAME_RE = /^[a-z][a-z0-9_-]{0,39}$/;
const REF_RE = /^[A-Za-z0-9._\/-]{1,100}$/;

function json(body: unknown, status = 200): Response {
  return jsonResponse(body, status, NO_STORE);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function wrapErrors(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((error: unknown) => {
    if (isMissingTableError(error)) return json({ error: 'missing_tables', message: MISSING_TABLES }, 503);
    console.error('ccg-agent', error);
    return json({ error: 'server_error', message: error instanceof Error ? error.message : String(error) }, 500);
  });
}

// =====================================================================================
// Agent-facing
// =====================================================================================

export function isAgentApiPath(path: string): boolean {
  return path === '/api/agent' || path.startsWith('/api/agent/');
}

async function authenticateAgent(request: Request, env: Env): Promise<InstanceRow | null> {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(ccga_[A-Za-z0-9_-]{20,})$/);
  if (!match) return null;
  return dbGetInstanceByKey(env, match[1]);
}

export async function handleAgentApiRequest(request: Request, env: Env, path: string): Promise<Response> {
  return wrapErrors(async () => {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const instance = await authenticateAgent(request, env);
    if (!instance) return json({ error: 'invalid_key', message: 'Unknown or revoked agent key.' }, 401);

    if (path === '/api/agent/heartbeat') return agentHeartbeat(request, env, instance);
    if (path === '/api/agent/jobs/claim') return agentClaim(request, env, instance);
    if (path === '/api/agent/logs') return agentLogs(request, env, instance);
    const complete = path.match(/^\/api\/agent\/jobs\/([0-9a-f-]{36})\/complete$/);
    if (complete) return agentComplete(request, env, instance, complete[1]);
    return json({ error: 'not_found' }, 404);
  });
}

async function agentHeartbeat(request: Request, env: Env, instance: InstanceRow): Promise<Response> {
  const body = await readJson(request);
  const modules = Array.isArray(body.modules)
    ? body.modules.filter((m): m is string => typeof m === 'string' && NAME_RE.test(m)).slice(0, 50)
    : [];
  const currentJobId = str(body.currentJobId, 64);
  await dbRecordHeartbeat(env, instance, {
    hostname: str(body.hostname),
    platform: str(body.platform),
    version: str(body.version, 80),
    managed: body.managed === true,
    status: str(body.status, 40),
    statusDetail: str(body.statusDetail, 500),
    currentJobId,
    modules,
  });

  let currentJobCancelled = false;
  if (currentJobId) {
    const job = await dbGetJob(env, currentJobId);
    currentJobCancelled = !job || job.status !== 'claimed' || job.claimed_by !== instance.id;
  }
  const settings = await dbGetSettings(env);
  return json({
    instanceId: instance.id,
    label: instance.label,
    active: instance.active === 1,
    desiredRef: settings.desiredRef,
    heartbeatSeconds: HEARTBEAT_SECONDS,
    claimIntervalSeconds: CLAIM_INTERVAL_SECONDS,
    currentJobCancelled,
    serverTime: Date.now(),
  });
}

async function agentClaim(request: Request, env: Env, instance: InstanceRow): Promise<Response> {
  if (instance.active !== 1) {
    return json({ error: 'inactive', message: 'This agent key is not the active instance.' }, 423);
  }
  const body = await readJson(request);
  const modules = Array.isArray(body.modules)
    ? body.modules.filter((m): m is string => typeof m === 'string' && NAME_RE.test(m)).slice(0, 50)
    : [];
  const job = await dbClaimJob(env, instance.id, modules);
  return json({ job: job ? serializeJob(job) : null });
}

async function agentComplete(request: Request, env: Env, instance: InstanceRow, jobId: string): Promise<Response> {
  const body = await readJson(request);
  const status = body.status === 'done' || body.status === 'failed' ? body.status : null;
  if (!status) return json({ error: 'bad_request', message: "status must be 'done' or 'failed'." }, 400);
  const ok = await dbCompleteJob(env, instance.id, jobId, {
    status,
    result: body.result,
    error: str(body.error, 4000),
  });
  if (!ok) {
    return json({ error: 'not_claimed', message: 'This job is not claimed by this instance (cancelled or expired).' }, 409);
  }
  return json({ ok: true });
}

async function agentLogs(request: Request, env: Env, instance: InstanceRow): Promise<Response> {
  const body = await readJson(request);
  const raw = Array.isArray(body.entries) ? body.entries.slice(0, 200) : [];
  const now = Date.now();
  const entries: LogInput[] = raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      ts: typeof e.ts === 'number' && Number.isFinite(e.ts) ? Math.floor(e.ts) : now,
      level: (str(e.level, 10) ?? 'INFO').toUpperCase(),
      message: str(e.message, 4000) ?? '',
      jobId: str(e.jobId, 64),
    }))
    .filter((e) => e.message);
  await dbInsertLogs(env, instance.id, entries);
  return json({ ok: true, stored: entries.length });
}

// =====================================================================================
// Admin-facing
// =====================================================================================

export function isAgentAdminPath(path: string): boolean {
  return path === '/api/admin-v2/agent' || path.startsWith('/api/admin-v2/agent/');
}

export async function handleAgentAdminRequest(request: Request, env: Env, path: string): Promise<Response | null> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const owner = env.AUTH_USER || 'owner';

  return wrapErrors(async () => {
    if (path === '/api/admin-v2/agent' && method === 'GET') {
      await dbExpireLeases(env);
      const [instances, settings, jobCounts] = await Promise.all([dbListInstances(env), dbGetSettings(env), dbJobCounts(env)]);
      return json({
        instances: instances.map(serializeInstance),
        settings,
        jobCounts,
        heartbeatSeconds: HEARTBEAT_SECONDS,
        serverTime: Date.now(),
      });
    }

    if (path === '/api/admin-v2/agent/instances' && method === 'POST') {
      const label = str((await readJson(request)).label, 80);
      if (!label) return json({ error: 'bad_request', message: 'Label is required.' }, 400);
      const { row, key } = await dbCreateInstance(env, label);
      return json({ instance: serializeInstance(row), key });
    }

    const instanceAction = path.match(/^\/api\/admin-v2\/agent\/instances\/([0-9a-f-]{36})\/(activate|deactivate|rename|delete)$/);
    if (instanceAction && method === 'POST') {
      const [, id, action] = instanceAction;
      let ok = false;
      if (action === 'activate') ok = await dbActivateInstance(env, id);
      else if (action === 'deactivate') ok = await dbDeactivateInstance(env, id);
      else if (action === 'delete') ok = await dbDeleteInstance(env, id);
      else {
        const label = str((await readJson(request)).label, 80);
        if (!label) return json({ error: 'bad_request', message: 'Label is required.' }, 400);
        ok = await dbRenameInstance(env, id, label);
      }
      return ok ? json({ ok: true }) : json({ error: 'not_found', message: 'Instance not found.' }, 404);
    }

    if (path === '/api/admin-v2/agent/jobs' && method === 'GET') {
      const status = url.searchParams.get('status');
      const validStatus = status && ['queued', 'claimed', 'done', 'failed', 'cancelled'].includes(status) ? status : undefined;
      const [jobs, instances] = await Promise.all([
        dbListJobs(env, { status: validStatus, limit: clampInt(url.searchParams.get('limit'), 50, 1, 200) }),
        dbListInstances(env),
      ]);
      const labels = new Map(instances.map((i) => [i.id, i.label]));
      return json({ jobs: jobs.map((j) => serializeJob(j, labels)) });
    }

    if (path === '/api/admin-v2/agent/jobs' && method === 'POST') {
      const body = await readJson(request);
      const module = str(body.module, 40);
      const type = str(body.type, 40);
      if (!module || !type || !NAME_RE.test(module) || !NAME_RE.test(type)) {
        return json({ error: 'bad_request', message: 'module and type are required (lowercase names).' }, 400);
      }
      const { job, created } = await enqueueAgentJob(env, { module, type, payload: body.payload, createdBy: owner });
      return json({ job: serializeJob(job), created });
    }

    const jobAction = path.match(/^\/api\/admin-v2\/agent\/jobs\/([0-9a-f-]{36})\/(cancel|retry)$/);
    if (jobAction && method === 'POST') {
      const [, id, action] = jobAction;
      if (action === 'cancel') {
        return (await dbCancelJob(env, id))
          ? json({ ok: true })
          : json({ error: 'conflict', message: 'Only queued or running jobs can be cancelled.' }, 409);
      }
      const copy = await dbRetryJob(env, id, owner);
      return copy
        ? json({ job: serializeJob(copy) })
        : json({ error: 'conflict', message: 'Only finished jobs can be retried.' }, 409);
    }

    if (path === '/api/admin-v2/agent/logs' && method === 'GET') {
      const logs = await dbListLogs(env, {
        instanceId: url.searchParams.get('instanceId') || undefined,
        jobId: url.searchParams.get('jobId') || undefined,
        limit: clampInt(url.searchParams.get('limit'), 200, 1, 1000),
      });
      return json({
        logs: logs.map((l) => ({ id: l.id, instanceId: l.instance_id, jobId: l.job_id, ts: l.ts, level: l.level, message: l.message })),
      });
    }

    if (path === '/api/admin-v2/agent/settings' && method === 'POST') {
      const desiredRef = str((await readJson(request)).desiredRef, 100);
      if (!desiredRef || !REF_RE.test(desiredRef) || desiredRef.startsWith('-')) {
        return json({ error: 'bad_request', message: 'desiredRef must be a git branch, tag or commit.' }, 400);
      }
      await dbSetSetting(env, 'desired_ref', desiredRef);
      return json({ settings: await dbGetSettings(env) });
    }

    return json({ error: 'not_found' }, 404);
  });
}
