import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { parseCurrencyAmount, normalizeMoneyValue } from '../utils/money.js';
import type { SingleAiResult, ListingData } from '../types/core.js';
import { REVERB_SEARCH_API_URL, REVERB_API_TOKEN_FALLBACK, REVERB_PRICING_SEARCH_LIMIT } from '../constants.js';
import { normalizeReverbCondition as _normalizeReverbConditionInternal } from './reverb2.js';

export type ReverbItemResponse = {
  id?: number | string;
  title?: string;
  description?: string;
  condition?: { display_name?: string } | string;
  price?: {
    amount?: string | number;
    currency?: string;
    symbol?: string;
  };
  shipping?: {
    amount?: string | number;
  };
  photos?: Array<{
    _links?: {
      large_crop?: { href?: string };
      small_crop?: { href?: string };
      full?: { href?: string };
    };
  }>;
  _links?: {
    web?: { href?: string };
  };
  shop?: {
    location?: string;
  };
  location?: {
    city?: string;
    region?: string;
    country_code?: string;
  } | string;
};

export type ReverbSearchListing = ReverbItemResponse;

export type ReverbComp = {
  title: string;
  price: number;
  condition: string;
  url: string;
};

export type ReverbPricingContext = {
  comps: ReverbComp[];
  baseComps: ReverbComp[];
};

export function pickReverbImageUrls(listing: {
  photos?: Array<{
    _links?: {
      large_crop?: { href?: string };
      small_crop?: { href?: string };
      full?: { href?: string };
    };
  }>;
}): string[] {
  const images = (listing.photos || []).flatMap((photo) => ([
    normalizeText(photo?._links?.large_crop?.href, ''),
    normalizeText(photo?._links?.full?.href, ''),
    normalizeText(photo?._links?.small_crop?.href, ''),
  ]));

  return Array.from(new Set(images.filter(Boolean)));
}

export function normalizeReverbListingData(listing: ReverbItemResponse): ListingData {
  const images = pickReverbImageUrls(listing);
  const location = typeof listing.location === 'string'
    ? normalizeText(listing.location, '')
    : [
        normalizeText(listing.location?.city, ''),
        normalizeText(listing.location?.region, ''),
        normalizeText(listing.location?.country_code, ''),
      ].filter(Boolean).join(', ');

  return {
    title: normalizeText(listing.title, 'Untitled listing'),
    price: normalizeText(listing.price?.amount, ''),
    location: normalizeText(listing.shop?.location, '') || location,
    condition: normalizeReverbCondition(listing),
    description: normalizeText(listing.description, ''),
    images,
    url: normalizeText(listing._links?.web?.href, ''),
  };
}

