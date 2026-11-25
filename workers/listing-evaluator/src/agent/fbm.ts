// Facebook Marketplace jobs for the CCG Agent (module 'fbm').
//
//   fbm.add     queued by "Add to FBM" on the inventory item page. The agent publishes the
//               listing (Playwright) and returns { fbListingId }; the Worker links it here when
//               the job completes. max_attempts 1: a publish must never run twice by accident.
//   fbm.update  queued automatically when an item with an fb_listing_id is saved and a synced
//               field changed (same fields as the Reverb/GX sync, minus photos, plus shipping).
//               Async: the save never waits for or fails on Facebook. max_attempts 3.
//
// The agent reads the item's CURRENT data when the job runs (POST /api/agent/fbm/item), so a
// queued job always pushes the latest values.

import type { Env } from '../env.js';
import { dbGetInventoryItem } from '../inventory/db-core.js';
import { dbSetInventoryFbListingId } from '../inventory/db-write.js';
import { getSaleDescriptionPostfixes } from '../system/runtime.js';
import { normalizeText } from '../utils/text.js';
import { enqueueAgentJob, isMissingTableError, type InstanceRow, type JobRow } from './store.js';

const UPDATE_MAX_ATTEMPTS = 3;

export type FbmJobSummary = {
  id: string;
  type: string;
  status: JobRow['status'];
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
};

function summarize(row: JobRow): FbmJobSummary {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

async function latestFbmJob(env: Env, itemId: string, type: 'add' | 'update'): Promise<JobRow | null> {
  return env.DB.prepare(
    `SELECT * FROM agent_jobs
     WHERE module = 'fbm' AND type = ? AND json_extract(payload_json, '$.itemId') = ?
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(type, itemId).first<JobRow>();
}

function publicImageUrls(item: Record<string, unknown>, env: Env): string[] {
  const base = (env.SITE_BASE_URL || 'https://www.coalcreekguitars.com').replace(/\/+$/, '');
  const images = Array.isArray(item.images) ? (item.images as Array<{ url?: unknown; isPrivate?: unknown }>) : [];
  const urls = images.length
    ? images.filter((image) => !image.isPrivate).map((image) => normalizeText(image.url, ''))
    : (Array.isArray(item.imageUrls) ? (item.imageUrls as unknown[]) : []).map((url) => normalizeText(url, ''));
  return urls.filter(Boolean).map((url) => (url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`));
}

// ---------------------------------------------------------------------------------------
// Add to FBM (admin)
// ---------------------------------------------------------------------------------------

export async function fbmAddProblems(item: Record<string, unknown>, env: Env): Promise<string[]> {
  const problems: string[] = [];
  if (item.fbListingId) problems.push('This item already has a Facebook listing ID.');
  if (item.isSold) problems.push('This item is sold.');
  if (!normalizeText(item.saleTitle, '') && !normalizeText(item.title, '')) problems.push('Add a For Sale Title.');
  if (!(Number(item.salePrice) > 0)) problems.push('Add a Sale Price.');
  if (publicImageUrls(item, env).length === 0) problems.push('Add at least one public photo.');
  return problems;
}

export async function queueFbmAdd(
  env: Env,
  itemId: string,
  createdBy: string,
): Promise<{ ok: true; job: JobRow; created: boolean } | { ok: false; status: number; message: string }> {
  const item = await dbGetInventoryItem(itemId, env);
  if (!item) return { ok: false, status: 404, message: 'Inventory item not found.' };
  const problems = await fbmAddProblems(item, env);
  if (problems.length) return { ok: false, status: 400, message: problems.join(' ') };
  const { job, created } = await enqueueAgentJob(env, {
    module: 'fbm',
    type: 'add',
    payload: { itemId, ccgNumber: normalizeText(item.ccgNumber, ''), title: normalizeText(item.saleTitle, '') || normalizeText(item.title, '') },
    createdBy,
    dedupeKey: `fbm:add:${itemId}`,
    maxAttempts: 1,
  });
  return { ok: true, job, created };
}

/** What the inventory item page shows: latest add/update jobs and whether FBM is out of sync. */
export async function fbmItemStatus(env: Env, itemId: string) {
  const [add, update] = await Promise.all([latestFbmJob(env, itemId, 'add'), latestFbmJob(env, itemId, 'update')]);
  return {
    add: add ? summarize(add) : null,
    update: update ? summarize(update) : null,
    addPending: add ? add.status === 'queued' || add.status === 'claimed' : false,
    outOfSync: update && update.status === 'failed'
      ? { since: update.finished_at ?? update.created_at, error: update.error }
      : null,
  };
}

// ---------------------------------------------------------------------------------------
// Automatic update after "Save Changes"
// ---------------------------------------------------------------------------------------

