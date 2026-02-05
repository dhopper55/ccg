import { decodeGibson } from '../../../src/decoders/gibson.js';
import { decodeEpiphone } from '../../../src/decoders/epiphone.js';
import { decodeFender } from '../../../src/decoders/fender.js';
import { decodeTaylor } from '../../../src/decoders/taylor.js';
import { decodeMartin } from '../../../src/decoders/martin.js';
import { decodeIbanez } from '../../../src/decoders/ibanez.js';
import { decodeYamaha } from '../../../src/decoders/yamaha.js';
import { decodePRS } from '../../../src/decoders/prs.js';
import { decodeESP } from '../../../src/decoders/esp.js';
import { decodeSchecter } from '../../../src/decoders/schecter.js';
import { decodeGretsch } from '../../../src/decoders/gretsch.js';
import { decodeJackson } from '../../../src/decoders/jackson.js';
import { decodeSquier } from '../../../src/decoders/squier.js';
import { decodeCort } from '../../../src/decoders/cort.js';
import { decodeTakamine } from '../../../src/decoders/takamine.js';
import { decodeWashburn } from '../../../src/decoders/washburn.js';
import { decodeDean } from '../../../src/decoders/dean.js';
import { decodeErnieBall } from '../../../src/decoders/ernieball.js';
import { decodeGuild } from '../../../src/decoders/guild.js';
import { decodeAlvarez } from '../../../src/decoders/alvarez.js';
import { decodeGodin } from '../../../src/decoders/godin.js';
import { decodeOvation } from '../../../src/decoders/ovation.js';
import { decodeCharvel } from '../../../src/decoders/charvel.js';
import { decodeRickenbacker } from '../../../src/decoders/rickenbacker.js';
import { decodeKramer } from '../../../src/decoders/kramer.js';

interface Env {
  OPENAI_API_KEY: string;
  APIFY_TOKEN: string;
  APIFY_FACEBOOK_ACTOR: string;
  APIFY_CRAIGSLIST_ACTOR: string;
  SITE_BASE_URL: string;
  MAX_IMAGES: string;
  WEBHOOK_SECRET?: string;
  AIRTABLE_API_KEY: string;
  AIRTABLE_BASE_ID: string;
  AIRTABLE_TABLE: string;
  AIRTABLE_SEARCH_TABLE: string;
  AIRTABLE_SYSINFO_TABLE?: string;
  RADAR_FB_SEARCH_URL?: string;
  RADAR_CL_SEARCH_URL?: string;
  RADAR_KEYWORDS?: string;
  TELNYX_API_KEY?: string;
  TELNYX_FROM_NUMBER?: string;
  TELNYX_TO_NUMBER?: string;
  RADAR_AI_ENABLED?: string;
  LISTING_JOBS: KVNamespace;
}

interface SubmitPayload {
  urls: Array<string | { url: string; isMulti?: boolean }>;
}

interface QueueResult {
  url: string;
  source?: string;
  runId?: string;
  row?: number;
  unarchived?: boolean;
  isMulti?: boolean;
}

interface RejectResult {
  url: string;
  reason: string;
}

const MAX_URLS = 20;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const RADAR_NEXT_RUN_KEY = 'radar_next_run_at';
const RADAR_LAST_RUN_KEY = 'radar_last_run_at';
const RADAR_LAST_SUMMARY_KEY = 'radar_last_summary';
const RADAR_MIN_JITTER_MINUTES = 25;
const RADAR_MAX_JITTER_MINUTES = 35;
const RADAR_CONSECUTIVE_SEEN_LIMIT = 5;
const RADAR_MAX_NEW_PER_SOURCE = 5;
const RADAR_CL_TIMEBOX_MS = 60000;
const RADAR_MAX_AI_CHECKS_PER_RUN = 0;
const RADAR_CLASSIFY_BATCH = 3;
const SYSINFO_TABLE_DEFAULT = 'SysInfo';
const MST_OFFSET_MINUTES = -7 * 60;
const RADAR_QUIET_START_HOUR = 23;
const RADAR_QUIET_END_HOUR = 6;
const RADAR_DEFAULT_PAGE = '/listing-radar.html';

const SUPPORTED_ORIGINS = [
  'https://www.coalcreekguitars.com',
  'http://localhost:3000',
  'http://localhost:8080',
];

const CATEGORY_OPTIONS = [
  'Accessories',
  'Acoustic Guitars',
  'Amps',
  'Band and Orchestra',
  'Bass Guitars',
  'DJ and Lighting Gear',
  'Drums and Percussion',
  'Effects and Pedals',
  'Electric Guitars',
  'Folk Instruments',
  'Home Audio',
  'Keyboards and Synths',
  'Parts',
  'Pro Audio',
  'Other',
];

const CONDITION_OPTIONS = [
  'Mint',
  'Excellent',
  'Very Good',
  'Good',
  'Fair',
  'Poor',
  'Non Functioning',
];

const SINGLE_FIELD_KEYS = [
  'category',
  'brand',
  'model',
  'finish',
  'year',
  'serial',
  'serial_brand',
  'serial_year',
  'serial_model',
  'value_private_party_low',
  'value_private_party_low_notes',
  'value_private_party_medium',
  'value_private_party_medium_notes',
  'value_private_party_high',
  'value_private_party_high_notes',
  'value_pawn_shop_notes',
  'value_online_notes',
  'known_weak_points',
  'typical_repair_needs',
  'buyers_worry',
  'og_specs_pickups',
  'og_specs_tuners',
  'og_specs_common_mods',
  'buyer_what_to_check',
  'buyer_common_misrepresent',
  'seller_how_to_price_realistic',
  'seller_fixes_add_value_or_waste',
  'seller_as_is_notes',
];

