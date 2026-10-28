import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';
import { dbGetInventoryItem } from '../inventory/db-core.js';
import {
  deleteGxListingImage,
  fetchGxCategories,
  fetchGxConditions,
  fetchGxPayoutOptions,
  fetchGxReturnPolicies,
  getGxListing,
  gxErrorStatus,
  isGxConfigured,
  listGxListingImages,
  publishGxListing,
  updateGxListing,
} from './api.js';
import { dbGetGxLinkForItem, dbUpdateGxLink, type GxListingLink } from './db.js';
import { buildGxItemFields, createGxListingForItem, parseGxListingOptions, planGxListing } from './listing.js';
import { endGxListingForItem } from './sales.js';

// Inventory-item endpoints for the Gear Exchange channel, mirroring reverb-add / reverb-remove:
//   GET  /api/inventory/:id/gx-preview   what gx-add would send (and what's missing), no writes
//   POST /api/inventory/:id/gx-add       create the GX listing (draft unless publish: true)
//   POST /api/inventory/:id/gx-publish   publish the draft
//   GET  /api/inventory/:id/gx-status    live GX listing + images; refreshes the stored status
//   POST /api/inventory/:id/gx-remove    delete the GX listing and unlink

function inventoryIdFromPath(path: string, action: string): string {
  const parts = path.split('/').filter(Boolean);
  const actionIndex = parts.indexOf(action);
  return actionIndex > 0 ? parts[actionIndex - 1] : '';
}

function notConfigured(): Response {
  return jsonResponse({ message: 'Gear Exchange is not configured (GX_API_TOKEN).' }, 503);
}

function describeLink(link: GxListingLink | null): Record<string, unknown> | null {
  if (!link) return null;
  return {
    gxListingId: link.gx_listing_id,
    gxStatus: link.gx_status,
    gxCategoryId: link.gx_category_id,
    gxConditionId: link.gx_condition_id,
    payoutMethod: link.payout_method,
    options: link.options_json ? JSON.parse(link.options_json) : null,
    imagesPending: Boolean(link.images_pending),
    lastError: link.last_error,
    linkedAt: link.created_at,
  };
}

async function loadItem(path: string, action: string, env: Env): Promise<{ recordId: string; record: Record<string, unknown> } | Response> {
  const recordId = inventoryIdFromPath(path, action);
  if (!recordId) return jsonResponse({ message: 'Missing inventory ID.' }, 400);
  const record = await dbGetInventoryItem(recordId, env);
  if (!record) return jsonResponse({ message: 'Inventory item not found.' }, 404);
  return { recordId, record: record as Record<string, unknown> };
}

function queryToBody(url: URL): Record<string, unknown> {
  return Object.fromEntries(url.searchParams.entries());
}

export async function handleInventoryGxPreview(request: Request, path: string, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return notConfigured();
  const loaded = await loadItem(path, 'gx-preview', env);
  if (loaded instanceof Response) return loaded;
  const { recordId, record } = loaded;

  const parsed = parseGxListingOptions(queryToBody(new URL(request.url)), {
    allowShipping: Boolean(record.allowShipping),
    fixedShippingAmount: Number(record.fixedShippingAmount || 0),
    quantity: Number(record.quantity ?? 1),
  });
  if (!parsed.value) return jsonResponse({ message: parsed.error }, 400);

  const [plan, link, conditions, payoutOptions, returnPolicies] = await Promise.all([
    planGxListing(record, parsed.value, env),
    dbGetGxLinkForItem(Number(recordId), env),
    fetchGxConditions(env),
    fetchGxPayoutOptions(env),
    fetchGxReturnPolicies(env),
  ]);
  return jsonResponse({
    ready: !link && plan.missing.length === 0 && plan.problems.length === 0,
    link: describeLink(link),
    missing: plan.missing,
    problems: plan.problems,
    category: { id: plan.categoryId, path: plan.categoryPath, source: plan.categorySource },
    conditionId: plan.conditionId,
    payload: plan.payload,
    reference: { conditions, payoutOptions, returnPolicies },
  });
}

export async function handleInventoryGxAdd(request: Request, path: string, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return notConfigured();
  const loaded = await loadItem(path, 'gx-add', env);
  if (loaded instanceof Response) return loaded;
  const { recordId, record } = loaded;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  if (await dbGetGxLinkForItem(Number(recordId), env)) {
    return jsonResponse({ message: 'Item is already listed on Gear Exchange.' }, 400);
  }
  const parsed = parseGxListingOptions(body, {
    allowShipping: Boolean(record.allowShipping),
    fixedShippingAmount: Number(record.fixedShippingAmount || 0),
    quantity: Number(record.quantity ?? 1),
  });
  if (!parsed.value) return jsonResponse({ message: parsed.error }, 400);
  const options = parsed.value;

  const created = await createGxListingForItem(record, options, env);
  if (!created.ok) {
    return jsonResponse({ message: created.message, missing: created.missing, problems: created.problems }, created.status);
  }
  const { listing, plan } = created;

  return jsonResponse({
    ok: true,
    gxListingId: listing.id,
    gxStatus: listing.status,
    // GX fetches the photos in the background; edits/publish are blocked until it's done.
    message: created.message || null,
    photosSent: plan.imageUrls.length,
    category: { id: plan.categoryId, path: plan.categoryPath, source: plan.categorySource },
    listing,
  });
}