const UPDATE_FIELDS = [
  'saleTitle', 'saleDescription', 'salePrice', 'videoUrl', 'brand', 'model', 'yearRange', 'finish',
  'quantity', 'allowShipping', 'fixedShippingAmount',
] as const;

export type FbmUpdateSource = Record<(typeof UPDATE_FIELDS)[number], unknown>;

function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' || typeof b === 'number') return Number(a ?? 0) === Number(b ?? 0);
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  return normalizeText(a, '') === normalizeText(b, '');
}

/**
 * Called after an inventory save succeeds. Queues one fbm.update when the item is on Facebook
 * and a synced field changed. Never throws: Facebook problems must never break a save.
 */
export async function queueFbmUpdateAfterSave(
  env: Env,
  itemId: string,
  current: Record<string, unknown>,
  next: FbmUpdateSource,
): Promise<void> {
  try {
    const fbListingId = normalizeText(current.fbListingId, '');
    if (!fbListingId) return;
    const changed = UPDATE_FIELDS.filter((field) => !sameValue(current[field], next[field]));
    if (changed.length === 0) return;
    // One waiting update per item is enough: it reads the item's latest data when it runs.
    // (A running one may already have read older values, so only a *queued* one counts.)
    const waiting = await env.DB.prepare(
      `SELECT id FROM agent_jobs
       WHERE module = 'fbm' AND type = 'update' AND status = 'queued'
         AND json_extract(payload_json, '$.itemId') = ?
       LIMIT 1`,
    ).bind(itemId).first();
    if (waiting) return;
    await enqueueAgentJob(env, {
      module: 'fbm',
      type: 'update',
      payload: {
        itemId,
        fbListingId,
        ccgNumber: normalizeText(current.ccgNumber, ''),
        title: normalizeText(next.saleTitle, ''),
        changed,
      },
      createdBy: 'inventory save',
      maxAttempts: UPDATE_MAX_ATTEMPTS,
    });
  } catch (error) {
    if (!isMissingTableError(error)) console.error('ccg-agent: queueing fbm.update failed', { itemId, error });
  }
}

// ---------------------------------------------------------------------------------------
// Agent-facing
// ---------------------------------------------------------------------------------------

/**
 * POST /api/agent/fbm/item { itemId } — everything the agent needs to fill the Facebook form.
 * Only answers for an item this instance currently holds an fbm job for.
 */
export async function agentFbmItem(env: Env, instance: InstanceRow, itemId: string): Promise<Response | Record<string, unknown>> {
  const held = await env.DB.prepare(
    `SELECT id FROM agent_jobs
     WHERE module = 'fbm' AND status = 'claimed' AND claimed_by = ?
       AND json_extract(payload_json, '$.itemId') = ?
     LIMIT 1`,
  ).bind(instance.id, itemId).first();
  if (!held) {
    return new Response(JSON.stringify({ error: 'forbidden', message: 'No running fbm job for this item on this instance.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const item = await dbGetInventoryItem(itemId, env);
  if (!item) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Inventory item not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const footers = await getSaleDescriptionPostfixes(env);
  return {
    item: {
      id: String(item.id),
      ccgNumber: normalizeText(item.ccgNumber, ''),
      title: normalizeText(item.saleTitle, '') || normalizeText(item.title, ''),
      salePrice: Number(item.salePrice ?? 0),
      condition: normalizeText(item.condition, ''),
      saleDescription: normalizeText(item.saleDescription, ''),
      imageUrls: publicImageUrls(item, env),
      allowShipping: Boolean(item.allowShipping),
      fixedShippingAmount: Number(item.fixedShippingAmount ?? 0),
      fbListingId: normalizeText(item.fbListingId, '') || null,
      isSold: Boolean(item.isSold),
    },
    // Same footer the old ccg-fbm-sync tool used (the site's Guitar/Bass description footer).
    footer: footers.guitar,
  };
}

/** Runs after a job completes. For fbm.add, links the new listing to the item. */
export async function onFbmJobCompleted(env: Env, job: JobRow, status: 'done' | 'failed', result: unknown): Promise<void> {
  if (job.module !== 'fbm' || job.type !== 'add' || status !== 'done') return;
  const payload = job.payload_json ? (JSON.parse(job.payload_json) as { itemId?: string }) : {};
  const fbListingId = normalizeText((result as { fbListingId?: unknown } | null)?.fbListingId, '');
  if (!payload.itemId || !fbListingId) return;
  const item = await dbGetInventoryItem(payload.itemId, env);
  if (!item) return;
  if (normalizeText(item.fbListingId, '')) {
    console.warn('ccg-agent: fbm.add finished but the item already has an fb_listing_id; not overwriting', {
      itemId: payload.itemId,
      existing: item.fbListingId,
      fbListingId,
    });
    return;
  }
  await dbSetInventoryFbListingId(payload.itemId, fbListingId, env);
}