const DEFAULT_TEXT = {
  known_weak_points: 'Potential issues with electronics or hardware over time.',
  typical_repair_needs: 'Possible need for setup adjustments or electronics cleaning.',
  buyers_worry: 'Check for neck straightness and electronics functionality.',
  og_specs_common_mods: 'Common mods vary; verify originality and parts.',
  buyer_what_to_check: 'Inspect electronics, neck relief, fret wear, and hardware function.',
  buyer_common_misrepresent: 'Watch for misrepresented year, model, or replaced parts.',
  seller_how_to_price_realistic: 'Price realistically by comparing recent sales in similar condition.',
  seller_fixes_add_value_or_waste: 'Minor setup and cleaning can help; major repairs may not pay off.',
  seller_as_is_notes: 'Sell as-is if repair costs exceed value gains.',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/api/listings/submit' && request.method === 'POST') {
      const response = await handleSubmit(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/webhook' && request.method === 'POST') {
      const response = await handleWebhook(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings' && request.method === 'GET') {
      const response = await handleList(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/archive') && path.startsWith('/api/listings/') && request.method === 'POST') {
      const response = await handleArchiveListing(env, path);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/listings/') && path.endsWith('/debug') && request.method === 'GET') {
      const response = await handleGetListingDebug(request, env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/reprocess' && request.method === 'POST') {
      const response = await handleReprocessListing(request, env);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/listings/') && request.method === 'GET') {
      const response = await handleGetListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/search-results' && request.method === 'GET') {
      const response = await handleSearchResults(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/archive') && path.startsWith('/api/search-results/') && request.method === 'POST') {
      const response = await handleArchiveSearchResult(env, path);
      return withCors(response, request, env);
    }

    if (path.endsWith('/queue') && path.startsWith('/api/search-results/') && request.method === 'POST') {
      const response = await handleQueueSearchResult(env, path, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/radar/run' && request.method === 'POST') {
      const response = await handleRadarRun(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/radar/classify' && request.method === 'POST') {
      const response = await handleRadarClassify(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/radar/sms-test' && request.method === 'POST') {
      const response = await handleRadarSmsTest(request, env);
      return withCors(response, request, env);
    }

    return withCors(new Response('Not found', { status: 404 }), request, env);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runRadarIfDue(env));
  },
};

function withCors(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);

  if (origin && (SUPPORTED_ORIGINS.includes(origin) || origin === env.SITE_BASE_URL)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    headers.set('Access-Control-Allow-Origin', env.SITE_BASE_URL || SUPPORTED_ORIGINS[0]);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleSubmit(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
    const source = detectSource(resolvedUrl);
    if (!source) {
      rejected.push({ url: item.url, reason: 'Unsupported URL. Use Craigslist or Facebook Marketplace.' });
      continue;
    }

    accepted.push({ url: resolvedUrl, source, isMulti: item.isMulti });
  }

  const results: QueueResult[] = [];

  for (const item of accepted) {
    const existing = await airtableFindByUrl(item.url, env);
    if (existing) {
      const archived = isArchivedValue(existing.fields?.archived);
      if (archived) {
        const restored = await airtableSetArchivedState(existing.id, false, env);
        if (restored) {
          results.push({ ...item, unarchived: true });
          continue;
        }
      }
      rejected.push({ url: item.url, reason: 'Already queued.' });
      continue;
    }

    const runId = await startApifyRun(item.url, item.source as ListingSource, env);
    if (!runId) {
      rejected.push({ url: item.url, reason: 'Unable to start scraper run.' });
      continue;
    }

    await insertQueuedRow(item.url, item.source as ListingSource, runId, item.isMulti ?? false, env);

    results.push({ ...item, runId });
  }

  return jsonResponse({
    accepted: results.length,
    queued: results,
    rejected,
  });
}

async function runRadarIfDue(env: Env): Promise<void> {
  const now = Date.now();
  const nextRunAtRaw = await env.LISTING_JOBS.get(RADAR_NEXT_RUN_KEY);
  const nextRunAt = nextRunAtRaw ? Number.parseInt(nextRunAtRaw, 10) : null;

  if (nextRunAt && Number.isFinite(nextRunAt) && now < nextRunAt) {
    return;
  }

  if (isQuietHours(new Date(now))) {
    const nextAllowed = nextAllowedRadarTime(new Date(now));
    await env.LISTING_JOBS.put(RADAR_NEXT_RUN_KEY, String(nextAllowed.getTime()));
    return;
  }

  let summary = 'Radar run skipped.';
  try {
    const workerEnabled = await isWorkerEnabled(env);
    if (workerEnabled === false) {
      summary = 'Radar run skipped (disabled).';
      return;
    }
    if (workerEnabled === null) {
      console.warn('SysInfo check failed; proceeding with radar run.');
    }
    const result = await runRadarScan(env);
    summary = result.summary;
  } catch (error) {
    console.error('Radar run failed', { error });
    summary = 'Radar run failed.';
  } finally {
    const nextRunAtValue = now + randomJitterMinutes(RADAR_MIN_JITTER_MINUTES, RADAR_MAX_JITTER_MINUTES) * 60 * 1000;
    await env.LISTING_JOBS.put(RADAR_NEXT_RUN_KEY, String(nextRunAtValue));
    await env.LISTING_JOBS.put(RADAR_LAST_RUN_KEY, String(now));
    await env.LISTING_JOBS.put(RADAR_LAST_SUMMARY_KEY, summary);
  }
}

async function isWorkerEnabled(env: Env): Promise<boolean | null> {
  const table = env.AIRTABLE_SYSINFO_TABLE || SYSINFO_TABLE_DEFAULT;
  const params = new URLSearchParams();
  params.set('pageSize', '1');
  params.append('fields[]', 'WorkerEnabled');

  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable sysinfo list failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  const record = Array.isArray(data?.records) ? data.records[0] : null;
  if (!record) return null;
  return record.fields?.WorkerEnabled === true;
}

type RadarResult = {
  matched: number;
  saved: number;
  smsSent: number;
  summary: string;
};

async function runRadarScan(env: Env, sourceOverride?: ListingSource): Promise<RadarResult> {
  const keywords = parseRadarKeywords(env.RADAR_KEYWORDS);
  const fbUrl = env.RADAR_FB_SEARCH_URL;
  const clUrl = env.RADAR_CL_SEARCH_URL;
  if (!fbUrl || !clUrl) {
    console.warn('Radar search URLs missing.');
    return { matched: 0, saved: 0, smsSent: 0, summary: 'Radar search URLs missing.' };
  }

  const runId = generateRunId();
  const runStartedAt = new Date().toISOString();
  const scored: ScoredListing[] = [];
  const newBySource: Record<ListingSource, number> = { facebook: 0, craigslist: 0 };
  const aiEnabled = env.RADAR_AI_ENABLED !== 'false';
  const aiBudget = { remaining: aiEnabled ? RADAR_MAX_AI_CHECKS_PER_RUN : 0 };

  for (const keyword of keywords) {
    if (!sourceOverride || sourceOverride === 'craigslist') {
      const clInput = buildCraigslistSearchInput(clUrl, keyword);
      const clStats = await runCraigslistWithAbort(clInput, keyword, runId, runStartedAt, newBySource, scored, env, aiBudget);
      console.info('Radar CL stats', { keyword, ...clStats });
    }

    if (!sourceOverride || sourceOverride === 'facebook') {
      const fbInput = buildFacebookSearchInput(fbUrl, keyword);
      const fbRun = await runApifySearch(env.APIFY_FACEBOOK_ACTOR, fbInput, env);
      const fbStats = await processSourceResults('facebook', fbRun.items, keyword, runId, runStartedAt, newBySource, scored, env, fbRun.runId, aiBudget);
      console.info('Radar FB stats', { keyword, ...fbStats });
    }
  }

  const guitarListings = scored.filter((listing) => listing.isGuitar);
  const smsSent = await sendRadarSms(runId, guitarListings.length, env);
  const summary = `Radar run ${runId}: ${scored.length} new, ${guitarListings.length} guitars, ${smsSent} SMS.`;

  return {
    matched: scored.length,
    saved: scored.length,
    smsSent,
    summary,
  };
}

type ListingCandidate = {
  source: ListingSource;
  keyword: string;
  title: string;
  price: string;
  location: string;
  images: string[];
  url?: string;
  isSponsored?: boolean;
};

type ScoredListing = ListingCandidate & {
  isGuitar: boolean;
  reason: string;
};

function parseRadarKeywords(raw?: string): string[] {
  if (!raw) return ['guitar'];
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['guitar'];
}

function buildFacebookSearchInput(baseUrl: string, keyword: string): Record<string, unknown> {
  const withQuery = replaceQueryParam(baseUrl, 'query', keyword);
  const withSort = replaceQueryParam(withQuery, 'sortBy', 'creation_time_descend');
  return {
    includeListingDetails: true,
    resultsLimit: 15,
    startUrls: [{ url: withSort }],
  };
}

function buildCraigslistSearchInput(baseUrl: string, keyword: string): Record<string, unknown> {
  const withQuery = replaceQueryParam(baseUrl, 'query', keyword);
  const withSort = replaceQueryParam(withQuery, 'sort', 'date');
  return {
    maxAge: 15,
    maxConcurrency: 4,
    proxyConfiguration: {
      useApifyProxy: true,
    },
    urls: [{ url: withSort }],
  };
}

function replaceQueryParam(rawUrl: string, key: string, value: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

type ApifyRunResult = {
  runId?: string;
  items: any[];
};

async function startApifySearchRun(actorId: string, input: Record<string, unknown>, env: Env): Promise<string | null> {
  const actorPath = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
  const response = await fetch(`https://api.apify.com/v2/acts/${actorPath}/runs?token=${env.APIFY_TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apify search run start failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  const run = data?.data || data;
  return run?.id || null;
}

async function runApifySearch(actorId: string, input: Record<string, unknown>, env: Env): Promise<ApifyRunResult> {
  const actorPath = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
  const response = await fetch(`https://api.apify.com/v2/acts/${actorPath}/runs?token=${env.APIFY_TOKEN}&waitForFinish=120`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apify search run start failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return { items: [] };
  }

  const data = await response.json();
  const run = data?.data || data;
  if (!run?.id) return { items: [] };
  if (run?.status && run.status !== 'SUCCEEDED') {
    const completed = await waitForApifyRun(run.id, env, 3);
    if (completed?.status && completed.status !== 'SUCCEEDED') {
      console.warn('Apify search run not complete', { runId: run.id, status: completed.status });
    }
  }

  const runDetails = await fetchApifyRun(run.id, env);
  const datasetId = runDetails?.defaultDatasetId || run?.defaultDatasetId;
  if (!datasetId) return { runId: run.id, items: [] };
  const items = await fetchApifyDataset(datasetId, env);
  return { runId: run.id, items };
}

function normalizeSearchItems(items: any[], source: ListingSource, keyword: string): ListingCandidate[] {
  return items.map((item) => {
    const normalized = normalizeListing(item);
    let url = normalized.url;
    if (!url && source === 'facebook') {
      const id = pickString(
        item.id,
        item.listingId,
        item.listing_id,
        item.marketplace_listing_id,
        item.marketplaceListingId,
        item.listing?.id
      );
      if (id) {
        url = `https://www.facebook.com/marketplace/item/${id}/`;
      }
    }
    return {
      source,
      keyword,
      title: normalized.title,
      price: normalized.price,
      location: normalized.location,
      images: normalized.images,
      url,
      isSponsored: isSponsoredListing(item),
    };
  }).filter((item) => item.url || item.title);
}

function dedupeCandidates(listings: ListingCandidate[]): ListingCandidate[] {
  const seen = new Set<string>();
  const result: ListingCandidate[] = [];
  for (const listing of listings) {
    const key = listing.url || `${listing.source}:${listing.title}:${listing.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(listing);
  }
  return result;
}

async function processSourceResults(
  source: ListingSource,
  items: any[],
  keyword: string,
  runId: string,
  runStartedAt: string,
  newBySource: Record<ListingSource, number>,
  scored: ScoredListing[],
  env: Env,
  apifyRunId?: string,
  aiBudget?: { remaining: number }
): Promise<{ total: number; created: number; skippedSponsored: number; skippedNoUrl: number; skippedExisting: number; skippedAiLimit: number }> {
  return await processCandidatesWithState(source, items, keyword, runId, runStartedAt, newBySource, scored, env, {
    consecutiveSeen: 0,
    processedUrls: new Set<string>(),
  }, apifyRunId, aiBudget);
}

type RadarProcessState = {
  consecutiveSeen: number;
  processedUrls: Set<string>;
};

async function processCandidatesWithState(
  source: ListingSource,
  items: any[],
  keyword: string,
  runId: string,
  runStartedAt: string,
  newBySource: Record<ListingSource, number>,
  scored: ScoredListing[],
  env: Env,
  state: RadarProcessState,
  apifyRunId?: string,
  aiBudget?: { remaining: number }
): Promise<{ total: number; created: number; skippedSponsored: number; skippedNoUrl: number; skippedExisting: number; skippedAiLimit: number }> {
  const candidates = dedupeCandidates(normalizeSearchItems(items, source, keyword));
  let createdCount = 0;
  let skippedSponsored = 0;
  let skippedNoUrl = 0;
  let skippedExisting = 0;
  let skippedAiLimit = 0;
  const pendingCreates: Record<string, unknown>[] = [];

  for (const candidate of candidates) {
    if (newBySource[source] >= RADAR_MAX_NEW_PER_SOURCE) {
      if (apifyRunId) {
        await abortApifyRun(apifyRunId, env);
      }
      break;
    }
    if (candidate.isSponsored) {
      skippedSponsored += 1;
      continue;
    }
    if (!candidate.url) {
      skippedNoUrl += 1;
      continue;
    }
    if (state.processedUrls.has(candidate.url)) {
      continue;
    }
    state.processedUrls.add(candidate.url);

    const existing = await airtableSearchFindByUrl(candidate.url, env);
    if (existing) {
      skippedExisting += 1;
      state.consecutiveSeen += 1;
      if (state.consecutiveSeen >= RADAR_CONSECUTIVE_SEEN_LIMIT) {
        if (apifyRunId) {
          await abortApifyRun(apifyRunId, env);
        }
        break;
      }
      continue;
    }

    state.consecutiveSeen = 0;

    let isGuitarResult: { isGuitar: boolean; reason: string } | null = null;
    if (!aiBudget || aiBudget.remaining > 0) {
      if (aiBudget) aiBudget.remaining -= 1;
      isGuitarResult = await runIsGuitar(candidate, env);
    } else {
      skippedAiLimit += 1;
    }

    pendingCreates.push(buildSearchFields(candidate, isGuitarResult, runId, runStartedAt));
    newBySource[source] += 1;
    createdCount += 1;

    if (pendingCreates.length >= 10) {
      await airtableSearchCreateBatch(pendingCreates.splice(0, pendingCreates.length), env);
    }

    if (isGuitarResult) {
      scored.push({ ...candidate, isGuitar: isGuitarResult.isGuitar, reason: isGuitarResult.reason });
    }
  }

  if (pendingCreates.length > 0) {
    await airtableSearchCreateBatch(pendingCreates.splice(0, pendingCreates.length), env);
  }
  return {
    total: candidates.length,
    created: createdCount,
    skippedSponsored,
    skippedNoUrl,
    skippedExisting,
    skippedAiLimit,
  };
}

async function runCraigslistWithAbort(
  input: Record<string, unknown>,
  keyword: string,
  runId: string,
  runStartedAt: string,
  newBySource: Record<ListingSource, number>,
  scored: ScoredListing[],
  env: Env,
  aiBudget?: { remaining: number }
): Promise<{ total: number; created: number; skippedSponsored: number; skippedNoUrl: number; skippedExisting: number; skippedAiLimit: number }> {
  const runIdValue = await startApifySearchRun(env.APIFY_CRAIGSLIST_ACTOR, input, env);
  if (!runIdValue) {
    return { total: 0, created: 0, skippedSponsored: 0, skippedNoUrl: 0, skippedExisting: 0, skippedAiLimit: 0 };
  }

  await delay(RADAR_CL_TIMEBOX_MS);

  const runDetails = await fetchApifyRun(runIdValue, env);
  const datasetId = runDetails?.defaultDatasetId || null;
  let stats = { total: 0, created: 0, skippedSponsored: 0, skippedNoUrl: 0, skippedExisting: 0, skippedAiLimit: 0 };
  if (datasetId) {
    const items = await fetchApifyDataset(datasetId, env);
    stats = await processCandidatesWithState(
      'craigslist',
      items,
      keyword,
      runId,
      runStartedAt,
      newBySource,
      scored,
      env,
      { consecutiveSeen: 0, processedUrls: new Set<string>() },
      runIdValue,
      aiBudget
    );
  }

  await abortApifyRun(runIdValue, env);
  return stats;
}

async function runIsGuitar(listing: ListingCandidate, env: Env): Promise<{ isGuitar: boolean; reason: string } | null> {
  if (!env.OPENAI_API_KEY) {
    console.warn('OpenAI key missing; skipping guitar check.');
    return null;
  }

  const imageUrl = listing.images[0];
  const prompt = `You are classifying listings. Determine if the listing is a single guitar (including electric, acoustic, bass, classical). If it is only accessories (strap, case, strings, stand) or parts, answer NO. Output EXACTLY:\nGuitar: YES or NO\nReason: <short reason>`;

  const content: any[] = [
    {
      type: 'input_text',
      text: `Title: ${listing.title || 'Unknown'}\nPrice: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\nKeyword: ${listing.keyword}`,
    },
  ];
  if (imageUrl) {
    content.push({ type: 'input_image', image_url: imageUrl });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: prompt }],
        },
        {
          role: 'user',
          content,
        },
      ],
      temperature: 0.2,
      max_output_tokens: 120,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI guitar check failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  const text = extractOpenAIText(data);
  return parseIsGuitar(text);
}

function parseIsGuitar(text: string): { isGuitar: boolean; reason: string } | null {
  if (!text) return null;
  const guitarMatch = text.match(/Guitar:\s*(YES|NO)/i);
  let verdict = guitarMatch?.[1]?.toUpperCase();
  if (!verdict) {
    const yesNoMatch = text.match(/\b(YES|NO)\b/i);
    verdict = yesNoMatch?.[1]?.toUpperCase();
  }
  if (!verdict) return null;
  const reasonMatch = text.match(/Reason:\s*(.+)/i);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided.';
  return {
    isGuitar: verdict === 'YES',
    reason,
  };
}

function buildSearchFields(
  listing: ListingCandidate,
  isGuitarResult: { isGuitar: boolean; reason: string } | null,
  runId: string,
  runStartedAt: string
): Record<string, unknown> {
  const priceValue = listing.price ? parseMoney(listing.price) : null;
  const guitarValue = isGuitarResult ? (isGuitarResult.isGuitar ? 'Yes' : 'No') : 'Unsure';
  return {
    run_id: runId,
    run_started_at: runStartedAt,
    source: formatSourceLabel(listing.source),
    keyword: listing.keyword,
    url: listing.url ?? null,
    title: listing.title ?? null,
    price: priceValue ?? null,
    image_url: listing.images[0] ?? null,
    is_guitar: guitarValue,
    ai_reason: isGuitarResult ? isGuitarResult.reason : null,
    is_sponsored: listing.isSponsored ?? false,
    archived: false,
    seen_at: new Date().toISOString(),
    ai_checked_at: isGuitarResult ? new Date().toISOString() : null,
  };
}

async function sendRadarSms(runId: string, guitarCount: number, env: Env): Promise<number> {
  if (guitarCount <= 0) return 0;
  if (!env.TELNYX_API_KEY || !env.TELNYX_FROM_NUMBER || !env.TELNYX_TO_NUMBER) {
    console.info('Telnyx credentials missing; skipping SMS.');
    return 0;
  }

  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const link = `${baseUrl}${RADAR_DEFAULT_PAGE}?run_id=${encodeURIComponent(runId)}`;
  const message = `CCG radar run complete. ${guitarCount} new guitars.\n${link}`;
  const chunks = chunkSms(message, 700);

  let sent = 0;
  for (const text of chunks) {
    const ok = await sendTelnyxMessage(text, env);
    if (ok) sent += 1;
  }
  return sent;
}

function chunkSms(message: string, maxLength: number): string[] {
  if (message.length <= maxLength) return [message];
  const lines = message.split('\n');
  const chunks: string[] = [];
  let buffer = '';
  for (const line of lines) {
    if ((buffer + '\n' + line).length > maxLength) {
      chunks.push(buffer);
      buffer = line;
    } else {
      buffer = buffer ? `${buffer}\n${line}` : line;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

async function sendTelnyxMessage(text: string, env: Env): Promise<{ ok: boolean; body?: string }> {
  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.TELNYX_FROM_NUMBER,
      to: env.TELNYX_TO_NUMBER,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Telnyx SMS failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return { ok: false, body: errorText };
  }

  const body = await response.text();
  return { ok: true, body };
}

function isQuietHours(date: Date): boolean {
  const mst = shiftToMst(date);
  const hour = mst.getUTCHours();
  if (RADAR_QUIET_START_HOUR > RADAR_QUIET_END_HOUR) {
    return hour >= RADAR_QUIET_START_HOUR || hour < RADAR_QUIET_END_HOUR;
  }
  return hour >= RADAR_QUIET_START_HOUR && hour < RADAR_QUIET_END_HOUR;
}

function nextAllowedRadarTime(date: Date): Date {
  const mst = shiftToMst(date);
  const year = mst.getUTCFullYear();
  const month = mst.getUTCMonth();
  const day = mst.getUTCDate();
  let targetDay = day;
  const hour = mst.getUTCHours();

  if (hour >= RADAR_QUIET_START_HOUR) {
    targetDay += 1;
  }

  const utcTimestamp = Date.UTC(year, month, targetDay, RADAR_QUIET_END_HOUR - MST_OFFSET_MINUTES / 60, 0, 0);
  return new Date(utcTimestamp);
}

function shiftToMst(date: Date): Date {
  return new Date(date.getTime() + MST_OFFSET_MINUTES * 60 * 1000);
}

function randomJitterMinutes(min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

async function handleWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (env.WEBHOOK_SECRET) {
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid webhook payload.' }, 400);
  }

  const resource = payload.resource || payload.data || payload;
  const runId = resource?.id || payload.runId || payload.runId;
  const eventType = payload.eventType || payload.event || payload.eventType;

  if (!runId) {
    return jsonResponse({ message: 'Missing run ID.' }, 400);
  }

  await processRun(runId, resource, eventType, env);
  return jsonResponse({ ok: true });
}

type ListingListItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  score?: number | string;
};

async function handleList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset') || undefined;

  let limit = DEFAULT_PAGE_SIZE;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_PAGE_SIZE);
    }
  }

  const data = await airtableList(limit, offset, env);
  if (!data) {
    return jsonResponse({ message: 'Unable to fetch listings.' }, 500);
  }

  return jsonResponse(data);
}

async function handleGetListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

  if (!id || id === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await airtableGet(id, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse(record);
}

async function handleGetListingDebug(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const debugIndex = parts.indexOf('debug');
  const recordId = debugIndex > 0 ? parts[debugIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const record = await airtableGet(recordId, env);
  if (!record) {
    return jsonResponse({ message: 'Listing not found.' }, 404);
  }

  return jsonResponse({
    ok: true,
    record,
    isMulti: isMultiValue(record.fields?.IsMulti),
    singleFieldKeys: SINGLE_FIELD_KEYS,
  });
}

async function handleReprocessListing(request: Request, env: Env): Promise<Response> {
  if (env.WEBHOOK_SECRET) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const rawUrl = typeof body?.url === 'string' ? body.url : '';
  if (!rawUrl) return jsonResponse({ message: 'Missing url.' }, 400);

  const resolvedUrl = await resolveFacebookShareUrl(rawUrl);
  const normalizedUrl = normalizeUrl(resolvedUrl);
  if (!normalizedUrl) return jsonResponse({ message: 'Invalid url.' }, 400);

  const existing = await airtableFindByUrl(normalizedUrl, env);
  if (!existing?.id) return jsonResponse({ message: 'Listing not found in Airtable.' }, 404);

  const source = detectSource(normalizedUrl);
  if (!source) return jsonResponse({ message: 'Unsupported URL source.' }, 400);

  const runId = await startApifyRun(normalizedUrl, source as ListingSource, env);
  if (!runId) return jsonResponse({ message: 'Unable to start scraper run.' }, 500);

  await env.LISTING_JOBS.put(runId, existing.id);
  const runDetails = await waitForApifyRun(runId, env, 20);
  try {
    await processRun(runId, runDetails, runDetails?.status, env);
    return jsonResponse({ ok: true, runId, recordId: existing.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, runId, recordId: existing.id, error: message }, 500);
  }
}

async function handleArchiveListing(env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const archiveIndex = parts.indexOf('archive');
  const recordId = archiveIndex > 0 ? parts[archiveIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  const updated = await airtableSetArchivedState(recordId, true, env);
  if (!updated) {
    return jsonResponse({ message: 'Unable to archive listing.' }, 500);
  }

  return jsonResponse({ ok: true });
}

async function handleSearchResults(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');
  const includeAll = url.searchParams.get('include_all') === 'true';
  if (!runId) {
    return jsonResponse({ message: 'Missing run_id.' }, 400);
  }

  const data = await airtableSearchResults(runId, includeAll, env);
  if (!data) {
    return jsonResponse({ message: 'Unable to fetch search results.' }, 500);
  }

  return jsonResponse(data);
}

async function handleArchiveSearchResult(env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const archiveIndex = parts.indexOf('archive');
  const recordId = archiveIndex > 0 ? parts[archiveIndex - 1] : '';

  if (!recordId || recordId === 'search-results') {
    return jsonResponse({ message: 'Missing search result ID.' }, 400);
  }

  const updated = await airtableSearchSetArchivedState(recordId, true, env);
  if (!updated) {
    return jsonResponse({ message: 'Unable to archive search result.' }, 500);
  }

  return jsonResponse({ ok: true });
}

async function handleQueueSearchResult(env: Env, path: string, ctx: ExecutionContext): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const queueIndex = parts.indexOf('queue');
  const recordId = queueIndex > 0 ? parts[queueIndex - 1] : '';

  if (!recordId || recordId === 'search-results') {
    return jsonResponse({ message: 'Missing search result ID.' }, 400);
  }

  const record = await airtableSearchGet(recordId, env);
  if (!record?.fields?.url || typeof record.fields.url !== 'string') {
    return jsonResponse({ message: 'Search result has no URL.' }, 400);
  }

  const url = record.fields.url;
  const queueResponse = await handleSubmit(new Request('https://queue.local', {
    method: 'POST',
    body: JSON.stringify({ urls: [url] }),
    headers: { 'Content-Type': 'application/json' },
  }), env, ctx);

  return queueResponse;
}

async function handleRadarRun(request: Request, env: Env): Promise<Response> {
  if (env.WEBHOOK_SECRET) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source') as ListingSource | null;
    const result = await runRadarScan(env, source ?? undefined);
    return jsonResponse({ ok: true, summary: result.summary, source: source ?? 'all' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Radar run failed.';
    console.error('Manual radar run failed', {
      message,
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return jsonResponse({ message, error: String(error) }, 500);
  }
}

async function handleRadarClassify(request: Request, env: Env): Promise<Response> {
  if (env.WEBHOOK_SECRET) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  try {
    const result = await classifyPendingSearchResults(env, RADAR_CLASSIFY_BATCH);
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Radar classify failed.';
    console.error('Manual radar classify failed', {
      message,
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return jsonResponse({ message, error: String(error) }, 500);
  }
}

async function handleRadarSmsTest(request: Request, env: Env): Promise<Response> {
  if (env.WEBHOOK_SECRET) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('key');
    if (!provided || provided !== env.WEBHOOK_SECRET) {
      return jsonResponse({ message: 'Unauthorized' }, 401);
    }
  }

  if (!env.TELNYX_API_KEY || !env.TELNYX_FROM_NUMBER || !env.TELNYX_TO_NUMBER) {
    return jsonResponse({ message: 'Telnyx credentials missing.' }, 400);
  }

  const result = await sendTelnyxMessage('CCG radar test: Telnyx SMS is configured.', env);
  if (!result.ok) {
    return jsonResponse({ message: 'Telnyx SMS failed.', details: result.body }, 500);
  }

  return jsonResponse({ ok: true, details: result.body });
}

async function processRun(runId: string, resource: any, eventType: string | undefined, env: Env): Promise<void> {
  if (eventType && eventType.includes('FAILED')) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Apify run failed.',
    }, env);
    return;
  }

  const runDetails = await fetchApifyRun(runId, env);
  const datasetId = resource?.defaultDatasetId || runDetails?.defaultDatasetId;

  if (!datasetId) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'No dataset returned from scraper.',
    }, env);
    return;
  }

  const items = await fetchApifyDataset(datasetId, env);
  if (!items || items.length === 0) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Scraper returned no listing data.',
    }, env);
    return;
  }

  const listing = normalizeListing(items[0]);
  let recordId = await env.LISTING_JOBS.get(runId);
  if (!recordId && listing.url) {
    const found = await airtableFindByUrl(listing.url, env);
    if (found?.id) {
      recordId = found.id;
      await env.LISTING_JOBS.put(runId, recordId);
    }
  }
  const isMulti = recordId ? await getIsMultiFromRecord(recordId, env) : false;
  const aiResult = await runOpenAI(listing, env, { isMulti });
  const aiSummary = aiResult.kind === 'multi' ? ensureMultiTotals(aiResult.summary) : '';

  await updateRowByRunId(runId, {
    runId,
    status: 'complete',
    title: listing.title,
    price: listing.price,
    location: listing.location,
    condition: listing.condition,
    description: listing.description,
    photos: listing.images.join('\n'),
    aiSummary,
    aiData: aiResult.kind === 'single' ? aiResult.data : undefined,
    notes: listing.notes,
  }, env, { recordId, isMulti });
}

async function airtableList(
  limit: number,
  offset: string | undefined,
  env: Env
): Promise<{ records: ListingListItem[]; nextOffset?: string | null } | null> {
  const params = new URLSearchParams();
  params.set('pageSize', String(limit));
  params.append('fields[]', 'url');
  params.append('fields[]', 'source');
  params.append('fields[]', 'status');
  params.append('fields[]', 'title');
  params.append('fields[]', 'price_asking');
  params.append('fields[]', 'score');
  params.append('filterByFormula', "AND(NOT({archived}), {status} != 'queued')");
  params.append('sort[0][field]', 'submitted_at');
  params.append('sort[0][direction]', 'desc');
  if (offset) params.set('offset', offset);

  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable list failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  const records = Array.isArray(data?.records) ? data.records : [];
  const mapped: ListingListItem[] = records.map((record: any) => ({
    id: record.id,
    url: record.fields?.url ?? '',
    source: record.fields?.source ?? '',
    status: record.fields?.status ?? '',
    title: record.fields?.title ?? '',
    askingPrice: record.fields?.price_asking ?? null,
    score: record.fields?.score ?? null,
  }));

  return {
    records: mapped,
    nextOffset: data?.offset ?? null,
  };
}

async function airtableGet(recordId: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}/${recordId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errorText = await response.text();
    console.error('Airtable get failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  if (!data?.id) return null;
  return { id: data.id, fields: data.fields ?? {} };
}

async function getIsMultiFromRecord(recordId: string, env: Env): Promise<boolean> {
  const record = await airtableGet(recordId, env);
  return isMultiValue(record?.fields?.IsMulti);
}

type ListingSource = 'facebook' | 'craigslist';

type ListingData = {
  title: string;
  price: string;
  location: string;
  condition: string;
  description: string;
  images: string[];
  url?: string;
  notes?: string;
};

type SingleAiResult = {
  category: string;
  brand: string;
  model: string;
  finish: string;
  year: string;
  condition: string;
  serial: string;
  serial_brand: string;
  serial_year: string;
  serial_model: string;
  value_private_party_low: number | string | null;
  value_private_party_low_notes: string;
  value_private_party_medium: number | string | null;
  value_private_party_medium_notes: string;
  value_private_party_high: number | string | null;
  value_private_party_high_notes: string;
  value_pawn_shop_notes: string;
  value_online_notes: string;
  known_weak_points: string;
  typical_repair_needs: string;
  buyers_worry: string;
  og_specs_pickups: string;
  og_specs_tuners: string;
  og_specs_common_mods: string;
  buyer_what_to_check: string;
  buyer_common_misrepresent: string;
  seller_how_to_price_realistic: string;
  seller_fixes_add_value_or_waste: string;
  seller_as_is_notes: string;
  asking_price: number | string | null;
};

type AiResult = { kind: 'multi'; summary: string } | { kind: 'single'; data: SingleAiResult };

function normalizeListing(item: any): ListingData {
  const title = pickString(item.listingTitle, item.title, item.name, item.heading);
  const description = pickString(
    item.description?.text,
    item.post,
    item.description,
    item.details,
    item.body,
    item.text,
    item.postingBody,
    item.posting_body,
    item.desc,
    item.summary
  );
  const price = pickString(
    item.listingPrice?.formatted_amount_zeros_stripped,
    item.listingPrice?.amount,
    item.price,
    item.priceFormatted,
    item.priceText,
    item.priceAmount,
    item.priceRange
  );
  const location = pickLocation(
    item.locationText?.text,
    item.location,
    item.locationText,
    item.where,
    item.city,
    item.region,
    item.address?.city,
    item.address?.region
  );
  const condition = pickString(item.condition, item.itemCondition, item.conditionText);

  const images = pickImages(item);

  return {
    title,
    description,
    price,
    location,
    condition,
    images,
    url: pickString(
      item.url,
      item.itemUrl,
      item.item_url,
      item.listingUrl,
      item.listingURL,
      item.itemUrl,
      item.itemURL,
      item.canonicalUrl,
      item.canonicalURL,
      item.shareUrl,
      item.shareURL,
      item.marketplaceListingUrl,
      item.marketplaceListingURL
    ),
  };
}

function pickImages(item: any): string[] {
  const images: string[] = [];

  const candidates = [
    item.images,
    item.imageUrls,
    item.photos,
    item.photosSmall,
    item.imageUrl,
    item.image,
    item.pics,
    item.picUrls,
    item.listingPhotos,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => {
        if (typeof entry === 'string') images.push(entry);
        if (entry?.url) images.push(entry.url);
        if (entry?.imageUrl) images.push(entry.imageUrl);
        if (entry?.image?.uri) images.push(entry.image.uri);
      });
    } else if (typeof candidate === 'string') {
      images.push(candidate);
    }
  }

  const unique = Array.from(new Set(images.filter(Boolean)));
  return unique;
}

function pickString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

function normalizeText(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function normalizeCategory(value: unknown): string {
  const raw = normalizeText(value, 'Other');
  if (!raw) return 'Other';
  const match = CATEGORY_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  return match || 'Other';
}

function normalizeFinish(value: unknown): string {
  const raw = normalizeText(value, 'Unknown');
  if (!raw) return 'Unknown';
  return raw;
}

function normalizeYear(value: unknown): string {
  const raw = normalizeText(value, '');
  if (!raw || /^unknown$/i.test(raw)) {
    return 'Estimated range: 2000s–2010s (NOT DEFINITIVE)';
  }
  return raw;
}

function normalizeCondition(value: unknown): string {
  const raw = normalizeText(value, 'Good');
  if (!raw) return 'Good';
  const match = CONDITION_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
  return match || 'Good';
}

function normalizeMoneyValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseMoney(value);
    return parsed != null ? parsed : null;
  }
  return null;
}

function ensureDefaultSuffix(value: unknown, fallback: string): string {
  const text = normalizeText(value, '');
  if (!text) return `General: ${fallback}`;
  if (text.includes(fallback)) return text;
  return `${text} General: ${fallback}`;
}

function normalizeBrandKey(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z]/g, '');
}

const DECODER_MAP: Record<string, (serial: string) => { success: boolean; info?: { brand?: string; serialNumber?: string; year?: string; model?: string } }> = {
  gibson: decodeGibson,
  epiphone: decodeEpiphone,
  fender: decodeFender,
  taylor: decodeTaylor,
  martin: decodeMartin,
  ibanez: decodeIbanez,
  yamaha: decodeYamaha,
  prs: decodePRS,
  esp: decodeESP,
  schecter: decodeSchecter,
  gretsch: decodeGretsch,
  jackson: decodeJackson,
  squier: decodeSquier,
  cort: decodeCort,
  takamine: decodeTakamine,
  washburn: decodeWashburn,
  dean: decodeDean,
  ernieball: decodeErnieBall,
  ernieballmusicman: decodeErnieBall,
  musicman: decodeErnieBall,
  guild: decodeGuild,
  alvarez: decodeAlvarez,
  godin: decodeGodin,
  ovation: decodeOvation,
  charvel: decodeCharvel,
  rickenbacker: decodeRickenbacker,
  kramer: decodeKramer,
};

function decodeSerial(brandInput: string, serial: string): { success: boolean; info?: { brand?: string; serialNumber?: string; year?: string; model?: string } } | null {
  const normalizedBrand = normalizeBrandKey(brandInput);
  if (!normalizedBrand) return null;
  const decoder = DECODER_MAP[normalizedBrand];
  if (!decoder) return null;
  return decoder(serial);
}

function pickLocation(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      const trimmed = value.trim();
      if (isPriceLike(trimmed)) continue;
      return trimmed;
    }
  }
  return '';
}

function isPriceLike(input: string): boolean {
  if (!input) return false;
  const normalized = input.replace(/\s+/g, '');
  if (/^\$?[\d,]+(?:\.\d{1,2})?$/.test(normalized)) {
    return true;
  }
  return false;
}

function normalizeUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (!/^https?:\/\//i.test(trimmed)) {
      return new URL(`https://${trimmed}`).toString();
    }
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function detectSource(url: string): ListingSource | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('craigslist.org')) return 'craigslist';
    if (parsed.hostname.includes('facebook.com')) return 'facebook';
    return null;
  } catch {
    return null;
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

async function resolveFacebookShareUrl(url: string): Promise<string> {
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

async function startApifyRun(url: string, source: ListingSource, env: Env): Promise<string | null> {
  const actorId = source === 'facebook' ? env.APIFY_FACEBOOK_ACTOR : env.APIFY_CRAIGSLIST_ACTOR;
  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const webhookUrl = env.WEBHOOK_SECRET
    ? `${baseUrl}/api/listings/webhook?key=${env.WEBHOOK_SECRET}`
    : `${baseUrl}/api/listings/webhook`;

  const webhookPayload = [{
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
    requestUrl: webhookUrl,
    payloadTemplate: '{"resource":{{resource}},"eventType":"{{eventType}}"}',
  }];

  const webhooksParam = btoa(JSON.stringify(webhookPayload));

  const input = source === 'facebook'
    ? {
        startUrls: [{ url }],
        resultsLimit: 1,
        includeListingDetails: true,
      }
    : {
        urls: [{ url }],
        maxAge: 15,
        maxConcurrency: 4,
        proxyConfiguration: {
          useApifyProxy: true,
        },
      };

  const actorPath = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
  const response = await fetch(`https://api.apify.com/v2/acts/${actorPath}/runs?token=${env.APIFY_TOKEN}&webhooks=${encodeURIComponent(webhooksParam)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apify run start failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  return data?.data?.id || data?.id || null;
}

async function fetchApifyRun(runId: string, env: Env): Promise<any | null> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${env.APIFY_TOKEN}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data?.data || data;
}

async function abortApifyRun(runId: string, env: Env): Promise<void> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${env.APIFY_TOKEN}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.warn('Apify abort failed', {
      runId,
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
  }
}

async function waitForApifyRun(runId: string, env: Env, attempts: number): Promise<any | null> {
  let current = await fetchApifyRun(runId, env);
  let remaining = attempts;
  while (remaining > 0 && current && current.status && current.status !== 'SUCCEEDED' && current.status !== 'FAILED') {
    await delay(2000);
    remaining -= 1;
    current = await fetchApifyRun(runId, env);
  }
  return current;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchApifyDataset(datasetId: string, env: Env): Promise<any[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${env.APIFY_TOKEN}&clean=true&format=json`);
  if (!response.ok) return [];
  return await response.json();
}

async function insertQueuedRow(url: string, source: ListingSource, runId: string, isMulti: boolean, env: Env): Promise<void> {
  const timestamp = formatMountainTimestamp(new Date());
  const fields = {
    submitted_at: timestamp,
    source: formatSourceLabel(source),
    url,
    status: 'queued',
    IsMulti: isMulti,
  };

  try {
    const recordId = await airtableCreate(fields, env);
    if (recordId) {
      await env.LISTING_JOBS.put(runId, recordId);
    }
  } catch (error) {
    console.error('Airtable create failed', { error });
  }
}

async function updateRowByRunId(runId: string, updates: {
  runId?: string;
  status?: string;
  title?: string;
  price?: string;
  location?: string;
  condition?: string;
  description?: string;
  photos?: string;
  aiSummary?: string;
  aiData?: SingleAiResult;
  notes?: string;
}, env: Env, options?: { recordId?: string | null; isMulti?: boolean | null }): Promise<void> {
  const timestamp = new Date().toISOString();

  try {
    const recordId = options?.recordId ?? await env.LISTING_JOBS.get(runId);
    if (!recordId) {
      console.error('Airtable update failed: record not found for run_id', { runId });
      return;
    }

    const isMulti = options?.isMulti ?? await getIsMultiFromRecord(recordId, env);
    const privateParty = updates.aiSummary
      ? (isMulti ? extractMultiPrivatePartyRange(updates.aiSummary) : extractPrivatePartyRange(updates.aiSummary))
      : null;
    const aiAskingData = normalizeMoneyValue(updates.aiData?.asking_price);
    const listedPrice = updates.price ? parseMoney(updates.price) : null;
    const listedPriceOrAi = listedPrice ?? aiAskingData;
    const aiAsking = updates.aiSummary
      ? (isMulti ? extractMultiAskingTotal(updates.aiSummary) : extractAskingFromSummary(updates.aiSummary))
      : null;
    const aiScore = updates.aiSummary ? extractScoreFromSummary(updates.aiSummary) : null;
    const asking = chooseAskingPrice(listedPriceOrAi, aiAsking, updates.description ?? '', updates.aiSummary ?? '', isMulti);
    const ideal = updates.aiSummary
      ? (isMulti
          ? (privateParty?.low != null ? Math.round(privateParty.low * 0.8) : extractMultiIdealTotal(updates.aiSummary))
          : (privateParty?.low != null ? Math.round(privateParty.low * 0.8) : null))
      : null;
    const computedScore = privateParty && asking != null ? computeScore(asking, privateParty.low, privateParty.high) : null;
    const score = aiScore ?? computedScore;
    const summaryChunks = splitAiSummary(updates.aiSummary ?? null);
    if (updates.aiSummary) {
      console.info('AI summary split', { length: updates.aiSummary.length, chunks: summaryChunks.length });
    }

    const normalizedCondition = normalizeCondition(updates.aiData?.condition ?? updates.condition ?? '');
    const serialCandidate = typeof updates.aiData?.serial === 'string' ? updates.aiData.serial.trim() : '';
    const serialBrandCandidate = typeof updates.aiData?.serial_brand === 'string' ? updates.aiData.serial_brand.trim() : '';
    const decoded = serialCandidate
      ? decodeSerial(serialBrandCandidate || updates.aiData?.brand || '', serialCandidate)
      : null;
    const decodedBrand = decoded?.info?.brand || '';
    const decodedYear = decoded?.info?.year || '';
    const decodedModel = decoded?.info?.model || '';
    const serialShouldUse = decoded?.info?.serialNumber || serialCandidate;
    const serialBrand = decodedBrand || serialBrandCandidate || updates.aiData?.brand || '';
    const serialYear = decodedYear || updates.aiData?.serial_year || '';
    const serialModel = decodedModel || updates.aiData?.serial_model || '';

    const aiFields = updates.aiData
      ? {
          category: normalizeCategory(updates.aiData.category),
          brand: normalizeText(updates.aiData.brand, 'Unknown'),
          model: normalizeText(updates.aiData.model, 'Unknown'),
          finish: normalizeFinish(updates.aiData.finish),
          year: normalizeYear(updates.aiData.year),
          condition: normalizedCondition,
          serial: serialShouldUse || '',
          serial_brand: serialShouldUse ? normalizeText(serialBrand, '') : '',
          serial_year: serialShouldUse ? normalizeText(serialYear, '') : '',
          serial_model: serialShouldUse ? normalizeText(serialModel, '') : '',
          value_private_party_low: normalizeMoneyValue(updates.aiData.value_private_party_low),
          value_private_party_low_notes: normalizeText(updates.aiData.value_private_party_low_notes, ''),
          value_private_party_medium: normalizeMoneyValue(updates.aiData.value_private_party_medium),
          value_private_party_medium_notes: normalizeText(updates.aiData.value_private_party_medium_notes, ''),
          value_private_party_high: normalizeMoneyValue(updates.aiData.value_private_party_high),
          value_private_party_high_notes: normalizeText(updates.aiData.value_private_party_high_notes, ''),
          value_pawn_shop_notes: normalizeText(updates.aiData.value_pawn_shop_notes, ''),
          value_online_notes: normalizeText(updates.aiData.value_online_notes, ''),
          known_weak_points: ensureDefaultSuffix(updates.aiData.known_weak_points, DEFAULT_TEXT.known_weak_points),
          typical_repair_needs: ensureDefaultSuffix(updates.aiData.typical_repair_needs, DEFAULT_TEXT.typical_repair_needs),
          buyers_worry: ensureDefaultSuffix(updates.aiData.buyers_worry, DEFAULT_TEXT.buyers_worry),
          og_specs_pickups: normalizeText(updates.aiData.og_specs_pickups, ''),
          og_specs_tuners: normalizeText(updates.aiData.og_specs_tuners, ''),
          og_specs_common_mods: ensureDefaultSuffix(updates.aiData.og_specs_common_mods, DEFAULT_TEXT.og_specs_common_mods),
          buyer_what_to_check: ensureDefaultSuffix(updates.aiData.buyer_what_to_check, DEFAULT_TEXT.buyer_what_to_check),
          buyer_common_misrepresent: ensureDefaultSuffix(updates.aiData.buyer_common_misrepresent, DEFAULT_TEXT.buyer_common_misrepresent),
          seller_how_to_price_realistic: ensureDefaultSuffix(updates.aiData.seller_how_to_price_realistic, DEFAULT_TEXT.seller_how_to_price_realistic),
          seller_fixes_add_value_or_waste: ensureDefaultSuffix(updates.aiData.seller_fixes_add_value_or_waste, DEFAULT_TEXT.seller_fixes_add_value_or_waste),
          seller_as_is_notes: ensureDefaultSuffix(updates.aiData.seller_as_is_notes, DEFAULT_TEXT.seller_as_is_notes),
        }
      : null;
    const fields: Record<string, unknown> = {
      status: updates.status ?? null,
      title: updates.title ?? null,
      price_asking: asking ?? null,
      location: updates.location ?? null,
      description: updates.description ?? null,
      photos: updates.photos ?? null,
      ai_summary: isMulti ? summaryChunks[0] ?? null : null,
      ai_summary2: isMulti ? summaryChunks[1] ?? null : null,
      ai_summary3: isMulti ? summaryChunks[2] ?? null : null,
      ai_summary4: isMulti ? summaryChunks[3] ?? null : null,
      ai_summary5: isMulti ? summaryChunks[4] ?? null : null,
      ai_summary6: isMulti ? summaryChunks[5] ?? null : null,
      ai_summary7: isMulti ? summaryChunks[6] ?? null : null,
      ai_summary8: isMulti ? summaryChunks[7] ?? null : null,
      ai_summary9: isMulti ? summaryChunks[8] ?? null : null,
      ai_summary10: isMulti ? summaryChunks[9] ?? null : null,
      price_private_party: privateParty ? formatRange(privateParty.low, privateParty.high) : null,
      price_ideal: ideal ?? null,
    };
    if (score !== null) {
      fields.score = score;
    }
    await airtableUpdate(recordId, fields, env);
    if (aiFields && !isMulti) {
      await airtableUpdate(recordId, aiFields, env);
    }
  } catch (error) {
    console.error('Airtable update failed', { error });
    throw error;
  }
}

async function airtableCreate(fields: Record<string, unknown>, env: Env): Promise<string | null> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable create failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  return data?.records?.[0]?.id || null;
}

function escapeAirtableValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

async function airtableFindByUrl(url: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const params = new URLSearchParams();
  params.append('filterByFormula', `{url} = "${escapeAirtableValue(url)}"`);
  params.append('maxRecords', '1');
  params.append('fields[]', 'url');
  params.append('fields[]', 'archived');

  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  const record = data?.records?.[0];
  return record ? { id: record.id, fields: record.fields || {} } : null;
}

async function airtableUpdate(recordId: string, fields: Record<string, unknown>, env: Env): Promise<void> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable update failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(`Airtable update failed: ${response.status} ${response.statusText} ${errorText}`);
  }
}

async function airtableSetArchivedState(recordId: string, archived: boolean, env: Env): Promise<boolean> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { archived } }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable archive failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return false;
  }

  return true;
}

async function airtableSearchResults(
  runId: string,
  includeAll: boolean,
  env: Env
): Promise<{ records: any[] } | null> {
  const params = new URLSearchParams();
  const filters = [`{run_id} = "${escapeAirtableValue(runId)}"`];
  if (!includeAll) {
    filters.push('{is_guitar} = "Yes"');
    filters.push('NOT({archived})');
  }
  params.append('filterByFormula', `AND(${filters.join(',')})`);
  params.append('sort[0][field]', 'seen_at');
  params.append('sort[0][direction]', 'desc');
  params.append('pageSize', '100');

  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable search list failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  const records = Array.isArray(data?.records) ? data.records : [];
  return { records };
}

async function airtableSearchFindByUrl(url: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const params = new URLSearchParams();
  params.append('filterByFormula', `{url} = "${escapeAirtableValue(url)}"`);
  params.append('maxRecords', '1');
  params.append('fields[]', 'url');
  params.append('fields[]', 'archived');

  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  const record = data?.records?.[0];
  return record ? { id: record.id, fields: record.fields || {} } : null;
}

async function airtableSearchGet(recordId: string, env: Env): Promise<{ id: string; fields: Record<string, any> } | null> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}/${recordId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errorText = await response.text();
    console.error('Airtable search get failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  if (!data?.id) return null;
  return { id: data.id, fields: data.fields ?? {} };
}

async function airtableSearchCreateRow(fields: Record<string, unknown>, env: Env): Promise<string | null> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable search create failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  const data = await response.json();
  return data?.records?.[0]?.id || null;
}

