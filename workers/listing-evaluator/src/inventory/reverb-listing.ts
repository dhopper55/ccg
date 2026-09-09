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
// price-drop-after-N-weeks feature, "Safe Shipping", or calculated (dimension/weight-based)
// shipping. The fields below (sold_as_described, auto_price_drop, safe_shipping, and the
// shipping.dimensions/shipping.weight objects) are best-guess names following Reverb's existing
// snake_case conventions — they are NOT confirmed against a live account. If Reverb silently
// ignores them (rather than erroring), those specific toggles won't take effect even though the
// listing itself succeeds. Test with one real listing and compare against what shows up on
// reverb.com; if a toggle didn't take effect, inspect reverb.com's own listing form network
// request in browser dev tools for the real field name and it's a one-line fix here.

export type ReverbShippingMethod = 'calculated' | 'free' | 'flat';

export type ReverbWizardInput = {
  soldAsDescribed: boolean;
  dropPriceIn2Weeks: boolean;
  allowOffers: boolean;
  shippingMethod: ReverbShippingMethod;
  flatRateAmount: number | null;
  packageWidthIn: number;
  packageHeightIn: number;
  packageLengthIn: number;
  weightLbs: number;
  weightOz: number;
  safeShipping: boolean;
};

export function parseReverbWizardInput(
  body: Record<string, unknown>,
): { value: ReverbWizardInput; error?: undefined } | { value?: undefined; error: string } {
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

  const packageWidthIn = parseBoundedInt(body.packageWidthIn, 0, 0, 1000);
  const packageHeightIn = parseBoundedInt(body.packageHeightIn, 0, 0, 1000);
  const packageLengthIn = parseBoundedInt(body.packageLengthIn, 0, 0, 1000);
  if (!packageWidthIn || !packageHeightIn || !packageLengthIn) {
    return { error: 'Enter package width, height, and length.' };
  }

  const weightLbs = parseBoundedInt(body.weightLbs, 0, 0, 1000);
  const weightOz = parseBoundedInt(body.weightOz, 0, 0, 15);
  if (!weightLbs && !weightOz) {
    return { error: 'Enter a package weight.' };
  }

  const safeShipping = toBooleanInput(body.safeShipping, false);

  return {
    value: {
      soldAsDescribed,
      dropPriceIn2Weeks,
      allowOffers,
      shippingMethod,
      flatRateAmount,
      packageWidthIn,
      packageHeightIn,
      packageLengthIn,
      weightLbs,
      weightOz,
      safeShipping,
    },
  };
}

// Verified verbatim from Reverb's /docs/create-listings documentation table. These base
// condition UUIDs are account-independent per Reverb's docs (some, like B-Stock, additionally
// require the shop to be enabled for them — not used here).
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
  conditionUuid: string,
  categoryUuid: string,
  wizard: ReverbWizardInput,
): Record<string, unknown> {
  const shipping: Record<string, unknown> = {
    local: true,
    dimensions: {
      length: wizard.packageLengthIn,
      width: wizard.packageWidthIn,
      height: wizard.packageHeightIn,
      unit: 'in',
    },
    weight: {
      pounds: wizard.weightLbs,
      ounces: wizard.weightOz,
    },
  };
  if (wizard.shippingMethod === 'free') {
    shipping.rates = [{ rate: { amount: '0.00', currency: 'USD' }, region_code: 'US_CON' }];
  } else if (wizard.shippingMethod === 'flat') {
    shipping.rates = [{
      rate: { amount: (wizard.flatRateAmount ?? 0).toFixed(2), currency: 'USD' },
      region_code: 'US_CON',
    }];
  }
  // shippingMethod === 'calculated': no rates array — dimensions/weight above are what let
  // Reverb calculate a per-buyer cost. Deliberately never sending an "XX" (everywhere else)
  // rate, so no international shipping is offered.

  return {
    make: item.brand,
    model: item.model,
    title: item.saleTitle,
    description: item.saleDescription,
    finish: item.finish || undefined,
    year: item.yearRange || undefined,
    categories: [{ uuid: categoryUuid }],
    condition: { uuid: conditionUuid },
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

type ReverbCreateResult =
  | { ok: true; listingId: string; webUrl: string | null }
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
  const response = await fetch(REVERB_SEARCH_API_URL, {
    method: 'POST',
    headers: reverbRequestHeaders(env),
    body: JSON.stringify(payload),
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
  const listingId = record.id != null ? String(record.id) : null;
  if (!listingId) {
    return { ok: false, message: 'Reverb accepted the request but did not return a listing id.', status: 502 };
  }
  const links = record._links as { web?: { href?: string } } | undefined;
  const webUrl = links?.web?.href || null;
  return { ok: true, listingId, webUrl };
}
