import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { toBooleanInput } from '../utils/misc.js';
import { parseCurrencyAmount } from '../utils/money.js';
import { toReverbFetchableImageUrl } from '../inventory/reverb-listing.js';
import { createGxListing, fetchGxCategories, fetchGxConditions, type GxCategory, type GxListing } from './api.js';
import { dbGetCcgCategoryGxDefault, dbInsertGxLink, dbSetCcgCategoryGxDefault } from './db.js';

// Builds GX listing payloads from CCG inventory items. GX rules (from the API docs): price must
// be > $25 and <= $10,000; 1-25 publicly reachable image URLs; madeYear >= 1800; madeDecade is
// one of 2020s ... 1900s / pre_1900s; optedInToSalesPercentage is 5/10/15/20/25/30. Every GX
// listing is a single unit — there is no quantity field. A multi-unit CCG item is listed as one
// unit; a GX sale splits that unit off and (with autoRelist) puts up a fresh listing for the next.

export const GX_MIN_PRICE_EXCLUSIVE = 25;
export const GX_MAX_PRICE = 10000;
export const GX_MAX_IMAGES = 25;
const GX_SALE_PERCENTAGES = new Set([5, 10, 15, 20, 25, 30]);
const GX_DEFAULT_RETURN_POLICY_DAYS = 7;
const GX_DEFAULT_PAYOUT_METHOD = 'hyperwallet';
const GX_PAYOUT_METHODS = new Set(['hyperwallet', 'store_credit']);

// Best-guess starting point; the caller can always pass an explicit conditionId.
// GX condition ids (confirmed live): 1 Good, 2 Excellent, 3 Mint, 4 Fair, 5 Poor.
const CCG_CONDITION_TO_GX_ID: Record<string, number> = {
  'New': 3, // Mint
  'Used - Like New': 2, // Excellent
  'Used - Good': 1, // Good
  'Used - Fair': 4, // Fair
};

export function resolveGxConditionId(ccgCondition: string): number | null {
  return CCG_CONDITION_TO_GX_ID[ccgCondition.trim()] ?? null;
}

// CCG category words that GX spells differently.
const CATEGORY_TOKEN_SYNONYMS: Record<string, string> = {
  amplification: 'amp',
  amplifier: 'amp',
  phase: 'phaser',
};

const CATEGORY_STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'new', 'used']);

function categoryTokens(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, ' ')
    .split(/\s+/)
    // Plural -> singular: "basses" -> "bass", "pedals" -> "pedal" (but not "bass" -> "bas").
    .map((token) => (token.endsWith('sses') ? token.slice(0, -2) : token.endsWith('ss') ? token : token.replace(/s$/, '')))
    .map((token) => CATEGORY_TOKEN_SYNONYMS[token] ?? token)
    .filter((token) => token.length > 2 && !CATEGORY_STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

// Keyword-overlap guess from the CCG category path ("Effects Pedals > Fuzz") to a GX category
// path. Words from the CCG leaf category count triple, so "Fuzz" decides between pedal types
// rather than the shared "Effects Pedals"; parent words add one ("Bass > Electric Basses" is a bass).
// Words from the item title also add one, to break ties ("Cases & Bags" + "Electric Guitar Gig
// Bag" is a guitar gig bag, not a drum bag). Ties go to the deeper (more specific) GX category,
// then the shorter path. Can guess wrong — the caller can pass an explicit categoryId, and a
// used category is saved as that CCG category's default.
export function guessGxCategory(ccgCategoryPath: string, categories: GxCategory[], itemTitle = ''): GxCategory | null {
  const segments = ccgCategoryPath.split('>').map((segment) => segment.trim()).filter(Boolean);
  const leaf = new Set(categoryTokens(segments[segments.length - 1] ?? ''));
  const parents = new Set(categoryTokens(segments.slice(0, -1).join(' ')));
  const title = new Set(categoryTokens(itemTitle));
  if (!leaf.size && !parents.size) return null;
  let best: { category: GxCategory; score: number; depth: number; length: number } | null = null;
  for (const category of categories) {
    const tokens = categoryTokens(category.path);
    const score = tokens.reduce((sum, token) => sum + (leaf.has(token) ? 3 : 0) + (parents.has(token) ? 1 : 0) + (title.has(token) ? 1 : 0), 0);
    if (score <= 0) continue;
    const depth = category.path.split('>>').length;
    const candidate = { category, score, depth, length: tokens.length };
    if (!best
      || candidate.score > best.score
      || (candidate.score === best.score && candidate.depth > best.depth)
      || (candidate.score === best.score && candidate.depth === best.depth && candidate.length < best.length)) {
      best = candidate;
    }
  }
  return best?.category ?? null;
}

// "1978" -> { year: 1978, decade: "1970s" }; "1978-1982" -> { year: null, decade: "1970s" } when
// both ends share a decade; anything unparseable -> nothing.
export function parseGxMadeYear(yearRange: string): { year: number | null; decade: string | null } {
  const decadeOf = (year: number) => (year < 1900 ? 'pre_1900s' : `${Math.floor(year / 10) * 10}s`);
  // A decade written as such ("1970s") gives a decade but no year.
  const decadeWritten = yearRange.match(/\b(1[89]\d0|20\d0)s\b/);
  if (decadeWritten) return { year: null, decade: decadeOf(Number(decadeWritten[1])) };
  const years = (yearRange.match(/\b(1[89]\d{2}|20\d{2})\b/g) || []).map(Number);
  if (!years.length) return { year: null, decade: null };
  const decades = new Set(years.map(decadeOf));
  return {
    year: years.length === 1 ? years[0] : null,
    decade: decades.size === 1 ? decadeOf(years[0]) : null,
  };
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url.trim());
}