async function airtableSearchCreateBatch(fieldsList: Record<string, unknown>[], env: Env): Promise<void> {
  if (fieldsList.length === 0) return;
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: fieldsList.map((fields) => ({ fields })) }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable search batch create failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
  }
}

async function airtableSearchUpdate(recordId: string, fields: Record<string, unknown>, env: Env): Promise<void> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable search update failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
  }
}

async function airtableSearchSetArchivedState(recordId: string, archived: boolean, env: Env): Promise<boolean> {
  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { archived } }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable search archive failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return false;
  }

  return true;
}

async function airtableSearchListPending(limit: number, env: Env): Promise<Array<{ id: string; fields: Record<string, any> }>> {
  const params = new URLSearchParams();
  params.append('filterByFormula', 'AND(NOT({archived}), OR({is_guitar} = BLANK(), {is_guitar} = "", {is_guitar} = "Unsure"))');
  params.append('maxRecords', String(limit));
  params.append('fields[]', 'title');
  params.append('fields[]', 'price');
  params.append('fields[]', 'image_url');
  params.append('fields[]', 'url');
  params.append('fields[]', 'keyword');

  const response = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_SEARCH_TABLE)}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable search pending list failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return [];
  }

  const data = await response.json();
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.map((record: any) => ({ id: record.id, fields: record.fields || {} }));
}

