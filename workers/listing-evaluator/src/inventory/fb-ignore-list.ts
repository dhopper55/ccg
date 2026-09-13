// The fb_ignore_list table holds Facebook Marketplace listing ids that are NOT CCG
// inventory at all (personal items David lists on FB only, e.g. a lawnmower). Lives
// separately from ccg_inventory_items because it describes something CCG has no other way
// to represent — "this will never be inventory". Used by the ccg-fbm-sync tool's reconcile
// flow (see /ccg-fbm-sync/ARCHITECTURE.md Section 5) to stop re-asking about the same
// known-personal FB listings on every run.
import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';

export async function dbGetIgnoredFbListingIds(env: Env): Promise<Array<{ fbListingId: string; note: string | null; createdAt: string | null }>> {
  const result = await env.DB.prepare(
    'SELECT fb_listing_id, note, created_at FROM fb_ignore_list ORDER BY created_at DESC'
  ).all<{ fb_listing_id: string; note: string | null; created_at: string | null }>();
  return (result.results || []).map((row) => ({
    fbListingId: row.fb_listing_id,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function dbAddIgnoredFbListing(fbListingId: string, note: string | null, env: Env): Promise<boolean> {
  try {
    await env.DB.prepare(
      'INSERT INTO fb_ignore_list (fb_listing_id, note) VALUES (?, ?) ON CONFLICT(fb_listing_id) DO UPDATE SET note = excluded.note'
    ).bind(fbListingId, note).run();
    return true;
  } catch (error) {
    console.error('fb_ignore_list insert failed', { error });
    return false;
  }
}

export async function handleFbIgnoreListGet(_request: Request, env: Env): Promise<Response> {
  const rows = await dbGetIgnoredFbListingIds(env);
  return jsonResponse({ records: rows });
}

export async function handleFbIgnoreListPost(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }
  const fbListingId = normalizeText(body.fbListingId, '');
  if (!fbListingId) return jsonResponse({ message: 'Missing fbListingId.' }, 400);
  const note = normalizeText(body.note, '').slice(0, 500) || null;

  const ok = await dbAddIgnoredFbListing(fbListingId, note, env);
  if (!ok) return jsonResponse({ message: 'Failed to add to the ignore list.' }, 500);
  return jsonResponse({ ok: true, fbListingId });
}
