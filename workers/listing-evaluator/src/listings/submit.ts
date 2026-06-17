import type { Env } from '../env.js';
import { normalizeText, normalizeUrl } from '../utils/text.js';
import { jsonResponse, generateRunId } from '../utils/misc.js';
import type { SubmitPayload, QueueResult, RejectResult, ListingData, ListingSource, SingleAiResult } from '../types/core.js';
import { MAX_URLS, CUSTOM_MAX_TEXT_LENGTH } from '../constants.js';
import { dbFindListingByUrl, dbUpdateListing, dbCreateListing } from './db.js';
import { insertQueuedRow, updateRowByRunId } from './db2.js';
import { processApifyRunWhenReady, startApifyRun } from '../apify/handlers2.js';
import { runOpenAI, runOpenAIMultiRangePricing, getSinglePricingFromOpenAI } from '../ai/eval-stubs.js';
import { fetchReverbListingById } from '../pricing/reverb.js';
import {
  buildReverbPricingQueries,
  dedupeReverbComps,
  pickReverbComps,
  rangeFromReverbComps,
  summarizeReverbMatchesInline,
  summarizeReverbComps,
  normalizePricingModelText,
  clampFallbackPricingForWeakReverb,
  fetchReverbPricingListings,
} from '../pricing/reverb.js';
import type { ReverbPricingContext, ReverbSearchListing } from '../pricing/reverb.js';
import { decodeSerial } from '../serial/utils.js';
import { parseMoney } from '../utils/money.js';

export function detectSource(url: string): ListingSource | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('craigslist.org')) return 'craigslist';
    if (parsed.hostname.includes('facebook.com')) return 'facebook';
    if (parsed.hostname === 'reverb.com' || parsed.hostname.endsWith('.reverb.com')) return 'reverb';
    return null;
  } catch {
    return null;
  }
}

export function isSupportedListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes('facebook.com')) {
      return /\/marketplace\/item\/\d+/.test(path) || path.startsWith('/share/');
    }

    if (host.endsWith('craigslist.org')) {
      return path.includes('/d/') || path.startsWith('/msg/');
    }

    if (host === 'reverb.com' || host.endsWith('.reverb.com')) {
      return /^\/item\/\d+(?:[-/]|$)/.test(path);
    }

    return false;
  } catch {
    return false;
  }
}

function isFacebookShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('facebook.com')) return false;
    return parsed.pathname.startsWith('/share/');
  } catch {
    return false;
  }
}

function extractFacebookRedirectTarget(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('facebook.com')) return null;
    if (!parsed.pathname.startsWith('/l.php')) return null;
    const target = parsed.searchParams.get('u');
    if (!target) return null;
    return decodeURIComponent(target);
  } catch {
    return null;
  }
}