// ---- Listing options (what the wizard will ask) ----------------------------------------

export type GxListingOptions = {
  conditionId: number | null;
  categoryId: number | null;
  saveCategoryDefault: boolean;
  acceptsOffers: boolean;
  minOffer: number | null;
  optedInToSales: boolean;
  optedInToSalesPercentage: number;
  leftHanded: boolean;
  shippingAllowed: boolean;
  localPickupAllowed: boolean;
  shippingCost: number | null;
  returnPolicyDays: number;
  payoutMethod: string;
  publish: boolean;
  // After a GX sale, if units remain, list the next one with these same options.
  autoRelist: boolean;
};

// Every field is optional; defaults come from the item (shipping, quantity) or GX's own defaults.
export function parseGxListingOptions(
  body: Record<string, unknown>,
  item: { allowShipping: boolean; fixedShippingAmount: number; quantity: number },
): { value: GxListingOptions; error?: undefined } | { value?: undefined; error: string } {
  const optionalId = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
  };
  const conditionId = optionalId(body.conditionId);
  if (Number.isNaN(conditionId)) return { error: 'conditionId must be a GX condition id.' };
  const categoryId = optionalId(body.categoryId);
  if (Number.isNaN(categoryId)) return { error: 'categoryId must be a GX category id.' };

  const acceptsOffers = toBooleanInput(body.acceptsOffers, true);
  const minOffer = body.minOffer == null || body.minOffer === '' ? null : parseCurrencyAmount(body.minOffer);
  if (minOffer != null && minOffer <= 0) return { error: 'minOffer must be greater than $0.' };

  const optedInToSales = toBooleanInput(body.optedInToSales, false);
  const optedInToSalesPercentage = body.optedInToSalesPercentage == null || body.optedInToSalesPercentage === ''
    ? 10
    : Number(body.optedInToSalesPercentage);
  if (!GX_SALE_PERCENTAGES.has(optedInToSalesPercentage)) {
    return { error: 'optedInToSalesPercentage must be 5, 10, 15, 20, 25 or 30.' };
  }

  const shippingAllowed = toBooleanInput(body.shippingAllowed, item.allowShipping);
  const localPickupAllowed = toBooleanInput(body.localPickupAllowed, true);
  if (!shippingAllowed && !localPickupAllowed) return { error: 'Allow shipping, local pickup, or both.' };
  let shippingCost: number | null = null;
  if (shippingAllowed) {
    shippingCost = body.shippingCost == null || body.shippingCost === ''
      ? Math.max(0, Number(item.fixedShippingAmount || 0))
      : parseCurrencyAmount(body.shippingCost);
    if (shippingCost == null || shippingCost < 0) return { error: 'shippingCost must be $0 (free) or more.' };
  }

  const returnPolicyDays = body.returnPolicyDays == null || body.returnPolicyDays === ''
    ? GX_DEFAULT_RETURN_POLICY_DAYS
    : Number(body.returnPolicyDays);
  if (![0, 7, 14, 21, 30].includes(returnPolicyDays)) return { error: 'returnPolicyDays must be 0, 7, 14, 21 or 30.' };

  const payoutMethod = normalizeText(body.payoutMethod, GX_DEFAULT_PAYOUT_METHOD);
  if (!GX_PAYOUT_METHODS.has(payoutMethod)) return { error: 'payoutMethod must be hyperwallet or store_credit.' };

  return {
    value: {
      conditionId,
      categoryId,
      saveCategoryDefault: toBooleanInput(body.saveCategoryDefault, true),
      acceptsOffers,
      minOffer,
      optedInToSales,
      optedInToSalesPercentage,
      leftHanded: toBooleanInput(body.leftHanded, false),
      shippingAllowed,
      localPickupAllowed,
      shippingCost,
      returnPolicyDays,
      payoutMethod,
      publish: toBooleanInput(body.publish, false),
      autoRelist: toBooleanInput(body.autoRelist, item.quantity > 1),
    },
  };
}

