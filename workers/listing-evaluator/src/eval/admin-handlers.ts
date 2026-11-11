// Admin-side endpoints for the CCG Eval connector. All sit under /api/admin-v2/ and are
// protected by the admin login (requireAuth in index.ts), never by connector tokens.
//
//   POST /api/admin-v2/focus                         what the owner has open right now
//   GET  /api/admin-v2/evaluations/latest            newest evaluation for a listing / item / draft
//   POST /api/admin-v2/evaluations/link-draft        attach a new item's draft evaluations to its id
//   POST /api/admin-v2/evaluations/:id/status        inventory: mark applied / dismissed
//   POST /api/admin-v2/evaluations/:id/undo          listing: restore the previous values

import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import {
  dbGetEvaluation,
  dbGetLatestEvaluation,
  dbLinkDraftEvaluations,
  dbSetEvaluationStatus,
  dbUpsertFocus,
  type DraftSnapshot,
  type EvalKind,
} from './db.js';
import { undoListingEvaluation } from './listing-save.js';
import { extractR2Key, safeJsonParse } from './util.js';

const DRAFT_KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

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

export function isEvalAdminPath(path: string): boolean {
  return path === '/api/admin-v2/focus' || path.startsWith('/api/admin-v2/evaluations/');
}

export async function handleEvalAdminRequest(request: Request, env: Env, path: string): Promise<Response | null> {
  const method = request.method.toUpperCase();
  if (path === '/api/admin-v2/focus' && method === 'POST') return handleFocus(request, env);
  if (path === '/api/admin-v2/evaluations/latest' && method === 'GET') return handleLatest(request, env);
  if (path === '/api/admin-v2/evaluations/link-draft' && method === 'POST') return handleLinkDraft(request, env);
  const statusMatch = path.match(/^\/api\/admin-v2\/evaluations\/([0-9a-f-]{36})\/status$/i);
  if (statusMatch && method === 'POST') return handleStatus(request, env, statusMatch[1]);
  const undoMatch = path.match(/^\/api\/admin-v2\/evaluations\/([0-9a-f-]{36})\/undo$/i);
  if (undoMatch && method === 'POST') return handleUndo(env, undoMatch[1]);
  return null;
}

async function handleFocus(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  const kind = parseKind(body.kind);
  if (!kind) return jsonResponse({ message: 'kind must be "listing" or "inventory".' }, 400);

  const recordId = parsePositiveIntId(body.id);
  const draftKey = typeof body.draftKey === 'string' && DRAFT_KEY_PATTERN.test(body.draftKey) ? body.draftKey : null;
  if (!recordId && !(kind === 'inventory' && draftKey)) {
    return jsonResponse({ message: 'A record id (or, for a new inventory item, a draftKey) is required.' }, 400);
  }

  let draftJson: string | null = null;
  if (!recordId && draftKey) {
    // Only photo keys in the inventory bucket are kept, so the connector never fetches an
    // address that came from the page.
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
    const imageKeys = Array.from(new Set(
      imageUrls
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => extractR2Key(entry))
        .filter((key): key is string => Boolean(key && key.startsWith('inventory-items/'))),
    )).slice(0, 24);
    const snapshot: DraftSnapshot = {
      title: typeof body.title === 'string' ? body.title.trim().slice(0, 240) : '',
      imageKeys,
      aiAnalysisText: typeof body.aiAnalysisText === 'string' ? body.aiAnalysisText.slice(0, 20000) : '',
    };
    draftJson = JSON.stringify(snapshot);
  }

  try {
    await dbUpsertFocus(env, { userId: ownerId(env), kind, recordId, draftKey: recordId ? null : draftKey, draftJson });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) {
      return jsonResponse({ message: 'Run d1-add-eval-connector.sql first.' }, 503);
    }
    throw error;
  }
  return new Response(null, { status: 204, headers: NO_STORE });
}

async function handleLatest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get('kind'));
  const recordId = parsePositiveIntId(url.searchParams.get('id'));
  const draftKeyParam = url.searchParams.get('draftKey') || '';
  const draftKey = DRAFT_KEY_PATTERN.test(draftKeyParam) ? draftKeyParam : null;
  if (!kind || (!recordId && !draftKey)) {
    return jsonResponse({ message: 'kind and id (or draftKey) are required.' }, 400, NO_STORE);
  }

  let row;
  try {
    row = await dbGetLatestEvaluation(env, { kind, recordId, draftKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) return jsonResponse({ evaluation: null }, 200, NO_STORE);
    throw error;
  }
  if (!row) return jsonResponse({ evaluation: null }, 200, NO_STORE);

  return jsonResponse({
    evaluation: {
      id: row.id,
      kind: row.kind,
      recordId: row.record_id,
      draftKey: row.draft_key,
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
      undoneAt: row.undone_at,
      analysisHtml: row.analysis_html,
      fields: safeJsonParse(row.fields_json),
      listing: safeJsonParse(row.listing_json),
      options: safeJsonParse(row.options_json) || {},
      fieldsWritten: Object.keys(safeJsonParse<Record<string, unknown>>(row.fields_written_json) || {}),
    },
  }, 200, NO_STORE);
}

async function handleStatus(request: Request, env: Env, id: string): Promise<Response> {
  const body = await readJson(request);
  const status = body?.status;
  if (status !== 'applied' && status !== 'dismissed') {
    return jsonResponse({ message: 'status must be "applied" or "dismissed".' }, 400);
  }
  const row = await dbGetEvaluation(env, id);
  if (!row || row.kind !== 'inventory') return jsonResponse({ message: 'Evaluation not found.' }, 404);
  if (row.status === 'pending') await dbSetEvaluationStatus(env, id, status);
  return jsonResponse({ ok: true });
}

async function handleUndo(env: Env, id: string): Promise<Response> {
  const result = await undoListingEvaluation(env, id);
  if (!result.ok) return jsonResponse({ message: result.message }, result.status);
  return jsonResponse({ ok: true, restored: result.restored });
}

async function handleLinkDraft(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const draftKey = typeof body?.draftKey === 'string' && DRAFT_KEY_PATTERN.test(body.draftKey) ? body.draftKey : null;
  const itemId = parsePositiveIntId(body?.itemId);
  if (!draftKey || !itemId) return jsonResponse({ message: 'draftKey and itemId are required.' }, 400);
  const linked = await dbLinkDraftEvaluations(env, draftKey, itemId);
  return jsonResponse({ ok: true, linked });
}