export async function handleInventoryGxPublish(_request: Request, path: string, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return notConfigured();
  const loaded = await loadItem(path, 'gx-publish', env);
  if (loaded instanceof Response) return loaded;
  const link = await dbGetGxLinkForItem(Number(loaded.recordId), env);
  if (!link) return jsonResponse({ message: 'Item is not listed on Gear Exchange.' }, 400);

  const result = await publishGxListing(env, link.gx_listing_id);
  if (!result.ok) {
    await dbUpdateGxLink(link.inventory_item_id, { lastError: result.message }, env);
    return jsonResponse({ message: `Unable to publish on Gear Exchange: ${result.message}` }, gxErrorStatus(result));
  }
  const status = normalizeText(result.listing?.status, 'published');
  await dbUpdateGxLink(link.inventory_item_id, { gxStatus: status, lastError: null }, env);
  // pending_admin_review means GX staff review it before it goes live.
  return jsonResponse({ ok: true, gxListingId: link.gx_listing_id, gxStatus: status, listing: result.listing ?? null });
}

export async function handleInventoryGxStatus(_request: Request, path: string, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return notConfigured();
  const loaded = await loadItem(path, 'gx-status', env);
  if (loaded instanceof Response) return loaded;
  const link = await dbGetGxLinkForItem(Number(loaded.recordId), env);
  if (!link) return jsonResponse({ link: null, message: 'Item is not listed on Gear Exchange.' });

  const [listing, images] = await Promise.all([
    getGxListing(env, link.gx_listing_id),
    listGxListingImages(env, link.gx_listing_id),
  ]);
  if (!listing.ok) {
    return jsonResponse({ link: describeLink(link), message: `Unable to load the GX listing: ${listing.message}` }, gxErrorStatus(listing));
  }
  const status = normalizeText(listing.listing?.status, '') || link.gx_status;
  const imagesPending = images ? images.length === 0 : Boolean(link.images_pending);
  await dbUpdateGxLink(link.inventory_item_id, { gxStatus: status, imagesPending }, env);
  return jsonResponse({ link: describeLink({ ...link, gx_status: status, images_pending: imagesPending ? 1 : 0 }), listing: listing.listing, images });
}

export async function handleInventoryGxRemove(_request: Request, path: string, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return notConfigured();
  const loaded = await loadItem(path, 'gx-remove', env);
  if (loaded instanceof Response) return loaded;
  const ended = await endGxListingForItem(loaded.recordId, env);
  if (ended.status === 'failed') return jsonResponse({ message: `Unable to remove the Gear Exchange listing: ${ended.message}` }, 502);
  if (ended.status === 'skipped') return jsonResponse({ message: ended.message }, 400);
  return jsonResponse({ ok: true, message: ended.message });
}

// ---- Edit sync (called from the inventory update handler) ------------------------------

// If the item is on GX and a field GX shows changed, push it before CCG saves — same
// fail-closed rule as the Reverb sync, so the two never drift silently. Listing-only answers
// (condition, category, offers, shipping, payout) aren't on the edit form and are left alone.
// GX's PUT only adds images and reorders by source URL, so removed photos are deleted one by one.
export async function syncGxListingOnSave(
  recordId: string,
  current: Record<string, unknown>,
  next: Record<string, unknown>,
  env: Env,
): Promise<{ ok: true; synced: boolean } | { ok: false; status: number; message: string }> {
  const link = await dbGetGxLinkForItem(Number(recordId), env);
  if (!link || link.gx_status === 'sold') return { ok: true, synced: false };
  if (!isGxConfigured(env)) return { ok: false, status: 503, message: 'Gear Exchange is not configured (GX_API_TOKEN).' };

  const before = buildGxItemFields(current, env);
  const after = buildGxItemFields(next, env);
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed[key] = after[key];
  }
  if (!Object.keys(changed).length) return { ok: true, synced: false };
  // null clears a video on GX; other nulls (e.g. an unparseable year) are just not sent.
  for (const key of Object.keys(changed)) {
    if (changed[key] == null && key !== 'videoUrl') delete changed[key];
  }

  const updated = await updateGxListing(env, link.gx_listing_id, changed);
  if (!updated.ok) {
    await dbUpdateGxLink(link.inventory_item_id, { lastError: updated.message }, env);
    return { ok: false, status: gxErrorStatus(updated), message: updated.message };
  }

  if (changed.imageUrls) {
    const keep = new Set(changed.imageUrls as string[]);
    const images = await listGxListingImages(env, link.gx_listing_id);
    for (const image of images ?? []) {
      if (image.public_url && !keep.has(image.public_url)) {
        const removed = await deleteGxListingImage(env, link.gx_listing_id, image.id);
        if (!removed.ok) return { ok: false, status: gxErrorStatus(removed), message: `Couldn't remove a photo on GX: ${removed.message}` };
      }
    }
  }
  await dbUpdateGxLink(link.inventory_item_id, { lastError: null, ...(changed.imageUrls ? { imagesPending: true } : {}) }, env);
  return { ok: true, synced: true };
}

// GET /api/admin-v2/gx/reference — the GX lists a listing form needs (cached for a day).
export async function handleAdminV2GxReference(_request: Request, env: Env): Promise<Response> {
  if (!isGxConfigured(env)) return notConfigured();
  const [categories, conditions, payoutOptions, returnPolicies] = await Promise.all([
    fetchGxCategories(env),
    fetchGxConditions(env),
    fetchGxPayoutOptions(env),
    fetchGxReturnPolicies(env),
  ]);
  return jsonResponse({ categories, conditions, payoutOptions, returnPolicies });
}
