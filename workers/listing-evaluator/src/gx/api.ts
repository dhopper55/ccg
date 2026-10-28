import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { GX_API_BASE_URL } from '../constants.js';

// Sweetwater Gear Exchange (GX) Public API v1 client. JSON only; personal Bearer token from the
// GX seller dashboard (Sold Items > API Settings), stored as the GX_API_TOKEN wrangler secret.
// GX_BASE_URL overrides the production base URL (e.g. to point at the GX sandbox).
//
// Response shapes below were confirmed against production by the Phase 1 probe (2026-10-27):
// list endpoints return bare arrays (no envelope / totals), money is a "85.00" string, and the
// x-ratelimit-* headers show 50 per window for listings/orders and 100 for reference data.

export type GxResult =
  | { ok: true; status: number; data: unknown; headers: Record<string, string> }
  | { ok: false; status: number; message: string; data: unknown; headers: Record<string, string> };

export function gxBaseUrl(env: Env): string {
  return normalizeText(env.GX_BASE_URL, GX_API_BASE_URL).replace(/\/+$/, '');
}

export function isGxConfigured(env: Env): boolean {
  return Boolean(normalizeText(env.GX_API_TOKEN, ''));
}

function extractGxErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const record = data as { message?: unknown; errors?: unknown; error?: unknown };
    const message = normalizeText(record.message, '');
    // 422 bodies carry a per-field map of messages. The docs call it "errors"; listing updates
    // were seen live (2026-10-27) sending it as "error" with no summary message.
    const fieldMap = record.errors ?? record.error;
    const fieldErrors = fieldMap && typeof fieldMap === 'object'
      ? Object.values(fieldMap as Record<string, unknown>)
        .flat()
        .map((value) => normalizeText(value, ''))
        .filter(Boolean)
      : [];
    if (fieldErrors.length) return fieldErrors.join(' ');
    if (message) return message;
  }
  return `Gear Exchange request failed (${status}).`;
}

