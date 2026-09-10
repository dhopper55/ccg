import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { toBooleanInput, parseBoundedInt } from '../utils/misc.js';
import { parseCurrencyAmount } from '../utils/money.js';
import { REVERB_API_BASE_URL, REVERB_SEARCH_API_URL } from '../constants.js';
import { reverbRequestHeaders } from '../pricing/reverb.js';

// NOTE ON UNVERIFIED FIELDS: Reverb's public API docs (reverb-api.com) only document
// make/model/title/description/finish/year/categories/condition/photos/videos/price/sku/upc/
// has_inventory/inventory/offers_enabled/handmade/shipping_profile_id/shipping.rates/shipping.local/
// preorder_info/publish. They do NOT document field names for "sold as described", an automatic
// price-drop-after-N-weeks feature, or "Safe Shipping". The fields below (sold_as_described,
// auto_price_drop, safe_shipping) are best-guess names following Reverb's existing snake_case
// conventions — they are NOT confirmed against a live account. If Reverb silently ignores them
// (rather than erroring), those specific toggles won't take effect even though the listing
// itself succeeds. Test with one real listing and compare against what shows up on
// reverb.com; if a toggle didn't take effect, inspect reverb.com's own listing form network
// request in browser dev tools for the real field name and it's a one-line fix here.

// Points Reverb photo fetches at the minimal, auth-free /api/img endpoint (see images.ts:
// handlePublicImageBytes) instead of /api/inventory-image, to rule out any interference from
// that route's other layers (CORS scoping, admin-oriented headers). Must stay under /api/ —
// this Worker is only invoked for the routes listed in wrangler.toml (/api/*, sitemap.xml,
// robots.txt, google-merchant-feed.xml, /guitars-and-gear-for-sale/*); a path outside those
// never reaches the Worker at all and falls through to the static site's catch-all instead.
export function toReverbFetchableImageUrl(rawValue: string, env: Env): string | null {
  const raw = (rawValue || '').trim();
  if (!raw) return null;

  const siteBaseUrl = normalizeText(env.SITE_BASE_URL, 'https://www.coalcreekguitars.com').replace(/\/+$/, '');

  // Already one of our own path-based /api/img/... URLs (absolute or relative) — pass through.
  if (/^\/api\/img\//.test(raw)) return `${siteBaseUrl}${raw}`;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith('/api/img/')) return raw;
  } catch {
    // not an absolute URL — fall through
  }

  // Legacy ?key=... proxy format (either /api/inventory-image?key=... or the old /api/img?key=...).
  let legacyKey: string | null = null;
  if (raw.startsWith('/api/') || /^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw, 'https://placeholder.invalid');
      legacyKey = parsed.searchParams.get('key');
    } catch {
      legacyKey = null;
    }
  }
  if (legacyKey) return buildPathBasedImageUrl(legacyKey, siteBaseUrl);

  // A bare R2 key (no scheme, no leading slash) — the common case.
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/')) {
    return buildPathBasedImageUrl(raw, siteBaseUrl);
  }

  // Anything else absolute (e.g. an externally-hosted photo URL that was never re-hosted into
  // our bucket) — pass it through as-is rather than silently dropping the image.
  if (/^https?:\/\//i.test(raw)) return raw;

  return null;
}