async function classifyPendingSearchResults(env: Env, limit: number): Promise<{ processed: number; updated: number }> {
  if (!env.OPENAI_API_KEY) {
    console.warn('OpenAI key missing; skipping radar classify.');
    return { processed: 0, updated: 0 };
  }

  const records = await airtableSearchListPending(limit, env);
  let updated = 0;

  for (const record of records) {
    const listing: ListingCandidate = {
      source: 'facebook',
      keyword: String(record.fields.keyword || 'guitar'),
      title: String(record.fields.title || ''),
      price: String(record.fields.price || ''),
      location: '',
      images: record.fields.image_url ? [String(record.fields.image_url)] : [],
      url: record.fields.url ? String(record.fields.url) : undefined,
    };

    const isGuitarResult = await runIsGuitar(listing, env);
    if (!isGuitarResult) continue;

    await airtableSearchUpdate(record.id, {
      is_guitar: isGuitarResult.isGuitar ? 'Yes' : 'No',
      ai_reason: isGuitarResult.reason,
      ai_checked_at: new Date().toISOString(),
    }, env);
    updated += 1;
  }

  return { processed: records.length, updated };
}

function isArchivedValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function isMultiValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

function extractPrivatePartyRange(aiSummary: string): { low: number; high: number } | null {
  const rangeMatch = aiSummary.match(/Typical private[-\s]party value:\s*\$?([\d,]+)\s*(?:–|-|to)\s*\$?([\d,]+)/i);
  if (rangeMatch) {
    const low = parseMoney(rangeMatch[1]);
    const high = parseMoney(rangeMatch[2]);
    if (low != null && high != null) {
      return { low, high };
    }
  }

  const singleMatch = aiSummary.match(/Typical private[-\s]party value:\s*\$?([\d,]+)/i);
  if (singleMatch) {
    const value = parseMoney(singleMatch[1]);
    if (value != null) {
      return { low: value, high: value };
    }
  }

  return null;
}