export async function gxRequest(
  env: Env,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<GxResult> {
  const token = normalizeText(env.GX_API_TOKEN, '');
  if (!token) {
    return { ok: false, status: 0, message: 'GX_API_TOKEN is not configured.', data: null, headers: {} };
  }

  let response: Response;
  try {
    response = await fetch(`${gxBaseUrl(env)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    return { ok: false, status: 0, message: `Could not reach Gear Exchange: ${error instanceof Error ? error.message : String(error)}`, data: null, headers: {} };
  }
  const headers = Object.fromEntries(
    [...response.headers.entries()].filter(([name]) => name.toLowerCase() !== 'set-cookie'),
  );
  // Some endpoints (e.g. tracking: 204) return no body; keep non-JSON text for debugging.
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text.slice(0, 2000);
    }
  }

  if (!response.ok) {
    const message = response.status === 429
      ? 'Gear Exchange rate limit reached. Wait a minute and try again.'
      : extractGxErrorMessage(data, response.status);
    console.error(JSON.stringify({ tag: 'ccg-gx', event: 'gx.request_failed', method, path, status: response.status, message }));
    return { ok: false, status: response.status, message, data, headers };
  }
  return { ok: true, status: response.status, data, headers };
}

// Maps a GX failure onto the status our own endpoint returns (GX 4xx/5xx pass through; a network
// failure or missing token becomes 502).
export function gxErrorStatus(result: { status: number }): number {
  return result.status >= 400 && result.status < 600 ? result.status : 502;
}

// ---- Reference data (cached in KV for a day) -------------------------------------------

export type GxCategory = { id: number; path: string };
export type GxCondition = { id: number; name: string; description: string };
export type GxOption = { value: string | number; label: string };

const GX_REFERENCE_CACHE_TTL_SECONDS = 60 * 60 * 24;

async function fetchGxReference(env: Env, path: string, cacheKey: string): Promise<unknown | null> {
  try {
    const cached = await env.LISTING_JOBS.get(cacheKey, 'json');
    if (cached != null) return cached;
  } catch {
    // fall through to live fetch
  }
  const result = await gxRequest(env, 'GET', path);
  if (!result.ok || result.data == null) return null;
  try {
    await env.LISTING_JOBS.put(cacheKey, JSON.stringify(result.data), { expirationTtl: GX_REFERENCE_CACHE_TTL_SECONDS });
  } catch {
    // caching is best-effort
  }
  return result.data;
}

// { "109": "Guitars >> Electric Guitars >> Solidbody Guitars", ... }
export async function fetchGxCategories(env: Env): Promise<GxCategory[]> {
  const data = await fetchGxReference(env, '/categories', 'gx:categories:v1');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data as Record<string, unknown>)
    .map(([id, path]) => ({ id: Number(id), path: normalizeText(path, '') }))
    .filter((category) => Number.isFinite(category.id) && category.path);
}

// { "1": { name: "Good", description, value: 1 }, ... } — ids are not in condition order.
export async function fetchGxConditions(env: Env): Promise<GxCondition[]> {
  const data = await fetchGxReference(env, '/conditions', 'gx:conditions:v1');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.values(data as Record<string, { name?: unknown; description?: unknown; value?: unknown }>)
    .map((entry) => ({
      id: Number(entry?.value),
      name: normalizeText(entry?.name, ''),
      description: normalizeText(entry?.description, ''),
    }))
    .filter((condition) => Number.isFinite(condition.id) && condition.name);
}

// [{ name, description, value: "hyperwallet" | "store_credit" }]
export async function fetchGxPayoutOptions(env: Env): Promise<GxOption[]> {
  const data = await fetchGxReference(env, '/payout-options', 'gx:payout-options:v1');
  if (!Array.isArray(data)) return [];
  return data
    .map((entry: Record<string, unknown>) => ({
      value: normalizeText(entry?.value, ''),
      label: [normalizeText(entry?.name, ''), normalizeText(entry?.description, '')].filter(Boolean).join(' — '),
    }))
    .filter((option) => option.value);
}

// { "7": { description: "7 Days", value: 7 }, ... }
export async function fetchGxReturnPolicies(env: Env): Promise<GxOption[]> {
  const data = await fetchGxReference(env, '/return-policies', 'gx:return-policies:v1');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.values(data as Record<string, { description?: unknown; value?: unknown }>)
    .map((entry) => ({ value: Number(entry?.value), label: normalizeText(entry?.description, '') }))
    .filter((option) => Number.isFinite(option.value));
}

// ---- Listings ---------------------------------------------------------------------------

export type GxListing = {
  id: number;
  status: string;
  productId: string | null;
  imageUrls?: string[];
  categoryId?: number;
  payoutMethod?: string;
  [key: string]: unknown;
};

export type GxImage = { id: number; url: string; public_url: string | null };

function readListing(data: unknown): GxListing | null {
  // Create/update wrap the listing ({ message, listing }); GET returns it bare.
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  const listing = record && record.listing && typeof record.listing === 'object' ? record.listing : record;
  if (!listing || typeof listing !== 'object') return null;
  const id = Number((listing as { id?: unknown }).id);
  return Number.isFinite(id) && id > 0 ? listing as GxListing : null;
}

export async function createGxListing(
  env: Env,
  payload: Record<string, unknown>,
): Promise<{ ok: true; listing: GxListing; message: string } | { ok: false; status: number; message: string }> {
  const result = await gxRequest(env, 'POST', '/listings', payload);
  if (!result.ok) return { ok: false, status: result.status, message: result.message };
  const listing = readListing(result.data);
  if (!listing) return { ok: false, status: 502, message: 'Gear Exchange accepted the listing but returned no listing id.' };
  return { ok: true, listing, message: normalizeText((result.data as { message?: unknown })?.message, '') };
}

export async function getGxListing(env: Env, listingId: number | string): Promise<GxResult & { listing?: GxListing | null }> {
  const result = await gxRequest(env, 'GET', `/listings/${encodeURIComponent(String(listingId))}`);
  return result.ok ? { ...result, listing: readListing(result.data) } : result;
}

export async function updateGxListing(
  env: Env,
  listingId: number | string,
  payload: Record<string, unknown>,
): Promise<GxResult & { listing?: GxListing | null }> {
  const result = await gxRequest(env, 'PUT', `/listings/${encodeURIComponent(String(listingId))}`, payload);
  return result.ok ? { ...result, listing: readListing(result.data) } : result;
}

export async function publishGxListing(env: Env, listingId: number | string): Promise<GxResult & { listing?: GxListing | null }> {
  const result = await gxRequest(env, 'POST', `/listings/${encodeURIComponent(String(listingId))}/publish`);
  return result.ok ? { ...result, listing: readListing(result.data) } : result;
}

export async function deactivateGxListing(env: Env, listingId: number | string): Promise<GxResult> {
  return gxRequest(env, 'POST', `/listings/${encodeURIComponent(String(listingId))}/deactivate`);
}

export async function deleteGxListing(env: Env, listingId: number | string): Promise<GxResult> {
  return gxRequest(env, 'DELETE', `/listings/${encodeURIComponent(String(listingId))}`);
}

export async function listGxListingImages(env: Env, listingId: number | string): Promise<GxImage[] | null> {
  const result = await gxRequest(env, 'GET', `/listings/${encodeURIComponent(String(listingId))}/images`);
  return result.ok && Array.isArray(result.data) ? result.data as GxImage[] : null;
}

export async function deleteGxListingImage(env: Env, listingId: number | string, imageId: number): Promise<GxResult> {
  return gxRequest(env, 'DELETE', `/listings/${encodeURIComponent(String(listingId))}/images/${imageId}`);
}

// ---- Orders -----------------------------------------------------------------------------

export type GxOrder = {
  orderId: number;
  listingId: number;
  productId: string | null;
  status: string;
  listedPrice: string;
  soldPrice: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  soldAt: string;
  shippingInfo?: {
    local_pickup?: boolean;
    shipping_provider?: string | null;
    tracking_number?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
    ship_to_address?: Record<string, unknown>;
  };
  buyerInfo?: { buyer_first_name?: string; buyer_last_name?: string; buyer_id?: number };
};

export async function getGxOrder(env: Env, orderId: number | string): Promise<{ ok: true; order: GxOrder } | { ok: false; status: number; message: string }> {
  const result = await gxRequest(env, 'GET', `/orders/${encodeURIComponent(String(orderId))}`);
  if (!result.ok) return { ok: false, status: result.status, message: result.message };
  const order = result.data as GxOrder | null;
  if (!order || !Number.isFinite(Number(order.orderId))) return { ok: false, status: 502, message: 'Gear Exchange returned an order with no id.' };
  return { ok: true, order };
}

// Pages through orders updated since `updatedStartTime` (bare arrays, max 100 per page; the
// last page is the first one shorter than the page size). Capped so a bad loop can't run away.
export async function listGxOrdersUpdatedSince(
  env: Env,
  updatedStartTime: string,
): Promise<{ ok: true; orders: GxOrder[] } | { ok: false; status: number; message: string }> {
  const pageSize = 100;
  const orders: GxOrder[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const query = new URLSearchParams({ page: String(page), resultsPerPage: String(pageSize), updatedStartTime });
    const result = await gxRequest(env, 'GET', `/orders?${query.toString()}`);
    if (!result.ok) return { ok: false, status: result.status, message: result.message };
    const batch = Array.isArray(result.data) ? result.data as GxOrder[] : [];
    orders.push(...batch);
    if (batch.length < pageSize) break;
  }
  return { ok: true, orders };
}

// provider: one of GET /shipping/providers — fedex | usps | ups | pickup | other. 204 on success.
export async function addGxOrderTracking(
  env: Env,
  orderId: number | string,
  provider: string,
  trackingNumbers: string[],
): Promise<GxResult> {
  return gxRequest(env, 'POST', `/orders/${encodeURIComponent(String(orderId))}/tracking`, {
    shippingProvider: provider,
    trackingNumbers,
  });
}

// ---- Webhooks ---------------------------------------------------------------------------

// Needs the write_user scope. Registers (or replaces) the one webhook URL for this account.
export async function setGxWebhookConfig(env: Env, url: string, token: string): Promise<GxResult> {
  return gxRequest(env, 'POST', '/user/webhook-config', {
    url,
    token,
    listing_status_change_notifications: true,
    order_status_change_notifications: true,
  });
}