function buildPathBasedImageUrl(key: string, siteBaseUrl: string): string {
  // Key as path segments (not a ?key= query param) so the URL genuinely ends in .jpg/.png/etc.
  // Encode each segment individually so the real "/" separators in the key stay literal.
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${siteBaseUrl}/api/img/${encodedKey}`;
}

export type ReverbShippingMethod = 'calculated' | 'free' | 'flat';

export type ReverbWizardInput = {
  conditionUuid: string;
  soldAsDescribed: boolean;
  dropPriceIn2Weeks: boolean;
  allowOffers: boolean;
  shippingMethod: ReverbShippingMethod;
  flatRateAmount: number | null;
  shippingProfileId: string | null;
  safeShipping: boolean;
};

export function parseReverbWizardInput(
  body: Record<string, unknown>,
): { value: ReverbWizardInput; error?: undefined } | { value?: undefined; error: string } {
  const conditionUuid = normalizeText(body.conditionUuid, '');
  if (!conditionUuid || !isKnownReverbConditionUuid(conditionUuid)) {
    return { error: 'Choose a Reverb condition.' };
  }

  const soldAsDescribed = toBooleanInput(body.soldAsDescribed, false);
  if (typeof body.dropPriceIn2Weeks !== 'boolean') {
    return { error: '"Drop price in 2 weeks" must be answered.' };
  }
  const dropPriceIn2Weeks = body.dropPriceIn2Weeks;
  const allowOffers = toBooleanInput(body.allowOffers, true);

  const shippingMethodRaw = normalizeText(body.shippingMethod, '');
  if (shippingMethodRaw !== 'calculated' && shippingMethodRaw !== 'free' && shippingMethodRaw !== 'flat') {
    return { error: 'Choose a shipping method.' };
  }
  const shippingMethod = shippingMethodRaw as ReverbShippingMethod;

  let flatRateAmount: number | null = null;
  if (shippingMethod === 'flat') {
    const amount = parseCurrencyAmount(body.flatRateAmount);
    if (amount == null || amount <= 0) return { error: 'Enter a flat rate shipping amount.' };
    flatRateAmount = amount;
  }

  let shippingProfileId: string | null = null;
  if (shippingMethod === 'calculated') {
    shippingProfileId = normalizeText(body.shippingProfileId, '') || null;
    if (!shippingProfileId) return { error: 'Choose a shipping profile.' };
  }

  const safeShipping = toBooleanInput(body.safeShipping, false);

  return {
    value: {
      conditionUuid,
      soldAsDescribed,
      dropPriceIn2Weeks,
      allowOffers,
      shippingMethod,
      flatRateAmount,
      shippingProfileId,
      safeShipping,
    },
  };
}

// Verified verbatim from Reverb's /docs/create-listings documentation table. Account-independent
// per Reverb's docs (Mint (with inventory) and B-Stock additionally require the shop to be
// enabled for them — Reverb will reject those with a real error if not, which the wizard shows).
export const REVERB_CONDITION_OPTIONS: Array<{ uuid: string; name: string }> = [
  { uuid: 'fbf35668-96a0-4baa-bcde-ab18d6b1b329', name: 'Non functioning' },
  { uuid: '6a9dfcad-600b-46c8-9e08-ce6e5057921e', name: 'Poor' },
  { uuid: '98777886-76d0-44c8-865e-bb40e669e934', name: 'Fair' },
  { uuid: 'f7a3f48c-972a-44c6-b01a-0cd27488d3f6', name: 'Good' },
  { uuid: 'ae4d9114-1bd7-4ec5-a4ba-6653af5ac84d', name: 'Very Good' },
  { uuid: 'df268ad1-c462-4ba6-b6db-e007e23922ea', name: 'Excellent' },
  { uuid: 'ac5b9c1e-dc78-466d-b0b3-7cf712967a48', name: 'Mint' },
  { uuid: '6db7df88-293b-4017-a1c1-cdb5e599fa1a', name: 'Mint (with inventory)' },
  { uuid: '9225283f-60c2-4413-ad18-1f5eba7a856f', name: 'B-Stock' },
  { uuid: '7c3f45de-2ae0-4c81-8400-fdb6b1d74890', name: 'Brand New' },
];

const REVERB_CONDITION_UUID_SET = new Set(REVERB_CONDITION_OPTIONS.map((option) => option.uuid));

export function isKnownReverbConditionUuid(uuid: string): boolean {
  return REVERB_CONDITION_UUID_SET.has(uuid);
}

// Best-guess starting point only — the wizard now always lets the user pick/override the exact
// Reverb condition explicitly (see REVERB_CONDITION_OPTIONS), since this auto-map isn't reliable
// enough on its own (CCG's 5 condition values don't line up cleanly with Reverb's 10).
const CCG_CONDITION_TO_REVERB_UUID: Record<string, string> = {
  'New': '7c3f45de-2ae0-4c81-8400-fdb6b1d74890', // Brand New
  'Used - Like New': 'df268ad1-c462-4ba6-b6db-e007e23922ea', // Excellent
  'Used - Good': 'f7a3f48c-972a-44c6-b01a-0cd27488d3f6', // Good
  'Used - Fair': '98777886-76d0-44c8-865e-bb40e669e934', // Fair
};

export function resolveReverbConditionUuid(condition: string): string | null {
  return CCG_CONDITION_TO_REVERB_UUID[condition.trim()] || null;
}

type ReverbCategoryEntry = { uuid: string; full_name: string };

const REVERB_CATEGORIES_CACHE_KEY = 'reverb:categories:v1';
const REVERB_CATEGORIES_CACHE_TTL_SECONDS = 60 * 60 * 24;

async function fetchReverbCategories(env: Env): Promise<ReverbCategoryEntry[]> {
  try {
    const cached = await env.LISTING_JOBS.get(REVERB_CATEGORIES_CACHE_KEY, 'json');
    if (Array.isArray(cached) && cached.length) return cached as ReverbCategoryEntry[];
  } catch {
    // fall through to live fetch
  }

  const response = await fetch(`${REVERB_API_BASE_URL}/categories/flat`, {
    method: 'GET',
    headers: reverbRequestHeaders(env),
  });
  if (!response.ok) {
    console.error('Reverb categories fetch failed', { status: response.status });
    return [];
  }
  const data = await response.json() as { categories?: ReverbCategoryEntry[] };
  const categories = Array.isArray(data.categories) ? data.categories : [];
  if (categories.length) {
    try {
      await env.LISTING_JOBS.put(REVERB_CATEGORIES_CACHE_KEY, JSON.stringify(categories), {
        expirationTtl: REVERB_CATEGORIES_CACHE_TTL_SECONDS,
      });
    } catch {
      // caching is best-effort
    }
  }
  return categories;
}

function normalizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

// Best-effort keyword-overlap match against Reverb's live category list — there is no CCG
// field that stores a chosen Reverb category, so this guesses from the CCG category path text.
// It can pick the wrong subcategory when names diverge; the resulting Reverb category is visible
// on the listing after it's created if it needs manual correction on reverb.com.
export async function resolveReverbCategoryUuid(
  categoryPath: string,
  env: Env,
): Promise<{ uuid: string; matchedName: string } | null> {
  const categories = await fetchReverbCategories(env);
  if (!categories.length) return null;

  const subjectTokens = normalizeForMatch(categoryPath);
  if (!subjectTokens.length) return null;

  let best: { uuid: string; full_name: string; score: number } | null = null;
  for (const category of categories) {
    const name = category.full_name || '';
    const nameTokens = normalizeForMatch(name);
    if (!nameTokens.length) continue;
    let score = 0;
    for (const token of subjectTokens) {
      if (nameTokens.includes(token)) score += 1;
    }
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && nameTokens.length < normalizeForMatch(best.full_name).length)) {
      best = { uuid: category.uuid, full_name: name, score };
    }
  }
  if (!best) return null;
  return { uuid: best.uuid, matchedName: best.full_name };
}

export type ReverbShippingProfile = { id: string; name: string };

// GET /api/shop is documented (see "Shipping Profiles and Shipping Rates" in create-listings
// docs) as the way to list a shop's configured shipping profiles. Profiles themselves can only
// be created/edited on reverb.com, not via the API — this just reads the live list so the
// wizard can offer a real, valid shipping_profile_id instead of guessing at calculated shipping.
export async function fetchReverbShippingProfiles(env: Env): Promise<ReverbShippingProfile[]> {
  const response = await fetch(`${REVERB_API_BASE_URL}/shop`, {
    method: 'GET',
    headers: reverbRequestHeaders(env),
  });
  if (!response.ok) {
    console.error('Reverb shop/shipping-profiles fetch failed', { status: response.status });
    return [];
  }
  const data = await response.json() as { shipping_profiles?: Array<{ id?: unknown; name?: unknown }> };
  const profiles = Array.isArray(data.shipping_profiles) ? data.shipping_profiles : [];
  return profiles
    .filter((profile) => profile.id != null && profile.name)
    .map((profile) => ({ id: String(profile.id), name: String(profile.name) }));
}

export type ReverbListingSourceItem = {
  saleTitle: string;
  saleDescription: string;
  salePrice: number;
  videoUrl: string;
  imageUrls: string[];
  brand: string;
  model: string;
  yearRange: string;
  finish: string;
  condition: string;
  categoryPath: string;
  quantity: number;
};

export function buildReverbListingPayload(
  item: ReverbListingSourceItem,
  categoryUuid: string,
  wizard: ReverbWizardInput,
): Record<string, unknown> {
  const shipping: Record<string, unknown> = { local: true };
  if (wizard.shippingMethod === 'free') {
    shipping.rates = [{ rate: { amount: '0.00', currency: 'USD' }, region_code: 'US_CON' }];
  } else if (wizard.shippingMethod === 'flat') {
    shipping.rates = [{
      rate: { amount: (wizard.flatRateAmount ?? 0).toFixed(2), currency: 'USD' },
      region_code: 'US_CON',
    }];
  }
  // Deliberately never sending an "XX" (everywhere else) rate, so no international shipping is
  // offered. For "calculated", carrier-calculated rates come from a shipping profile configured
  // on reverb.com (shipping_profile_id below). Confirmed via a live test that package
  // dimensions/weight are NOT real fields here — sending them came back from Reverb as
  // local_pickup_only:true with no real shipping, so they were removed from the payload and the
  // wizard entirely rather than collecting data that goes nowhere.

  return {
    make: item.brand,
    model: item.model,
    title: item.saleTitle,
    description: item.saleDescription,
    finish: item.finish || undefined,
    year: item.yearRange || undefined,
    categories: [{ uuid: categoryUuid }],
    condition: { uuid: wizard.conditionUuid },
    // CCG's barcode field can be an internal CCG-generated tag barcode rather than a real
    // manufacturer UPC, so it isn't sent as upc — always declaring "does not apply" instead
    // (confirmed real field per Reverb's docs) avoids the "Brand New" publish block that
    // requires a UPC or this flag, without risking a wrong product match on Reverb's catalog.
    upc_does_not_apply: true,
    shipping_profile_id: wizard.shippingMethod === 'calculated' ? wizard.shippingProfileId : undefined,
    photos: item.imageUrls,
    videos: item.videoUrl ? [{ link: item.videoUrl }] : undefined,
    price: { amount: item.salePrice.toFixed(2), currency: 'USD' },
    has_inventory: true,
    inventory: Math.max(1, item.quantity || 1),
    offers_enabled: wizard.allowOffers,
    shipping,
    sold_as_described: wizard.soldAsDescribed,
    safe_shipping: wizard.safeShipping,
    auto_price_drop: wizard.dropPriceIn2Weeks,
    publish: true,
  };
}

export type ReverbListingUpdateSourceItem = {
  saleTitle: string;
  saleDescription: string;
  salePrice: number;
  videoUrl: string;
  imageUrls: string[];
  brand: string;
  model: string;
  yearRange: string;
  finish: string;
  quantity: number;
};

// For syncing a plain "Save Changes" edit to an already-listed item — deliberately narrower than
// buildReverbListingPayload: it only includes fields CCG's normal edit form actually has fresh
// values for. Condition, shipping, offers, sold-as-described, etc. are wizard-only answers with
// no current value available outside the wizard, so they're omitted here rather than guessed —
// assuming (unverified) that Reverb's PUT leaves omitted fields as they were, matching "updating
// a listing takes the same parameters as create" in their docs without stating omit-behavior.
export function buildReverbListingUpdatePayload(
  item: ReverbListingUpdateSourceItem,
  categoryUuid: string,
): Record<string, unknown> {
  return {
    make: item.brand,
    model: item.model,
    title: item.saleTitle,
    description: item.saleDescription,
    finish: item.finish || undefined,
    year: item.yearRange || undefined,
    categories: [{ uuid: categoryUuid }],
    photos: item.imageUrls,
    videos: item.videoUrl ? [{ link: item.videoUrl }] : undefined,
    price: { amount: item.salePrice.toFixed(2), currency: 'USD' },
    has_inventory: true,
    inventory: Math.max(1, item.quantity || 1),
  };
}

export async function updateReverbListing(
  listingId: string,
  payload: Record<string, unknown>,
  env: Env,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const response = await fetch(`${REVERB_SEARCH_API_URL}/${encodeURIComponent(listingId)}`, {
    method: 'PUT',
    headers: reverbRequestHeaders(env),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const message = extractReverbErrorMessage(data) || text.slice(0, 500) || `Reverb rejected the update (HTTP ${response.status}).`;
    console.error('Reverb update listing failed', { listingId, status: response.status, message });
    return { ok: false, message, status: response.status };
  }
  return { ok: true };
}

type ReverbCreateResult =
  | { ok: true; listingId: string; webUrl: string | null; photoCountReturned: number | null }
  | { ok: false; message: string; status: number };

function extractReverbErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message) return obj.message;
  if (typeof obj.error === 'string' && obj.error) return obj.error;
  if (obj.messages && typeof obj.messages === 'object') {
    const parts: string[] = [];
    for (const [field, msgs] of Object.entries(obj.messages as Record<string, unknown>)) {
      const list = Array.isArray(msgs) ? msgs : [msgs];
      parts.push(`${field}: ${list.map((m) => String(m)).join(', ')}`);
    }
    if (parts.length) return parts.join(' | ');
  }
  return '';
}

export async function createReverbListing(
  payload: Record<string, unknown>,
  env: Env,
): Promise<ReverbCreateResult> {
  const requestBody = JSON.stringify(payload);
  // Log exactly what we send, not just what Reverb returns — the response's has_inventory/
  // inventory not matching what we sent (has_inventory:true, inventory:1) means we need to see
  // both sides side by side rather than assuming the outgoing payload is correct.
  console.log('Reverb create listing request', {
    photos: payload.photos,
    has_inventory: payload.has_inventory,
    inventory: payload.inventory,
    publish: payload.publish,
    fullBody: requestBody.slice(0, 3000),
  });

  const response = await fetch(REVERB_SEARCH_API_URL, {
    method: 'POST',
    headers: reverbRequestHeaders(env),
    body: requestBody,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = extractReverbErrorMessage(data) || text.slice(0, 500) || `Reverb rejected the listing (HTTP ${response.status}).`;
    console.error('Reverb create listing failed', { status: response.status, message });
    return { ok: false, message, status: response.status };
  }

  const record = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
  const links = record._links as { web?: { href?: string }; self?: { href?: string } } | undefined;
  const listingId = extractReverbListingId(record, links);
  if (!listingId) {
    console.error('Reverb create listing: could not find listing id in response', { body: text.slice(0, 1000) });
    // Surface the raw body so the caller can see exactly what Reverb returned instead of
    // guessing blind — this response shape isn't documented in Reverb's public API docs.
    return {
      ok: false,
      message: `Reverb accepted the request but no listing id was found in the response. Raw response: ${text.slice(0, 800)}`,
      status: 502,
    };
  }
  const webUrl = links?.web?.href || null;
  // The whole listing is nested under "listing" in the actual response (confirmed from a real
  // test), not top-level — record.photos/.has_inventory/.inventory at the top level are always
  // undefined. Check both so this keeps working if that ever changes.
  const nestedListing = (record.listing && typeof record.listing === 'object')
    ? record.listing as Record<string, unknown>
    : record;
  // Diagnostic: Reverb's response for a successful create isn't documented publicly either —
  // log the whole thing once so we can see the real shape (photos field included or not,
  // whether it echoes back what was accepted) instead of guessing at why photos didn't attach.
  console.log('Reverb create listing succeeded', {
    listingId,
    hasInventoryReturned: nestedListing.has_inventory,
    inventoryReturned: nestedListing.inventory,
    photosReturned: nestedListing.photos,
    videosReturned: nestedListing.videos,
    body: text.slice(0, 2000),
  });
  const photosField = nestedListing.photos;
  const photoCountReturned = Array.isArray(photosField) ? photosField.length : null;
  return { ok: true, listingId, webUrl, photoCountReturned };
}

// Confirmed verbatim from Reverb's /docs/updating-your-listing documentation — not a guess.
export async function endReverbListing(
  listingId: string,
  env: Env,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const response = await fetch(`${REVERB_API_BASE_URL}/my/listings/${encodeURIComponent(listingId)}/state/end`, {
    method: 'PUT',
    headers: reverbRequestHeaders(env),
    body: JSON.stringify({ reason: 'not_sold' }),
  });

  if (!response.ok) {
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const message = extractReverbErrorMessage(data) || text.slice(0, 500) || `Reverb rejected ending the listing (HTTP ${response.status}).`;
    console.error('Reverb end listing failed', { listingId, status: response.status, message });
    return { ok: false, message, status: response.status };
  }

  return { ok: true };
}

function extractReverbListingId(
  record: Record<string, unknown>,
  links: { web?: { href?: string }; self?: { href?: string } } | undefined,
): string | null {
  if (record.id != null && record.id !== '') return String(record.id);

  const nested = record.listing as Record<string, unknown> | undefined;
  if (nested?.id != null && nested.id !== '') return String(nested.id);

  const embedded = record._embedded as { listing?: Record<string, unknown> } | undefined;
  if (embedded?.listing?.id != null) return String(embedded.listing.id);

  // HAL APIs often carry the id as the trailing path segment of the self link even without a
  // flat top-level "id" field.
  const selfHref = links?.self?.href || (record._links as { self?: { href?: string } } | undefined)?.self?.href;
  if (selfHref) {
    const match = selfHref.match(/\/listings\/(\d+)(?:[/?]|$)/);
    if (match) return match[1];
  }
  const webHref = links?.web?.href;
  if (webHref) {
    const match = webHref.match(/\/item\/(\d+)(?:[-/?]|$)/);
    if (match) return match[1];
  }

  return null;
}

// Reverb's own docs for this endpoint (reverb-api.com/docs/retrieve-orders) never include a
// verbatim JSON example — only prose describing the fields exist ("comprehensive financial
// breakdowns... fees (selling, shipping label, direct checkout), and payout calculations").
// Confirmed statuses (11): unpaid, payment_pending, pending_review, blocked, paid, shipped,
// picked_up, received, refunded, cancelled. Real field names/shapes are unverified until we see
// a live response — that's the point of the dry-run sync endpoint that calls this.
export async function fetchReverbSellingOrders(
  env: Env,
  params?: { updatedStartDate?: string; updatedEndDate?: string },
): Promise<{ ok: true; orders: Array<Record<string, unknown>> } | { ok: false; message: string; status: number }> {
  const url = new URL(`${REVERB_API_BASE_URL}/my/orders/selling/all`);
  if (params?.updatedStartDate) url.searchParams.set('updated_start_date', params.updatedStartDate);
  if (params?.updatedEndDate) url.searchParams.set('updated_end_date', params.updatedEndDate);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: reverbRequestHeaders(env),
  });
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, message: text.slice(0, 500) || `HTTP ${response.status}`, status: response.status };
  }
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, message: 'Reverb returned a non-JSON response for orders.', status: 502 };
  }
  const record = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
  // Try the plausible container keys — unconfirmed which one Reverb actually uses.
  const orders = (Array.isArray(record.orders) && record.orders)
    || (Array.isArray((record._embedded as Record<string, unknown> | undefined)?.orders) && (record._embedded as Record<string, unknown>).orders)
    || (Array.isArray(record.results) && record.results)
    || (Array.isArray(data) ? data : null)
    || [];
  return { ok: true, orders: orders as Array<Record<string, unknown>> };
}