// ---- Item -> payload -------------------------------------------------------------------

export type GxListingPlan = {
  missing: string[];
  problems: string[];
  categoryId: number | null;
  categorySource: 'explicit' | 'ccg_default' | 'guess' | null;
  categoryPath: string | null;
  conditionId: number | null;
  imageUrls: string[];
  payload: Record<string, unknown>;
};

export function gxPublicImageUrls(record: Record<string, unknown>, env: Env): string[] {
  const imageRecords = Array.isArray(record.images)
    ? record.images as Array<{ url?: string; isPrivate?: boolean }>
    : [];
  const rawImageUrls = imageRecords.length
    ? imageRecords.filter((image) => !image.isPrivate).map((image) => image.url || '').filter(Boolean)
    : (Array.isArray(record.imageUrls) ? (record.imageUrls as string[]).filter(Boolean) : []);
  return rawImageUrls
    .map((url) => toReverbFetchableImageUrl(url, env))
    .filter((url): url is string => Boolean(url))
    .slice(0, GX_MAX_IMAGES);
}

// Fields CCG's edit form owns, for both create and the edit-sync PUT. Everything listing-only
// (condition, category, offers, shipping, payout, returns) is set on create and left alone after.
export function buildGxItemFields(record: Record<string, unknown>, env: Env): Record<string, unknown> {
  const { year, decade } = parseGxMadeYear(normalizeText(record.yearRange, ''));
  const videoUrl = normalizeText(record.videoUrl, '');
  const salePrice = typeof record.salePrice === 'number' ? record.salePrice : parseCurrencyAmount(record.salePrice);
  return {
    title: normalizeText(record.saleTitle, ''),
    brand: normalizeText(record.brand, ''),
    description: normalizeText(record.saleDescription, ''),
    price: salePrice != null ? Number(salePrice.toFixed(2)) : null,
    imageUrls: gxPublicImageUrls(record, env),
    videoUrl: videoUrl && isYouTubeUrl(videoUrl) ? videoUrl : null,
    madeYear: year,
    madeDecade: decade,
  };
}