async function fetchFacebookShare(
  url: string,
  redirect: RequestRedirect
): Promise<Response> {
  return fetch(url, {
    redirect,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

async function resolveFromResponse(response: Response, fallbackUrl: string): Promise<string> {
  const resolvedUrl = response.url || fallbackUrl;
  const redirectTarget = extractFacebookRedirectTarget(resolvedUrl);
  if (redirectTarget) return redirectTarget;

  if (!isFacebookShareUrl(resolvedUrl)) {
    return resolvedUrl;
  }

  const html = await response.text();
  const ogUrlMatch = html.match(/property=\"og:url\" content=\"([^\"]+)\"/i);
  if (ogUrlMatch?.[1]) {
    return ogUrlMatch[1];
  }

  return resolvedUrl;
}

export async function resolveFacebookShareUrl(url: string): Promise<string> {
  if (!isFacebookShareUrl(url)) return url;

  try {
    const manualResponse = await fetchFacebookShare(url, 'manual');
    if (manualResponse.status >= 300 && manualResponse.status < 400) {
      const location = manualResponse.headers.get('Location');
      if (location) {
        const resolvedLocation = new URL(location, url).toString();
        const redirectTarget = extractFacebookRedirectTarget(resolvedLocation);
        if (redirectTarget) return redirectTarget;
        if (!isFacebookShareUrl(resolvedLocation)) {
          return resolvedLocation;
        }
      }
    }

    const response = await fetchFacebookShare(url, 'follow');
    const resolved = await resolveFromResponse(response, url);
    if (!resolved.includes('unsupportedbrowser')) {
      return resolved;
    }

    const mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
    const mobileResponse = await fetchFacebookShare(mobileUrl, 'follow');
    return await resolveFromResponse(mobileResponse, mobileUrl);
  } catch (error) {
    console.warn('Unable to resolve Facebook share URL', { url, error });
  }

  return url;
}

function normalizeFacebookItemUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('facebook.com')) return null;

    if (parsed.pathname.startsWith('/l.php')) {
      const target = parsed.searchParams.get('u');
      if (!target) return parsed.toString();
      const decoded = decodeURIComponent(target);
      return normalizeFacebookItemUrl(decoded) ?? decoded;
    }

    const itemMatch = parsed.pathname.match(/\/marketplace\/item\/(\d+)/);
    if (itemMatch?.[1]) {
      return `https://www.facebook.com/marketplace/item/${itemMatch[1]}/`;
    }

    if (parsed.pathname.startsWith('/share/')) {
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeQueuedListingUrl(url: string): string | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const source = detectSource(normalized);
  if (source === 'facebook') {
    return normalizeFacebookItemUrl(normalized);
  }
  if (source === 'reverb') {
    const listingId = extractReverbListingId(normalized);
    return listingId ? `https://reverb.com/item/${listingId}` : normalized;
  }
  return normalized;
}

function extractReverbListingId(url: string): string | null {
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

export function applyMultiRangeToSummary(aiSummary: string, low: number, high: number): string {
  const rangeText = formatRange(low, high);
  if (/Used market range for all:\s*[^\n]+/i.test(aiSummary)) {
    return aiSummary.replace(/Used market range for all:\s*[^\n]+/i, `Used market range for all: ${rangeText}`);
  }
  return `${aiSummary.trim()}\n\nTotals\n- Used market range for all: ${rangeText}`.trim();
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatRange(low: number, high: number): string {
  if (low === high) return formatCurrency(low);
  return `${formatCurrency(low)} - ${formatCurrency(high)}`;
}

export function cleanCustomTitleToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/\(NOT DEFINITIVE\)/gi, ' ')
    .replace(/\bEstimated\s+range:\s*/gi, '')
    .replace(/^Guess:\s*/i, '')
    .replace(/\bUnknown\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

export function buildCustomAiTitle(
  aiData: SingleAiResult | undefined,
  overrides?: { year?: string; brand?: string; model?: string; finish?: string }
): string {
  if (!aiData) return 'Custom Item';
  const parts = [
    cleanCustomTitleToken(overrides?.year || aiData.year),
    cleanCustomTitleToken(overrides?.brand || aiData.brand),
    cleanCustomTitleToken(overrides?.model || aiData.model),
    cleanCustomTitleToken(overrides?.finish || aiData.finish),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Custom Item';
}

export function normalizeCustomText(raw: unknown, maxLength = CUSTOM_MAX_TEXT_LENGTH): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
}

export function buildCustomListingTitle(input: { brand?: string; model?: string }): string {
  const parts = [input.brand, input.model].map((value) => normalizeCustomText(value, 180)).filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ').slice(0, 120);
  }
  return 'Custom Item';
}

export function buildCustomListingDescription(input: {
  brand?: string;
  model?: string;
  condition?: string;
  notes?: string;
}): string {
  const lines = ['Custom in-person item for evaluation.'];
  const brand = normalizeCustomText(input.brand, 180);
  const model = normalizeCustomText(input.model, 180);
  const condition = normalizeCustomText(input.condition, 180);
  const notes = normalizeCustomText(input.notes);

  if (brand) lines.push(`Brand: ${brand}`);
  if (model) lines.push(`Model: ${model}`);
  if (condition) lines.push(`Observed condition: ${condition}`);
  if (notes) lines.push(`Notes: ${notes}`);

  return lines.join('\n');
}

function photoListFromRecord(fields: Record<string, unknown>): string[] {
  const photos = typeof fields.photos === 'string'
    ? fields.photos.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const imageUrl = typeof fields.image_url === 'string' ? fields.image_url.trim() : '';
  if (imageUrl) photos.push(imageUrl);
  return Array.from(new Set(photos));
}

export function buildCustomListingFromRecordFields(fields: Record<string, unknown>): ListingData | null {
  const photos = photoListFromRecord(fields);
  if (photos.length === 0) return null;

  const priceValue = fields.price_asking;
  const price = typeof priceValue === 'number'
    ? String(priceValue)
    : normalizeCustomText(priceValue, 120);

  return {
    title: normalizeCustomText(fields.title, 120) || 'Custom Item',
    price,
    location: normalizeCustomText(fields.location, 180),
    condition: normalizeCustomText(fields.condition, 180),
    description: normalizeCustomText(fields.description),
    images: photos,
    notes: normalizeCustomText(fields.notes),
    brandHint: normalizeCustomText(fields.brand, 180),
    modelHint: normalizeCustomText(fields.model, 180),
  };
}

export function toAbsoluteImageUrl(url: string, baseUrl: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

export async function queueAndProcessReverbListing(
  url: string,
  isMulti: boolean,
  env: Env,
): Promise<{ runId: string; recordId: string; listing: ListingData }> {
  const listingId = extractReverbListingId(url);
  if (!listingId) {
    throw new Error('Unsupported Reverb URL. Use a direct Reverb item URL.');
  }

  const listing = await fetchReverbListingById(listingId, env);
  if (!listing) {
    throw new Error('Unable to load Reverb listing from API.');
  }

  const runId = generateRunId();
  const recordId = await insertQueuedRow(url, 'reverb', runId, isMulti, env);
  if (!recordId) {
    throw new Error('Unable to queue Reverb listing.');
  }

  return { runId, recordId, listing };
}

function isArchivedValueLocal(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

export async function handleSubmit(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let payload: SubmitPayload;
  try {
    payload = (await request.json()) as SubmitPayload;
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const rawUrls = Array.isArray(payload.urls) ? payload.urls : [];
  if (rawUrls.length === 0) {
    return jsonResponse({ message: 'No URLs provided.' }, 400);
  }

  const normalizedItems = rawUrls.map((entry) => {
    if (typeof entry === 'string') return { url: entry, isMulti: false };
    if (entry && typeof entry.url === 'string') {
      return { url: entry.url, isMulti: Boolean(entry.isMulti) };
    }
    return null;
  }).filter(Boolean) as Array<{ url: string; isMulti: boolean }>;

  const urls = normalizedItems
    .map((item) => ({ ...item, url: normalizeUrl(item.url) }))
    .filter((item) => item.url) as Array<{ url: string; isMulti: boolean }>;

  const seen = new Set<string>();
  const uniqueUrls = urls.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, MAX_URLS);

  const accepted: QueueResult[] = [];
  const rejected: RejectResult[] = [];

  for (const item of uniqueUrls) {
    const resolvedUrl = await resolveFacebookShareUrl(item.url);
    const normalizedResolvedUrl = normalizeQueuedListingUrl(resolvedUrl);
    if (!normalizedResolvedUrl || !isSupportedListingUrl(normalizedResolvedUrl)) {
      rejected.push({ url: item.url, reason: 'Unsupported URL. Use a Facebook Marketplace item URL, Craigslist listing URL, or single Reverb item URL.' });
      continue;
    }

    const source = detectSource(normalizedResolvedUrl);
    if (!source) {
      rejected.push({ url: item.url, reason: 'Unsupported URL. Use Craigslist, Facebook Marketplace, or Reverb.' });
      continue;
    }

    if (source === 'reverb' && item.isMulti) {
      rejected.push({ url: item.url, reason: 'Reverb URLs are supported only in single-item mode.' });
      continue;
    }

    accepted.push({ url: normalizedResolvedUrl, source, isMulti: item.isMulti });
  }

  const results: QueueResult[] = [];

  for (const item of accepted) {
    const existing = await dbFindListingByUrl(item.url, env);
    if (existing) {
      const archived = isArchivedValue(existing.fields?.archived);
      const saved = isArchivedValue(existing.fields?.saved);
      const existingStatus = normalizeText(existing.fields?.status, '').toLowerCase();

      if (archived || saved) {
        await dbUpdateListing(existing.id, { archived: false, archive_reason: null, saved: false }, env);
      }

      if (!archived && !saved && item.source !== 'reverb' && (existingStatus === 'queued' || existingStatus === 'failed')) {
        const runId = await startApifyRun(item.url, item.source as ListingSource, env, existing.id);
        if (runId) {
          await env.LISTING_JOBS.put(runId, existing.id);
          await dbUpdateListing(existing.id, { status: 'queued' }, env);
          ctx.waitUntil(processApifyRunWhenReady(runId, env, existing.id));
          results.push({
            ...item,
            runId,
            recordId: existing.id,
            existing: true,
            requeued: true,
          });
          continue;
        }
      }

      results.push({
        ...item,
        recordId: existing.id,
        existing: true,
        unarchived: archived,
        unsaved: saved,
      });
      continue;
    }

    if (item.source === 'reverb') {
      try {
        const { runId, recordId, listing } = await queueAndProcessReverbListing(item.url, item.isMulti ?? false, env);
        ctx.waitUntil((async () => {
          try {
            await processDirectListing(recordId, runId, listing, env, { isMulti: item.isMulti });
          } catch (error) {
            console.error('Reverb queued processing failed', { url: item.url, recordId, error });
          }
        })());
        results.push({ ...item, runId, recordId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load Reverb listing from API.';
        rejected.push({ url: item.url, reason: message });
      }
      continue;
    }

    const recordId = await insertQueuedRow(item.url, item.source as ListingSource, null, item.isMulti ?? false, env);
    if (!recordId) {
      rejected.push({ url: item.url, reason: 'Unable to queue listing.' });
      continue;
    }

    const runId = await startApifyRun(item.url, item.source as ListingSource, env, recordId);
    if (!runId) {
      await dbUpdateListing(recordId, { status: 'failed', ai_summary: 'Unable to start scraper run.' }, env);
      rejected.push({ url: item.url, reason: 'Unable to start scraper run.' });
      continue;
    }

    await env.LISTING_JOBS.put(runId, recordId);
    ctx.waitUntil(processApifyRunWhenReady(runId, env, recordId));
    results.push({ ...item, runId, recordId: recordId || undefined });
  }

  return jsonResponse({
    accepted: results.length,
    queued: results,
    rejected,
  });
}

export function isArchivedValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
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

export async function getRealisticPrivatePartyPricing(base: SingleAiResult, env: Env): Promise<Partial<SingleAiResult> | null> {
  try {
    const queries = buildReverbPricingQueries(base);
    const rawByQuery = await Promise.all(queries.map((entry) => fetchReverbPricingListings(entry.query, env)));
    const comps = dedupeReverbComps(rawByQuery.flatMap((raw) => pickReverbComps(raw, base, 1)));
    const baseFloorEntry = queries.find((entry) => entry.label === 'base-floor') ?? queries[0];
    const baseRaw = baseFloorEntry ? await fetchReverbPricingListings(baseFloorEntry.query, env) : [];
    const baseComps = dedupeReverbComps(pickReverbComps(baseRaw, {
      ...base,
      model: normalizePricingModelText(base) || base.model,
      og_specs_pickups: '',
    }, 0));
    const reverbContext: ReverbPricingContext = { comps, baseComps };
    const range = rangeFromReverbComps(comps, base);

    if (range) {
      const notes = [
        range.notes,
        summarizeReverbMatchesInline(comps),
      ].filter(Boolean).join(' ');
      return {
        value_private_party_low: range.low,
        value_private_party_low_notes: notes,
        value_private_party_medium: range.medium,
        value_private_party_medium_notes: notes,
        value_private_party_high: range.high,
        value_private_party_high_notes: notes,
        pricing_source: 'Reverb active listings',
        pricing_confidence: range.confidence,
        pricing_comp_count: comps.length,
        pricing_notes: summarizeReverbComps(comps),
      };
    }

    const aiFallback = await getSinglePricingFromOpenAI(base, env);
    if (!aiFallback) return null;
    return clampFallbackPricingForWeakReverb(aiFallback, base, reverbContext);
  } catch (error) {
    console.error('Private-party pricing failed', { error });
    return null;
  }
}

export function ensureMultiTotals(aiSummary: string): string {
  if (!aiSummary || /(^|\n)Totals\s*:?\s*$/im.test(aiSummary)) return aiSummary;

  const recapIndex = aiSummary.search(/(^|\n)Itemized recap\s*:?\s*$/im);
  if (recapIndex === -1) {
    const fallbackTotals = [
      '',
      'Totals',
      '- Total listing asking price: Unknown',
      '- Used market range for all: Unknown',
      '- Ideal price for all: Unknown',
      '',
    ].join('\n');
    return `${aiSummary.trim()}\n${fallbackTotals}`.trim();
  }

  const lines = aiSummary.slice(recapIndex).split(/\r?\n/);
  const itemLinePattern = /-\s+.+?\s+-\s+\$?([\d,]+)\s+asking,\s+used range\s+\$?([\d,]+)\s+to\s+\$?([\d,]+),\s+\$?([\d,]+)\s+ideal/i;

  let askingTotal = 0;
  let usedLowTotal = 0;
  let usedHighTotal = 0;
  let idealTotal = 0;
  let found = 0;

  for (const line of lines) {
    if (/^Totals\s*:?\s*$/i.test(line.trim())) break;
    const match = line.match(itemLinePattern);
    if (!match) continue;
    const asking = parseMoney(match[1]);
    const usedLow = parseMoney(match[2]);
    const usedHigh = parseMoney(match[3]);
    const ideal = parseMoney(match[4]);
    if (asking == null || usedLow == null || usedHigh == null || ideal == null) continue;
    askingTotal += asking;
    usedLowTotal += usedLow;
    usedHighTotal += usedHigh;
    idealTotal += ideal;
    found += 1;
  }

  if (found === 0) {
    const fallbackTotals = [
      '',
      'Totals',
      '- Total listing asking price: Unknown',
      '- Used market range for all: Unknown',
      '- Ideal price for all: Unknown',
      '',
    ].join('\n');
    return `${aiSummary.trim()}\n${fallbackTotals}`.trim();
  }

  const totalsSection = [
    '',
    'Totals',
    `- Total listing asking price: ${formatCurrency(askingTotal)}`,
    `- Used market range for all: ${formatCurrency(usedLowTotal)} to ${formatCurrency(usedHighTotal)}`,
    `- Ideal price for all: ${formatCurrency(idealTotal)}`,
    '',
  ].join('\n');

  return `${aiSummary.trim()}\n${totalsSection}`.trim();
}
