// Automatic evals for the CCG Agent (module 'eval').
//
// "Queue for Claude" adds items to eval_queue (eval/queue.ts), exactly as before. Whenever the
// active agent asks for work and items are waiting, the Worker makes sure one eval.drain job is
// queued. The agent runs Claude Code headless (`claude -p "eval"`) on the owner's Claude
// subscription; Claude uses the CCG Eval connector to work through eval_queue, the same as typing
// "eval" in Claude Desktop (which keeps working alongside).
//
// Limits (Admin > Settings > System > Claude eval): items per run, items per rolling 24 hours,
// and a per-run time cap (agent-side). Models: a hard-coded list (below), stored in
// agent_settings. A deep item runs on its own with the deep model.

import type { Env } from '../env.js';
import { safeJsonParse } from '../eval/util.js';
import { dbSetSetting, enqueueAgentJob } from './store.js';

// Claude Code accepts aliases (follow the newest model in a family) and exact model IDs.
// Hard-coded on purpose (decided 2026-11-25): update this list when new Claude models ship.
export const EVAL_MODELS: Array<{ id: string; label: string }> = [
  { id: 'opus', label: 'Latest Opus' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
  { id: 'claude-fable-5-2', label: 'Fable 5.2' },
];

export type EvalSettings = {
  modelRegular: string;
  modelDeep: string;
  maxPerRun: number;
  maxPerDay: number;
};

const DEFAULTS: EvalSettings = { modelRegular: 'opus', modelDeep: 'opus', maxPerRun: 10, maxPerDay: 40 };
export const EVAL_RUN_TIMEOUT_MINUTES = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function validModel(value: unknown): string | null {
  return typeof value === 'string' && EVAL_MODELS.some((model) => model.id === value) ? value : null;
}

function boundedInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : null;
}

export async function dbGetEvalSettings(env: Env): Promise<EvalSettings> {
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM agent_settings WHERE key LIKE 'eval_%'",
  ).all<{ key: string; value: string }>();
  const map = new Map((results ?? []).map((row) => [row.key, row.value]));
  return {
    modelRegular: validModel(map.get('eval_model_regular')) ?? DEFAULTS.modelRegular,
    modelDeep: validModel(map.get('eval_model_deep')) ?? DEFAULTS.modelDeep,
    maxPerRun: boundedInt(map.get('eval_max_per_run'), 1, 100) ?? DEFAULTS.maxPerRun,
    maxPerDay: boundedInt(map.get('eval_max_per_day'), 1, 1000) ?? DEFAULTS.maxPerDay,
  };
}

/** Validates and saves whichever fields are present. Returns an error message or null. */
export async function dbSaveEvalSettings(env: Env, body: Record<string, unknown>): Promise<string | null> {
  const updates: Array<[string, string]> = [];
  if (body.modelRegular !== undefined) {
    const model = validModel(body.modelRegular);
    if (!model) return 'Unknown regular model.';
    updates.push(['eval_model_regular', model]);
  }
  if (body.modelDeep !== undefined) {
    const model = validModel(body.modelDeep);
    if (!model) return 'Unknown deep model.';
    updates.push(['eval_model_deep', model]);
  }
  if (body.maxPerRun !== undefined) {
    const n = boundedInt(body.maxPerRun, 1, 100);
    if (n == null) return 'Items per run must be 1–100.';
    updates.push(['eval_max_per_run', String(n)]);
  }
  if (body.maxPerDay !== undefined) {
    const n = boundedInt(body.maxPerDay, 1, 1000);
    if (n == null) return 'Items per 24 hours must be 1–1000.';
    updates.push(['eval_max_per_day', String(n)]);
  }
  for (const [key, value] of updates) await dbSetSetting(env, key, value);
  return null;
}

/** Items the agent evaluated in the last 24 hours (sum of finished eval.drain results). */
export async function dbAgentEvalsLast24h(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(CAST(json_extract(result_json, '$.evaluated') AS INTEGER)), 0) AS n
     FROM agent_jobs WHERE module = 'eval' AND finished_at > ?`,
  ).bind(Date.now() - DAY_MS).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

async function queuedEvalCount(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM eval_queue WHERE status = 'queued'").first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/**
 * Called when the active agent asks for work. Returns false when the daily cap is reached (the
 * caller then doesn't hand out eval jobs). Otherwise makes sure one eval.drain job is waiting if
 * eval_queue has items and no drain is queued or running.
 */
export async function prepareEvalForClaim(env: Env): Promise<boolean> {
  const settings = await dbGetEvalSettings(env);
  if ((await dbAgentEvalsLast24h(env)) >= settings.maxPerDay) return false;
  if ((await queuedEvalCount(env)) === 0) return true;
  const existing = await env.DB.prepare(
    "SELECT id FROM agent_jobs WHERE module = 'eval' AND type = 'drain' AND status IN ('queued', 'claimed') LIMIT 1",
  ).first();
  if (!existing) {
    await enqueueAgentJob(env, { module: 'eval', type: 'drain', payload: {}, createdBy: 'eval queue', maxAttempts: 1 });
  }
  return true;
}

/**
 * POST /api/agent/eval/config — what the next run should do. The next item Claude will take is
 * the oldest queued one (get_next_queued_item is oldest-first); if it's a deep eval, the run uses
 * the deep model and stops after that one item.
 */
export async function agentEvalConfig(env: Env): Promise<Record<string, unknown>> {
  const [settings, doneToday, next] = await Promise.all([
    dbGetEvalSettings(env),
    dbAgentEvalsLast24h(env),
    env.DB.prepare("SELECT options_json FROM eval_queue WHERE status = 'queued' ORDER BY added_at ASC LIMIT 1")
      .first<{ options_json: string | null }>(),
  ]);
  const deep = safeJsonParse<{ deep?: boolean }>(next?.options_json ?? null)?.deep === true;
  const remainingToday = Math.max(0, settings.maxPerDay - doneToday);
  return {
    queued: next ? await queuedEvalCount(env) : 0,
    deep,
    model: deep ? settings.modelDeep : settings.modelRegular,
    maxItems: Math.min(deep ? 1 : settings.maxPerRun, remainingToday),
    timeoutMinutes: EVAL_RUN_TIMEOUT_MINUTES,
  };
}

export async function evalSettingsResponse(env: Env): Promise<Record<string, unknown>> {
  const [settings, last24h] = await Promise.all([dbGetEvalSettings(env), dbAgentEvalsLast24h(env)]);
  return { settings, models: EVAL_MODELS, last24h, timeoutMinutes: EVAL_RUN_TIMEOUT_MINUTES };
}