export async function planGxListing(
  record: Record<string, unknown>,
  options: GxListingOptions,
  env: Env,
): Promise<GxListingPlan> {
  const fields = buildGxItemFields(record, env);
  const missing: string[] = [];
  const problems: string[] = [];
  if (!fields.title) missing.push('For Sale Title');
  if (!fields.brand) missing.push('Brand');
  if (!fields.description) missing.push('Sale Description');
  if (!fields.price) missing.push('Sale Price');
  const imageUrls = fields.imageUrls as string[];
  if (!imageUrls.length) missing.push('at least one public photo');

  const price = Number(fields.price || 0);
  if (price && (price <= GX_MIN_PRICE_EXCLUSIVE || price > GX_MAX_PRICE)) {
    problems.push(`Gear Exchange prices must be over $${GX_MIN_PRICE_EXCLUSIVE} and at most $${GX_MAX_PRICE.toLocaleString('en-US')}.`);
  }
  if (record.isSold) problems.push('This item is already sold.');
  if (options.minOffer != null && price && options.minOffer >= price) problems.push('Minimum offer must be below the price.');

  // Condition: explicit, else mapped from the CCG condition.
  const conditions = await fetchGxConditions(env);
  const conditionId = options.conditionId ?? resolveGxConditionId(normalizeText(record.condition, ''));
  if (!conditionId) missing.push('Condition (or pass conditionId)');
  else if (conditions.length && !conditions.some((condition) => condition.id === conditionId)) {
    problems.push(`GX condition ${conditionId} doesn't exist.`);
  }

  // Category: explicit, else the CCG category's saved default, else a keyword guess.
  const categories = await fetchGxCategories(env);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  let categoryId: number | null = options.categoryId;
  let categorySource: GxListingPlan['categorySource'] = categoryId ? 'explicit' : null;
  if (!categoryId) {
    const ccgDefault = await dbGetCcgCategoryGxDefault(Number(record.categoryId), env);
    if (ccgDefault) {
      categoryId = ccgDefault;
      categorySource = 'ccg_default';
    }
  }
  if (!categoryId) {
    const guess = guessGxCategory(
      normalizeText(record.categoryPath, '') || normalizeText(record.categoryName, ''),
      categories,
      normalizeText(record.saleTitle, '') || normalizeText(record.title, ''),
    );
    if (guess) {
      categoryId = guess.id;
      categorySource = 'guess';
    }
  }
  if (!categoryId) missing.push('GX category (or pass categoryId)');
  else if (categories.length && !categoryById.has(categoryId)) problems.push(`GX category ${categoryId} doesn't exist.`);

  const payload: Record<string, unknown> = {
    ...fields,
    // Our inventory id comes back on every webhook for this listing.
    productId: String(record.id),
    sku: normalizeText(record.ccgNumber, '') || null,
    categoryId,
    conditionId,
    publishImmediately: options.publish,
    acceptsOffers: options.acceptsOffers,
    minOffer: options.acceptsOffers ? options.minOffer : null,
    optedInToSales: options.optedInToSales,
    optedInToSalesPercentage: options.optedInToSalesPercentage,
    leftHanded: options.leftHanded,
    shippingAllowed: options.shippingAllowed,
    localPickupAllowed: options.localPickupAllowed,
    shippingCost: options.shippingAllowed ? options.shippingCost : null,
    returnPolicyDays: options.returnPolicyDays,
    payoutMethod: options.payoutMethod,
  };
  // GX treats a missing optional field as its default; don't send nulls for fields it validates.
  for (const key of Object.keys(payload)) {
    if (payload[key] == null) delete payload[key];
  }

  return {
    missing,
    problems,
    categoryId,
    categorySource,
    categoryPath: categoryId ? categoryById.get(categoryId)?.path ?? null : null,
    conditionId,
    imageUrls,
    payload,
  };
}

// Creates the GX listing for an item and links it (gx-add, and the relist after a GX sale).
export async function createGxListingForItem(
  record: Record<string, unknown>,
  options: GxListingOptions,
  env: Env,
): Promise<
  | { ok: true; listing: GxListing; plan: GxListingPlan; message: string }
  | { ok: false; status: number; message: string; missing?: string[]; problems?: string[] }
> {
  const plan = await planGxListing(record, options, env);
  if (plan.missing.length) {
    return { ok: false, status: 400, message: `Fill these in before listing on Gear Exchange: ${plan.missing.join(', ')}.`, missing: plan.missing };
  }
  if (plan.problems.length) return { ok: false, status: 400, message: plan.problems.join(' '), problems: plan.problems };

  const result = await createGxListing(env, plan.payload);
  if (!result.ok) {
    return { ok: false, status: result.status >= 400 && result.status < 600 ? result.status : 502, message: `Gear Exchange rejected the listing: ${result.message}` };
  }
  const { listing } = result;
  const saved = await dbInsertGxLink({
    inventoryItemId: Number(record.id),
    gxListingId: Number(listing.id),
    gxStatus: normalizeText(listing.status, 'draft'),
    gxCategoryId: plan.categoryId as number,
    gxConditionId: plan.conditionId as number,
    payoutMethod: options.payoutMethod,
    optionsJson: JSON.stringify(options),
  }, env);
  if (!saved) {
    return { ok: false, status: 500, message: `Listed on Gear Exchange (listing ${listing.id}), but failed to save the link locally. Delete it on GX before retrying.` };
  }
  if (options.saveCategoryDefault && plan.categoryId && record.categoryId != null) {
    await dbSetCcgCategoryGxDefault(Number(record.categoryId), plan.categoryId, env);
  }
  return { ok: true, listing, plan, message: result.message };
}