export async function fetchReverbListingById(listingId: string, env: Env): Promise<ListingData | null> {
  const response = await fetch(`${REVERB_SEARCH_API_URL}/${encodeURIComponent(listingId)}`, {
    method: 'GET',
    headers: reverbRequestHeaders(env),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Reverb listing fetch failed', { listingId, status: response.status, body: body.slice(0, 500) });
    return null;
  }

  const data = await response.json() as ReverbItemResponse;
  const normalized = normalizeReverbListingData(data);
  if (!normalized.title.trim() || normalized.images.length === 0) {
    return null;
  }
  return normalized;
}

export function extractReverbListingId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!(host === 'reverb.com' || host.endsWith('.reverb.com'))) return null;
    const match = parsed.pathname.match(/^\/item\/(\d+)(?:[-/]|$)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function pricingSubjectTokens(base: SingleAiResult): string[] {
  const brand = normalizeText(base.brand, '').toLowerCase();
  const model = normalizeText(base.model, '').toLowerCase()
    .replace(/\(not definitive\)/gi, '')
    .replace(/[^a-z0-9 ]/g, ' ');
  return Array.from(new Set([brand, ...model.split(/\s+/)].filter((token) => token && token.length >= 3)));
}

export function normalizePricingModelText(base: SingleAiResult): string {
  return normalizeText(base.model, '')
    .replace(/\(NOT DEFINITIVE\)/gi, '')
    .replace(/\bwith\s+roland\b.*$/i, '')
    .replace(/\bwith\s+midi\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNicheElectronicsListing(base: SingleAiResult): boolean {
  const text = [
    normalizeText(base.model, ''),
    normalizeText(base.og_specs_pickups, ''),
    normalizeText(base.known_weak_points, ''),
    normalizeText(base.buyer_what_to_check, ''),
  ].join(' ').toLowerCase();
  return /roland|midi|gk|13-?pin|synth/.test(text);
}

export function buildReverbPricingQueries(base: SingleAiResult): Array<{ label: string; query: string }> {
  const brand = normalizeText(base.brand, '').replace(/\(NOT DEFINITIVE\)/gi, '').trim();
  const model = normalizeText(base.model, '').replace(/\(NOT DEFINITIVE\)/gi, '').trim();
  const baseModel = normalizePricingModelText(base);
  const finish = normalizeText(base.finish, '').replace(/^Guess:\s*/i, '').trim();
  const year = normalizeText(base.year, '').replace(/\(NOT DEFINITIVE\)/gi, '').trim();
  const condition = normalizeText(base.condition, '').trim();
  const modelLower = model.toLowerCase();
  const hasRoland = /roland|midi|gk/.test(modelLower)
    || /roland|midi|gk/.test(normalizeText(base.og_specs_pickups, '').toLowerCase());
  const hasStrat = /stratocaster|strat/.test(modelLower) || /stratocaster|strat/.test(baseModel.toLowerCase());
  const mentionsMexico = /mexico|mim/.test([model, baseModel, normalizeText(base.serial_brand, ''), normalizeText(base.year, '')].join(' ').toLowerCase());

  const exactish = [
    year && !/unknown/i.test(year) ? year : '',
    brand,
    model,
    finish && !/unknown/i.test(finish) ? finish : '',
    condition && !/unknown/i.test(condition) ? condition : '',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const relaxed = [
    brand,
    hasRoland ? 'Roland Ready' : '',
    hasStrat ? 'Stratocaster' : baseModel,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const feature = [
    brand,
    hasStrat ? 'Strat' : baseModel,
    hasRoland ? 'Roland GK MIDI' : 'MIDI',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const baseFloor = [
    brand,
    hasStrat ? 'Stratocaster' : baseModel,
    mentionsMexico ? 'MIM' : '',
    !mentionsMexico && /mexico/i.test([model, normalizeText(base.serial_brand, '')].join(' ')) ? 'Made in Mexico' : '',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const queries = [
    { label: 'exact', query: exactish || `${brand} ${model}`.trim() || 'guitar' },
    { label: 'relaxed', query: relaxed || `${brand} ${baseModel}`.trim() || 'guitar' },
    ...(hasRoland ? [{ label: 'feature', query: feature || `${brand} Roland Strat`.trim() }] : []),
    { label: 'base-floor', query: baseFloor || `${brand} ${baseModel}`.trim() || 'guitar' },
  ];

  const seen = new Set<string>();
  return queries.filter((entry) => {
    const key = entry.query.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildReverbPricingQuery(base: SingleAiResult): string {
  return buildReverbPricingQueries(base)[0]?.query || 'guitar';
}

export function reverbRequestHeaders(env: Env): HeadersInit {
  const token = env.REVERB_API_TOKEN || REVERB_API_TOKEN_FALLBACK;
  return {
    'Content-Type': 'application/hal+json',
    'Accept': 'application/hal+json',
    'Accept-Version': '3.0',
    'Authorization': `Bearer ${token}`,
  };
}

export function parseReverbListingPrice(listing: ReverbSearchListing): number | null {
  const base = parseCurrencyAmount(listing.price?.amount);
  if (base == null || base <= 0) return null;
  const shipping = parseCurrencyAmount(listing.shipping?.amount) || 0;
  return Math.round(base + shipping);
}

export function normalizeReverbCondition(listing: ReverbSearchListing): string {
  if (typeof listing.condition === 'string') return normalizeText(listing.condition, '');
  return normalizeText(listing.condition?.display_name, '');
}

export function normalizeReverbComp(listing: ReverbSearchListing): ReverbComp | null {
  const price = parseReverbListingPrice(listing);
  const title = normalizeText(listing.title, '');
  const url = normalizeText(listing._links?.web?.href, '');
  if (!price || !title) return null;
  return {
    title,
    price,
    condition: normalizeReverbCondition(listing),
    url,
  };
}

export function scoreReverbCompMatch(comp: ReverbComp, base: SingleAiResult): number {
  const text = `${comp.title} ${comp.condition}`.toLowerCase();
  const tokens = pricingSubjectTokens(base);
  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) score += 1;
  }
  if (/roland|gk|midi/.test(normalizeText(base.model, '').toLowerCase())) {
    if (/roland|gk|midi/.test(text)) score += 3;
    else score -= 2;
  }
  return score;
}

export function pickReverbComps(raw: ReverbSearchListing[], base: SingleAiResult, minScore = 1): ReverbComp[] {
  return scoredReverbComps(raw, base)
    .filter((entry) => entry.score >= minScore)
    .slice(0, REVERB_PRICING_SEARCH_LIMIT)
    .map((entry) => entry.comp);
}

export function scoredReverbComps(raw: ReverbSearchListing[], base: SingleAiResult): Array<{ comp: ReverbComp; score: number }> {
  return raw
    .map((listing) => normalizeReverbComp(listing))
    .filter((comp): comp is ReverbComp => Boolean(comp))
    .map((comp) => ({ comp, score: scoreReverbCompMatch(comp, base) }))
    .sort((a, b) => b.score - a.score || a.comp.price - b.comp.price);
}

export function dedupeReverbComps(comps: ReverbComp[]): ReverbComp[] {
  const seen = new Set<string>();
  const out: ReverbComp[] = [];
  for (const comp of comps) {
    const key = `${comp.url}|${comp.title.toLowerCase()}|${comp.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(comp);
  }
  return out;
}

export function summarizeReverbMatchesInline(comps: ReverbComp[], limit = 3): string {
  if (!comps.length) return 'No matched Reverb titles.';
  return comps.slice(0, limit).map((comp) => `"${comp.title}" ($${comp.price})`).join('; ');
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

export function rangeFromReverbComps(comps: ReverbComp[], base: SingleAiResult): { low: number; medium: number; high: number; confidence: string; notes: string } | null {
  if (comps.length === 0) return null;
  const sorted = comps.map((c) => c.price).sort((a, b) => a - b);
  let low = percentile(sorted, 0.2);
  let medium = percentile(sorted, 0.5);
  let high = percentile(sorted, 0.8);

  // Convert Reverb online asking context to more realistic local private-party numbers.
  const onlineToPrivateFactor = comps.length >= 4 ? 0.82 : 0.78;
  low = Math.round(low * (onlineToPrivateFactor - 0.03));
  medium = Math.round(medium * onlineToPrivateFactor);
  high = Math.round(high * (onlineToPrivateFactor + 0.02));

  const modelText = normalizeText(base.model, '').toLowerCase();
  const serialKnown = Boolean(normalizeText(base.serial, ''));

  // Niche electronics/feature penalty unless verified by listing context (not currently available here).
  if (/roland|midi|gk/.test(modelText)) {
    low = Math.round(low * 0.9);
    medium = Math.round(medium * 0.9);
    high = Math.round(high * 0.88);
  }

  // Uncertainty penalty when serial is missing.
  if (!serialKnown) {
    low = Math.round(low * 0.96);
    medium = Math.round(medium * 0.95);
    high = Math.round(high * 0.93);
  }

  low = Math.max(50, low);
  high = Math.max(low, high);
  medium = Math.min(high, Math.max(low, medium));

  // Apply 15% retail premium, ceiling-rounded (e.g. $100 → $115, $125 → $144).
  low = Math.ceil(low * 1.15);
  medium = Math.ceil(medium * 1.15);
  high = Math.ceil(high * 1.15);
  // Re-normalize order in case ceiling nudged values out of sequence at very small amounts.
  high = Math.max(low, high);
  medium = Math.min(high, Math.max(low, medium));

  const confidence = comps.length >= 5 ? 'High' : comps.length >= 3 ? 'Medium' : 'Low';
  const notes = `Reverb listings context (${comps.length} matches). Converted to local private-party with conservative online-to-local discount and uncertainty penalties.`;
  return { low, medium, high, confidence, notes };
}

export function summarizeReverbComps(comps: ReverbComp[]): string {
  if (!comps.length) return 'No Reverb matches found.';
  return comps
    .slice(0, 6)
    .map((comp, index) => `${index + 1}. ${comp.title} - $${comp.price}${comp.condition ? ` (${comp.condition})` : ''}`)
    .join('\n');
}

export function clampRangeToCap(
  range: { low: number; medium: number; high: number },
  cap: { low: number; medium: number; high: number }
): { low: number; medium: number; high: number } {
  const low = Math.min(range.low, cap.low);
  const medium = Math.min(range.medium, cap.medium);
  const high = Math.min(range.high, cap.high);
  const normalizedLow = Math.min(low, high);
  const normalizedHigh = Math.max(low, high);
  const normalizedMedium = Math.min(normalizedHigh, Math.max(normalizedLow, medium));
  return { low: normalizedLow, medium: normalizedMedium, high: normalizedHigh };
}

export function clampFallbackPricingForWeakReverb(
  fallback: Partial<SingleAiResult>,
  base: SingleAiResult,
  reverb: ReverbPricingContext
): Partial<SingleAiResult> {
  const normalized = normalizePrivatePartyPricing(fallback);
  if (!normalized) return fallback;
  if (!isNicheElectronicsListing(base)) return normalized;

  const baseFloorRange = (reverb.baseComps && reverb.baseComps.length)
    ? rangeFromReverbComps(reverb.baseComps, {
        ...base,
        model: normalizePricingModelText(base) || base.model,
        og_specs_pickups: '',
      })
    : null;

  let clamped = {
    low: normalizeMoneyValue(normalized.value_private_party_low) || 0,
    medium: normalizeMoneyValue(normalized.value_private_party_medium) || 0,
    high: normalizeMoneyValue(normalized.value_private_party_high) || 0,
  };

  if (baseFloorRange) {
    const cap = {
      low: Math.round(baseFloorRange.low * 1.02),
      medium: Math.round(baseFloorRange.medium * 1.06),
      high: Math.round(baseFloorRange.high * 1.12),
    };
    clamped = clampRangeToCap(clamped, cap);
  } else {
    clamped = {
      low: Math.round(clamped.low * 0.82),
      medium: Math.round(clamped.medium * 0.8),
      high: Math.round(clamped.high * 0.76),
    };
    clamped.high = Math.min(clamped.high, Math.round(Math.max(clamped.medium, clamped.low) * 1.12));
    clamped.medium = Math.min(clamped.medium, clamped.high);
    clamped.low = Math.min(clamped.low, clamped.medium);
  }

  return {
    ...normalized,
    value_private_party_low: clamped.low,
    value_private_party_medium: clamped.medium,
    value_private_party_high: clamped.high,
    value_private_party_low_notes: `${normalizeText(normalized.value_private_party_low_notes, '')} ${baseFloorRange ? 'Capped near base-model Reverb floor due unverified niche electronics feature.' : 'Reduced aggressively due unverified niche electronics feature and weak Reverb matches.'}`.trim(),
    value_private_party_medium_notes: `${normalizeText(normalized.value_private_party_medium_notes, '')} Conservative clamp applied for weak Reverb support on Roland/MIDI-style premium.`.trim(),
    value_private_party_high_notes: `${normalizeText(normalized.value_private_party_high_notes, '')} High-end premium capped without verified functionality.`.trim(),
  };
}

export function clearPrivatePartyPricingFields(base: SingleAiResult): SingleAiResult {
  return {
    ...base,
    value_private_party_low: null,
    value_private_party_low_notes: '',
    value_private_party_medium: null,
    value_private_party_medium_notes: '',
    value_private_party_high: null,
    value_private_party_high_notes: '',
    pricing_source: '',
    pricing_confidence: '',
    pricing_comp_count: null,
    pricing_notes: '',
  };
}

export function normalizePrivatePartyPricing(parsed: Partial<SingleAiResult>): Partial<SingleAiResult> | null {
  const low = normalizeMoneyValue(parsed.value_private_party_low);
  const medium = normalizeMoneyValue(parsed.value_private_party_medium);
  const high = normalizeMoneyValue(parsed.value_private_party_high);
  if (low == null && medium == null && high == null) return null;

  const fallback = low ?? medium ?? high;
  if (fallback == null) return null;

  const resolvedLow = low ?? medium ?? fallback;
  const resolvedHigh = high ?? medium ?? fallback;
  const rangeLow = Math.min(resolvedLow, resolvedHigh);
  const rangeHigh = Math.max(resolvedLow, resolvedHigh);
  const clampedMedium = Math.min(rangeHigh, Math.max(rangeLow, medium ?? Math.round((rangeLow + rangeHigh) / 2)));

  return {
    value_private_party_low: rangeLow,
    value_private_party_low_notes: normalizeText(parsed.value_private_party_low_notes, ''),
    value_private_party_medium: clampedMedium,
    value_private_party_medium_notes: normalizeText(parsed.value_private_party_medium_notes, ''),
    value_private_party_high: rangeHigh,
    value_private_party_high_notes: normalizeText(parsed.value_private_party_high_notes, ''),
    pricing_source: normalizeText(parsed.pricing_source, ''),
    pricing_confidence: normalizeText(parsed.pricing_confidence, ''),
    pricing_comp_count: normalizeMoneyValue(parsed.pricing_comp_count),
    pricing_notes: normalizeText(parsed.pricing_notes, ''),
  };
}

export async function fetchReverbPricingListings(query: string, env: Env): Promise<ReverbSearchListing[]> {
  const url = new URL(REVERB_SEARCH_API_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(REVERB_PRICING_SEARCH_LIMIT));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: reverbRequestHeaders(env),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Reverb pricing search failed', { query, status: response.status, body: body.slice(0, 500) });
    return [];
  }

  const data = await response.json() as { listings?: ReverbSearchListing[] };
  return Array.isArray(data.listings) ? data.listings : [];
}
