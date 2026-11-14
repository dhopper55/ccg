// Admin-side endpoints for the CCG Eval connector. All sit under /api/admin-v2/ and are
// protected by the admin login (requireAuth in index.ts), never by connector tokens.
//
//   POST /api/admin-v2/focus                       what the owner has open right now
//   GET  /api/admin-v2/eval-status?kind=&id=       queue state + latest evaluation (polled by the page)
//   POST /api/admin-v2/eval-queue                  { kind, id, buildListing, deep } -> Queue for Claude
//   POST /api/admin-v2/eval-queue/:id/remove       take a waiting item off the queue
//   GET  /api/admin-v2/eval-queue/listings          { count } of results-list listings never queued
//   POST /api/admin-v2/eval-queue/listings          Queue All: queue every one of them
//   POST /api/admin-v2/evaluations/:id/undo        restore the values an evaluation replaced

import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { dbGetLatestEvaluation, dbUpsertFocus, type EvalKind } from './db.js';
import { inventoryColumnLabels, inventoryLiveChannels } from './inventory-save.js';
import { undoEvaluation } from './listing-save.js';
import {
  dbEnqueue,
  dbEnqueueListings,
  dbGetActiveQueueEntry,
  dbGetLatestQueueEntry,
  dbGetQueueEntry,
  dbQueuePosition,
  dbRemoveFromQueue,
  dbUnqueuedListingIds,
  queueOptions,
  type QueueRow,
} from './queue.js';
import { safeJsonParse } from './util.js';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

const LISTING_LABELS: Record<string, string> = {
  ai_analysis_text: 'AI Analysis',
  brand: 'Brand',
  model: 'Model',
  year: 'Year',
  price_private_party: 'Private Party Value',
};

function ownerId(env: Env): string {
  return env.AUTH_USER || 'owner';
}

function parsePositiveIntId(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  return /^[1-9]\d{0,15}$/.test(text) ? text : null;
}

function parseKind(value: unknown): EvalKind | null {
  return value === 'listing' || value === 'inventory' ? value : null;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function missingTables(error: unknown): boolean {
  return /no such table/i.test(error instanceof Error ? error.message : String(error));
}

export function isEvalAdminPath(path: string): boolean {
  return path === '/api/admin-v2/focus'
    || path === '/api/admin-v2/eval-status'
    || path === '/api/admin-v2/eval-queue'
    || path.startsWith('/api/admin-v2/eval-queue/')
    || path.startsWith('/api/admin-v2/evaluations/');
}

export async function handleEvalAdminRequest(request: Request, env: Env, path: string): Promise<Response | null> {
  const method = request.method.toUpperCase();
  try {
    if (path === '/api/admin-v2/focus' && method === 'POST') return await handleFocus(request, env);
    if (path === '/api/admin-v2/eval-status' && method === 'GET') return await handleStatus(request, env);
    if (path === '/api/admin-v2/eval-queue' && method === 'POST') return await handleEnqueue(request, env);
    if (path === '/api/admin-v2/eval-queue/listings' && method === 'GET') {
      return jsonResponse({ count: (await dbUnqueuedListingIds(env)).length }, 200, NO_STORE);
    }
    if (path === '/api/admin-v2/eval-queue/listings' && method === 'POST') {
      const queued = await dbEnqueueListings(env, await dbUnqueuedListingIds(env), ownerId(env));
      return jsonResponse({ ok: true, queued });
    }
    const removeMatch = path.match(/^\/api\/admin-v2\/eval-queue\/([0-9a-f-]{36})\/remove$/i);
    if (removeMatch && method === 'POST') return await handleRemove(env, removeMatch[1]);
    const undoMatch = path.match(/^\/api\/admin-v2\/evaluations\/([0-9a-f-]{36})\/undo$/i);
    if (undoMatch && method === 'POST') return await handleUndo(env, undoMatch[1]);
  } catch (error) {
    if (missingTables(error)) {
      return jsonResponse({ message: 'Run d1-add-eval-connector.sql and d1-add-eval-queue.sql first.' }, 503, NO_STORE);
    }
    throw error;
  }
  return null;
}

async function recordExists(env: Env, kind: EvalKind, id: string): Promise<boolean> {
  const table = kind === 'listing' ? 'listings' : 'ccg_inventory_items';
  const row = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`).bind(Number(id)).first();
  return Boolean(row);
}

async function handleFocus(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const kind = parseKind(body?.kind);
  const recordId = parsePositiveIntId(body?.id);
  if (!kind || !recordId) return jsonResponse({ message: 'kind and a saved record id are required.' }, 400);
  await dbUpsertFocus(env, { userId: ownerId(env), kind, recordId, draftKey: null, draftJson: null });
  return new Response(null, { status: 204, headers: NO_STORE });
}

async function queuePayload(env: Env, row: QueueRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    position: await dbQueuePosition(env, row),
    addedAt: row.added_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
    evaluationId: row.evaluation_id,
    options: queueOptions(row),
  };
}

async function handleStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get('kind'));
  const recordId = parsePositiveIntId(url.searchParams.get('id'));
  if (!kind || !recordId) return jsonResponse({ message: 'kind and id are required.' }, 400, NO_STORE);

  const [active, latestEntry, evaluation, liveChannels] = await Promise.all([
    dbGetActiveQueueEntry(env, kind, recordId),
    dbGetLatestQueueEntry(env, kind, recordId),
    dbGetLatestEvaluation(env, { kind, recordId }),
    kind === 'inventory' ? inventoryLiveChannels(env, recordId) : Promise.resolve([] as string[]),
  ]);
  const written = Object.keys(safeJsonParse<Record<string, unknown>>(evaluation?.fields_written_json ?? null) || {});
  return jsonResponse({
    queue: await queuePayload(env, active),
    lastQueue: active ? null : await queuePayload(env, latestEntry),
    latestEvaluation: evaluation
      ? {
          id: evaluation.id,
          status: evaluation.status,
          source: evaluation.source,
          createdAt: evaluation.created_at,
          undoneAt: evaluation.undone_at,
          fieldsWritten: kind === 'listing'
            ? Array.from(new Set(written.map((column) => LISTING_LABELS[column] || column)))
            : inventoryColumnLabels(written),
        }
      : null,
    liveChannels,
  }, 200, NO_STORE);
}

async function handleEnqueue(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const kind = parseKind(body?.kind);
  const recordId = parsePositiveIntId(body?.id);
  if (!kind || !recordId) return jsonResponse({ message: 'Save the item first, then queue it for Claude.' }, 400);
  if (!(await recordExists(env, kind, recordId))) return jsonResponse({ message: 'Item not found.' }, 404);
  const { row, created } = await dbEnqueue(env, {
    kind,
    recordId,
    userId: ownerId(env),
    options: {
      build_listing: kind === 'inventory' && body?.buildListing !== false,
      deep: body?.deep === true,
    },
  });
  return jsonResponse({ ok: true, created, queue: await queuePayload(env, row) });
}

async function handleRemove(env: Env, id: string): Promise<Response> {
  const entry = await dbGetQueueEntry(env, id);
  if (!entry) return jsonResponse({ message: 'Not in the queue.' }, 404);
  const removed = await dbRemoveFromQueue(env, id);
  if (!removed) return jsonResponse({ message: 'Claude has already started on this item.' }, 409);
  return jsonResponse({ ok: true });
}

async function handleUndo(env: Env, id: string): Promise<Response> {
  const result = await undoEvaluation(env, id);
  if (!result.ok) return jsonResponse({ message: result.message }, result.status);
  return jsonResponse({ ok: true, restored: result.restored });
}