function extractMultiPrivatePartyRange(aiSummary: string): { low: number; high: number } | null {
  const rangeMatch = aiSummary.match(/Used market range for all:\s*\$?([\d,]+)\s*(?:–|-|to)\s*\$?([\d,]+)/i);
  if (rangeMatch) {
    const low = parseMoney(rangeMatch[1]);
    const high = parseMoney(rangeMatch[2]);
    if (low != null && high != null) {
      return { low, high };
    }
  }

  const singleMatch = aiSummary.match(/Used market range for all:\s*\$?([\d,]+)/i);
  if (singleMatch) {
    const value = parseMoney(singleMatch[1]);
    if (value != null) {
      return { low: value, high: value };
    }
  }

  return null;
}

function extractAskingFromSummary(aiSummary: string): number | null {
  const match = aiSummary.match(/Asking price \(from listing text\):\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

function extractMultiAskingTotal(aiSummary: string): number | null {
  const match = aiSummary.match(/Total listing asking price:\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

function extractScoreFromSummary(aiSummary: string): number | null {
  const match = aiSummary.match(/Score:\s*([0-9]+)\s*\/\s*10/i);
  if (!match) return null;
  const score = Number.parseInt(match[1], 10);
  if (!Number.isFinite(score)) return null;
  return Math.max(1, Math.min(10, score));
}

function extractMultiIdealTotal(aiSummary: string): number | null {
  const match = aiSummary.match(/Ideal price for all:\s*\$?([\d,]+)/i);
  if (!match) return null;
  return parseMoney(match[1]);
}

function ensureMultiTotals(aiSummary: string): string {
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

function splitAiSummary(aiSummary: string | null): string[] {
  if (!aiSummary) return [];
  const maxChunkSize = 2000;
  const chunks: string[] = [];
  let remaining = aiSummary;
  while (remaining.length > 0 && chunks.length < 10) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = remaining.lastIndexOf('\n\n', maxChunkSize);
    if (splitIndex < maxChunkSize * 0.6) {
      splitIndex = remaining.lastIndexOf('\n', maxChunkSize);
    }
    if (splitIndex < maxChunkSize * 0.4) {
      splitIndex = maxChunkSize;
    }
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }
  if (remaining.length > 0 && chunks.length === 10) {
    console.warn('AI summary truncated after 10 chunks', { remainingLength: remaining.length });
  }
  return chunks;
}

function chooseAskingPrice(
  listed: number | null,
  aiAsking: number | null,
  description: string,
  aiSummary: string,
  isMulti: boolean
): number | null {
  if (listed == null && aiAsking == null) return null;
  if (listed == null) return aiAsking;

  if (isMulti) {
    return aiAsking ?? listed;
  }

  const hasMultiplePrices = countMoneyTokens(description) >= 2;
  const summaryMentionsMultiple = /multiple items|bundle|lot|each pedal|per item/i.test(aiSummary);
  const suspicious = isSuspiciousListedPrice(listed, hasMultiplePrices);

  if (aiAsking != null && (suspicious || summaryMentionsMultiple)) {
    return aiAsking;
  }

  return listed;
}

function isSuspiciousListedPrice(listed: number, hasMultiplePrices: boolean): boolean {
  if (listed <= 5) return true;
  if (listed === 1234) return true;
  if (listed >= 1000 && hasMultiplePrices) return true;
  return false;
}

function countMoneyTokens(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\$\\s*[\\d,]+/g);
  return matches ? matches.length : 0;
}

function parseMoney(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatRange(low: number, high: number): string {
  if (low === high) return formatCurrency(low);
  return `${formatCurrency(low)} - ${formatCurrency(high)}`;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function computeScore(asking: number, low: number, high: number): number {
  if (asking <= low) {
    const margin = (low - asking) / low;
    const score = 8 + Math.min(2, margin * 4);
    return clampScore(score);
  }

  if (asking <= high) {
    const position = (asking - low) / Math.max(1, high - low);
    const score = 7 - position * 2;
    return clampScore(score);
  }

  const over = (asking - high) / high;
  const score = 5 - Math.min(4, over * 6);
  return clampScore(score);
}

function clampScore(value: number): number {
  const rounded = Math.round(value);
  return Math.max(1, Math.min(10, rounded));
}

function formatMountainTimestamp(date: Date): string {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const datePart = dateFormatter.format(date);
  const timeParts = timeFormatter.formatToParts(date);
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '';
  const dayPeriod = timeParts.find((part) => part.type === 'dayPeriod')?.value ?? '';
  const timePart = hour && minute && dayPeriod ? `${hour}:${minute}${dayPeriod}` : timeFormatter.format(date).replace(' ', '');
  return `${datePart} ${timePart} MST`;
}

function formatSourceLabel(source: ListingSource): string {
  return source === 'facebook' ? 'FBM' : 'CG';
}

function generateRunId(): string {
  const now = new Date();
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `run-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

function isSponsoredListing(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const directFlags = [
    item.isSponsored,
    item.isSponsoredListing,
    item.isPromoted,
    item.isPaid,
    item.isAd,
    item.isAdvertisement,
  ];
  if (directFlags.some(Boolean)) return true;

  const typeFields = [
    item.type,
    item.listingType,
    item.listing_type,
    item.adType,
    item.ad_type,
  ].filter((value) => typeof value === 'string') as string[];
  if (typeFields.some((value) => /sponsored|promoted|ad/i.test(value))) return true;

  const labels = [
    item.label,
    item.badge,
    item.badgeText,
    item.displayName,
    item.title,
  ].filter((value) => typeof value === 'string') as string[];
  return labels.some((value) => /sponsored|promoted|ad/i.test(value));
}

async function runOpenAI(listing: ListingData, env: Env, options?: { isMulti?: boolean }): Promise<AiResult> {
  const maxImages = Number.parseInt(env.MAX_IMAGES || '3', 10);
  const images = listing.images.slice(0, Number.isFinite(maxImages) ? maxImages : 3);
  const isMulti = options?.isMulti ?? false;

  const systemPrompt = isMulti
    ? `You are an expert used gear buyer and appraiser focused on music gear. This listing contains MULTIPLE items. Produce a concise valuation with the exact format below. If details are missing, be clear about uncertainty and suggest the specific photo or detail needed. Avoid hype.`
    : `You are an expert used gear buyer and appraiser focused on music gear. Provide structured output for a SINGLE item using the exact JSON schema provided. If details are missing, be clear about uncertainty. Avoid hype.`;

  const userPrompt = isMulti
    ? `Listing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nAsking price: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\n\nThis is a multi-item listing. Identify each distinct item for sale based on photos and description. For EACH item, output the same section format below, one item after another (no merged sections). If you cannot identify an item clearly, note it as \"Unknown item\" and explain why. If an item has no explicit asking price, write \"Asking price (from listing text): Unknown\" in that item. The ideal buy price is the LOW end of the used range minus 20%.\n\nAfter the last item, include TWO additional sections exactly as labeled below:\n\nItemized recap\n- Item name - $X asking, used range $Y to $Z, $W ideal (use \"Unknown\" if missing)\n\nTotals\n- Total listing asking price: $X (or \"Unknown\")\n- Used market range for all: $Y to $Z (or \"Unknown\")\n- Ideal price for all: $W (20% below used range low end; or \"Unknown\")\n\nUse this format for EACH item (plain bullet points, no extra dashes or nested bullet markers):\n\nWhat it appears to be\n- Make/model/variant\n- Estimated year or range (if possible; otherwise \"Year: Not enough info\")\n- Estimated condition from photos (or \"Condition from photos: Inconclusive\")\n- Notable finish/features\n\nPrices\n- Typical private-party value: $X–$Y\n- Music store pricing: $X–$Y\n- New price: $X (append \"(no longer available)\" if discontinued); or \"Unknown\" if you cannot determine\n- Ideal buy price: $X (20% below used range low end)\n\n- Adds Value: include one specific, model-relevant value add if it exists; avoid generic condition/finish statements; otherwise omit this line entirely\n\nHow long to sell\n- If put up for sale at the higher end of the used price range ($X), it will take about N–N weeks to sell to a local buyer, and perhaps N weeks to sell to an online buyer (Reverb.com).\n- If you cannot reasonably estimate, output exactly: Not enough data available.\n\nScore\n- Score: X/10 (resell potential based on ask vs realistic value, condition, and included extras)\n\nBottom line\n- Realistic value range\n- Asking price (from listing text): $X or \"Unknown\"\n- Buy/skip note\n- Any missing info to tighten valuation\n`
    : `Listing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nAsking price: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\n\nThis is a SINGLE item. Use the JSON schema provided to respond. Do not include any additional keys. Use these rules:\n- category must be one of: ${CATEGORY_OPTIONS.join(', ')}. Use \"Other\" if unsure.\n- condition must be one of: ${CONDITION_OPTIONS.join(', ')}.\n- brand/model should be \"Unknown\" only if truly impossible. If inferred, append \" (NOT DEFINITIVE)\" in caps.\n- finish: if unknown, guess a color and prefix with \"Guess: \".\n- year: avoid \"Unknown\". Prefer a specific year or a tight range (<= 10-15 years). If only a broad era is possible, provide a range and mark \"(NOT DEFINITIVE)\".\n- serial: only if identified from photos or description; otherwise blank.\n- serial_brand/year/model: only if serial is provided; otherwise blank.\n- value_private_party_low/medium/high: numeric or string values.\n- value_pawn_shop_notes must be less than private party low.\n- value_online_notes must mention marketplace fees and risks (shipping, buyer can't try before buying).\n- og_specs_* fields are blank if unknown.\n- asking_price: include parsed asking price if provided (numeric if possible).\n\nModel-specific detail requirements (must be specific to this model/brand/year when possible):\n- known_weak_points, typical_repair_needs, buyers_worry, og_specs_common_mods, buyer_what_to_check, buyer_common_misrepresent, seller_how_to_price_realistic, seller_fixes_add_value_or_waste, seller_as_is_notes.\n- For each field above, start with model-specific info (at least 1–2 sentences), then END with the default text below exactly as written, prefixed by \"General: \".\n- If no model-specific info is available, still include \"General: ...\" only.\n\nDefault text (use verbatim at the end of each field listed above):\n- known_weak_points: \"Potential issues with electronics or hardware over time.\"\n- typical_repair_needs: \"Possible need for setup adjustments or electronics cleaning.\"\n- buyers_worry: \"Check for neck straightness and electronics functionality.\"\n- og_specs_common_mods: \"Common mods vary; verify originality and parts.\"\n- buyer_what_to_check: \"Inspect electronics, neck relief, fret wear, and hardware function.\"\n- buyer_common_misrepresent: \"Watch for misrepresented year, model, or replaced parts.\"\n- seller_how_to_price_realistic: \"Price realistically by comparing recent sales in similar condition.\"\n- seller_fixes_add_value_or_waste: \"Minor setup and cleaning can help; major repairs may not pay off.\"\n- seller_as_is_notes: \"Sell as-is if repair costs exceed value gains.\"\n`;

  if (!env.OPENAI_API_KEY) {
    console.error('OpenAI API key missing');
    return 'AI analysis failed.';
  }

  const content: any[] = [{ type: 'input_text', text: userPrompt }];

  for (const imageUrl of images) {
    content.push({ type: 'input_image', image_url: imageUrl });
  }

  console.info('OpenAI request', {
    images: images.length,
    title: listing.title?.slice(0, 80) || 'unknown',
  });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content,
        },
      ],
      temperature: 0.4,
      max_output_tokens: 2000,
      text: isMulti
        ? undefined
        : {
            format: {
              type: 'json_schema',
              name: 'single_listing',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  category: { type: 'string' },
                  brand: { type: 'string' },
                  model: { type: 'string' },
                  finish: { type: 'string' },
                  year: { type: 'string' },
                  condition: { type: 'string' },
                  serial: { type: 'string' },
                  serial_brand: { type: 'string' },
                  serial_year: { type: 'string' },
                  serial_model: { type: 'string' },
                  value_private_party_low: { type: ['number', 'string', 'null'] },
                  value_private_party_low_notes: { type: 'string' },
                  value_private_party_medium: { type: ['number', 'string', 'null'] },
                  value_private_party_medium_notes: { type: 'string' },
                  value_private_party_high: { type: ['number', 'string', 'null'] },
                  value_private_party_high_notes: { type: 'string' },
                  value_pawn_shop_notes: { type: 'string' },
                  value_online_notes: { type: 'string' },
                  known_weak_points: { type: 'string' },
                  typical_repair_needs: { type: 'string' },
                  buyers_worry: { type: 'string' },
                  og_specs_pickups: { type: 'string' },
                  og_specs_tuners: { type: 'string' },
                  og_specs_common_mods: { type: 'string' },
                  buyer_what_to_check: { type: 'string' },
                  buyer_common_misrepresent: { type: 'string' },
                  seller_how_to_price_realistic: { type: 'string' },
                  seller_fixes_add_value_or_waste: { type: 'string' },
                  seller_as_is_notes: { type: 'string' },
                  asking_price: { type: ['number', 'string', 'null'] },
                },
                required: [
                  'category',
                  'brand',
                  'model',
                  'finish',
                  'year',
                  'condition',
                  'serial',
                  'serial_brand',
                  'serial_year',
                  'serial_model',
                  'value_private_party_low',
                  'value_private_party_low_notes',
                  'value_private_party_medium',
                  'value_private_party_medium_notes',
                  'value_private_party_high',
                  'value_private_party_high_notes',
                  'value_pawn_shop_notes',
                  'value_online_notes',
                  'known_weak_points',
                  'typical_repair_needs',
                  'buyers_worry',
                  'og_specs_pickups',
                  'og_specs_tuners',
                  'og_specs_common_mods',
                  'buyer_what_to_check',
                  'buyer_common_misrepresent',
                  'seller_how_to_price_realistic',
                  'seller_fixes_add_value_or_waste',
                  'seller_as_is_notes',
                  'asking_price',
                ],
              },
            },
          },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI response failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    if (isMulti) {
      return { kind: 'multi', summary: 'AI analysis failed.' };
    }
    return {
      kind: 'single',
      data: {
        category: 'Other',
        brand: 'Unknown',
        model: 'Unknown',
        finish: 'Unknown',
        year: 'Unknown',
        condition: 'Good',
        serial: '',
        serial_brand: '',
        serial_year: '',
        serial_model: '',
        value_private_party_low: null,
        value_private_party_low_notes: '',
        value_private_party_medium: null,
        value_private_party_medium_notes: '',
        value_private_party_high: null,
        value_private_party_high_notes: '',
        value_pawn_shop_notes: '',
        value_online_notes: '',
        known_weak_points: '',
        typical_repair_needs: '',
        buyers_worry: '',
        og_specs_pickups: '',
        og_specs_tuners: '',
        og_specs_common_mods: '',
        buyer_what_to_check: '',
        buyer_common_misrepresent: '',
        seller_how_to_price_realistic: '',
        seller_fixes_add_value_or_waste: '',
        seller_as_is_notes: '',
        asking_price: null,
      },
    };
  }

  const data = await response.json();
  if (isMulti) {
    return { kind: 'multi', summary: extractOpenAIText(data) || 'AI analysis returned no text.' };
  }

  const text = extractOpenAIText(data);
  try {
    const parsed = JSON.parse(text) as SingleAiResult;
    return { kind: 'single', data: parsed };
  } catch (error) {
    console.error('OpenAI JSON parse failed', { error, text: text?.slice(0, 200) });
    const fallback: SingleAiResult = {
      category: 'Other',
      brand: 'Unknown',
      model: 'Unknown',
      finish: 'Unknown',
      year: 'Unknown',
      condition: 'Good',
      serial: '',
      serial_brand: '',
      serial_year: '',
      serial_model: '',
      value_private_party_low: null,
      value_private_party_low_notes: '',
      value_private_party_medium: null,
      value_private_party_medium_notes: '',
      value_private_party_high: null,
      value_private_party_high_notes: '',
      value_pawn_shop_notes: '',
      value_online_notes: '',
      known_weak_points: '',
      typical_repair_needs: '',
      buyers_worry: '',
      og_specs_pickups: '',
      og_specs_tuners: '',
      og_specs_common_mods: '',
      buyer_what_to_check: '',
      buyer_common_misrepresent: '',
      seller_how_to_price_realistic: '',
      seller_fixes_add_value_or_waste: '',
      seller_as_is_notes: '',
      asking_price: null,
    };
    return { kind: 'single', data: fallback };
  }
}

function extractOpenAIText(response: any): string {
  const output = response?.output || [];
  for (const item of output) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      const textPart = item.content.find((part: any) => part.type === 'output_text');
      if (textPart?.text) return textPart.text;
    }
  }
  return '';
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
