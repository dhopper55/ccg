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
import {
  buildMainUserPrompt,
  buildMultiPricingPrompt,
  buildSinglePricingPrompt,
  buildSpecificsPrompt,
  buildSystemPrompt,
} from './prompts.js';
import {
  AUTH_COOKIE_NAME,
  buildAuthCookie,
  parseCookie,
  signAuth,
  verifyAuth,
} from './auth.js';

interface Env {
  DB: D1Database;
  OPENAI_API_KEY: string;
  APIFY_TOKEN: string;
  APIFY_FACEBOOK_ACTOR: string;
  APIFY_CRAIGSLIST_ACTOR: string;
  SITE_BASE_URL: string;
  MAX_IMAGES: string;
  AUTH_USER: string;
  AUTH_PASS: string;
  AUTH_SECRET: string;
  WEBHOOK_SECRET?: string;
  RADAR_FB_SEARCH_URL?: string;
  RADAR_CL_SEARCH_URL?: string;
  RADAR_KEYWORDS?: string;
  TELNYX_API_KEY?: string;
  TELNYX_FROM_NUMBER?: string;
  TELNYX_TO_NUMBER?: string;
  RADAR_AI_ENABLED?: string;
  RADAR_EMAIL_TO?: string;
  RADAR_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
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
const RADAR_ENABLED_KEY = 'radar_enabled';
const RADAR_INTERVAL_MINUTES_KEY = 'radar_interval_minutes';
const RADAR_RESULTS_LIMIT_KEY = 'radar_results_limit';
const RADAR_DEFAULT_INTERVAL_MINUTES = 3;
const RADAR_MIN_INTERVAL_MINUTES = 1;
const RADAR_MAX_INTERVAL_MINUTES = 120;
const RADAR_DEFAULT_RESULTS_LIMIT = 5;
const RADAR_MIN_RESULTS_LIMIT = 1;
const RADAR_MAX_RESULTS_LIMIT = 100;
const RADAR_JITTER_MINUTES = -1;
const RADAR_JITTER_MAX_MINUTES = 1;
const RADAR_EMAIL_SEND_EMPTY_KEY = 'radar_email_send_empty';
const RADAR_CONSECUTIVE_SEEN_LIMIT = 10;
const RADAR_MAX_NEW_PER_SOURCE = 100;
const RADAR_CL_TIMEBOX_MS = 60000;
const RADAR_MAX_AI_CHECKS_PER_RUN = 0;
const RADAR_CLASSIFY_BATCH = 3;
const RADAR_DEFAULT_PAGE = '/listing-radar.html';
const RADAR_DEFAULT_EMAIL_TO = 'david@coalcreekguitars.com';
const RADAR_EMAIL_INCLUDE_EXISTING = false;
const MST_OFFSET_MINUTES = -7 * 60;
const RADAR_QUIET_START_HOUR = 23;
const RADAR_QUIET_END_HOUR = 5;

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

const SPECIFIC_FIELDS = [
  'known_weak_points',
  'typical_repair_needs',
  'buyers_worry',
  'og_specs_common_mods',
  'buyer_what_to_check',
  'buyer_common_misrepresent',
  'seller_how_to_price_realistic',
  'seller_fixes_add_value_or_waste',
  'seller_as_is_notes',
] as const;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/api/login' && request.method === 'POST') {
      const response = await handleLogin(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/session' && request.method === 'GET') {
      const response = await handleSession(request, env);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/')) {
      const authResponse = await requireAuth(request, env, path);
      if (authResponse) {
        return withCors(authResponse, request, env);
      }
    }

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
      const response = await handleArchiveListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path.endsWith('/save') && path.startsWith('/api/listings/') && request.method === 'POST') {
      const response = await handleSaveListing(request, env, path);
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

    if (path === '/api/radar/settings' && request.method === 'GET') {
      const response = await handleRadarSettings(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/radar/settings' && request.method === 'POST') {
      const response = await handleRadarSettingsUpdate(request, env);
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

async function requireAuth(request: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/listings/webhook' && request.method === 'POST') {
    return null;
  }

  const cookies = parseCookie(request.headers.get('cookie'));
  const token = cookies.get(AUTH_COOKIE_NAME);
  if (!token) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const [user, sig] = token.split('.');
  if (!user || !sig) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const validUser = user === env.AUTH_USER;
  const validSig = await verifyAuth(user, env.AUTH_SECRET, sig);
  if (!validUser || !validSig) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  return null;
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  let body: { username?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const username = body.username?.trim() ?? '';
  const password = body.password ?? '';
  if (username !== env.AUTH_USER || password !== env.AUTH_PASS) {
    return jsonResponse({ error: 'invalid_credentials' }, 401);
  }

  const sig = await signAuth(username, env.AUTH_SECRET);
  const token = `${username}.${sig}`;
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': buildAuthCookie(token),
    },
  });
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const cookies = parseCookie(request.headers.get('cookie'));
  const token = cookies.get(AUTH_COOKIE_NAME);
  if (!token) {
    return jsonResponse({ ok: false }, 401);
  }

  const [user, sig] = token.split('.');
  if (!user || !sig) {
    return jsonResponse({ ok: false }, 401);
  }

  const validUser = user === env.AUTH_USER;
  const validSig = await verifyAuth(user, env.AUTH_SECRET, sig);
  if (!validUser || !validSig) {
    return jsonResponse({ ok: false }, 401);
  }

  return new Response(JSON.stringify({ ok: true, user }), {
    headers: { 'content-type': 'application/json' },
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
    const existing = await dbFindListingByUrl(item.url, env);
    if (existing) {
      const archived = isArchivedValue(existing.fields?.archived);
      if (archived) {
        const restored = await dbSetListingArchived(existing.id, false, env);
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
  const settings = await getRadarSettings(env);
  const nextRunAtRaw = await env.LISTING_JOBS.get(RADAR_NEXT_RUN_KEY);
  const nextRunAt = nextRunAtRaw ? Number.parseInt(nextRunAtRaw, 10) : null;

  if (nextRunAt && Number.isFinite(nextRunAt) && now < nextRunAt) {
    return;
  }

  let summary = 'Radar run skipped.';
  let didRun = false;
  try {
    if (!settings.enabled) {
      summary = 'Radar run skipped (disabled).';
      return;
    }
    if (isQuietHours(new Date(now))) {
      summary = 'Radar run skipped (quiet hours).';
      return;
    }
    const lastRunAtRaw = await env.LISTING_JOBS.get(RADAR_LAST_RUN_KEY);
    const lastRunAt = lastRunAtRaw ? Number.parseInt(lastRunAtRaw, 10) : null;
    const hoursSinceLast = lastRunAt ? (now - lastRunAt) / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
    const baseLimit = settings.resultsLimit;
    const resultsLimit = hoursSinceLast > 5 ? Math.max(baseLimit, 15) : baseLimit;
    const result = await runRadarScan(env, 'facebook', resultsLimit);
    summary = result.summary;
    didRun = true;
  } catch (error) {
    console.error('Radar run failed', { error });
    summary = 'Radar run failed.';
  } finally {
    const nextRunAtValue = nextRadarRunAt(now, settings.intervalMinutes);
    await env.LISTING_JOBS.put(RADAR_NEXT_RUN_KEY, String(nextRunAtValue));
    if (didRun) {
      await env.LISTING_JOBS.put(RADAR_LAST_RUN_KEY, String(now));
    }
    await env.LISTING_JOBS.put(RADAR_LAST_SUMMARY_KEY, summary);
  }
}

type RadarResult = {
  matched: number;
  saved: number;
  smsSent: number;
  summary: string;
};

async function runRadarScan(
  env: Env,
  sourceOverride?: ListingSource,
  resultsLimit = 5
): Promise<RadarResult> {
  const keywords = parseRadarKeywords(env.RADAR_KEYWORDS);
  const fbUrl = env.RADAR_FB_SEARCH_URL;
  const clUrl = env.RADAR_CL_SEARCH_URL;
  if (!fbUrl) {
    console.warn('Radar FB search URL missing.');
    return { matched: 0, saved: 0, smsSent: 0, summary: 'Radar FB search URL missing.' };
  }

  const runId = generateRunId();
  const runStartedAt = new Date().toISOString();
  const scored: ScoredListing[] = [];
  const newBySource: Record<ListingSource, number> = { facebook: 0, craigslist: 0 };
  const aiBudget = { remaining: RADAR_MAX_AI_CHECKS_PER_RUN };
  const newListings: ListingCandidate[] = [];

  for (const keyword of keywords) {
    if (!sourceOverride || sourceOverride === 'craigslist') {
      if (!clUrl) {
        console.warn('Radar CL search URL missing; skipping Craigslist.');
      } else {
        const clInput = buildCraigslistSearchInput(clUrl, keyword);
        const clStats = await runCraigslistWithAbort(clInput, keyword, runId, runStartedAt, newBySource, scored, env, aiBudget, newListings);
        console.info('Radar CL stats', { keyword, ...clStats });
      }
    }

    if (!sourceOverride || sourceOverride === 'facebook') {
      const fbInput = buildFacebookSearchInput(fbUrl, keyword, resultsLimit);
      const fbRun = await runApifySearch(env.APIFY_FACEBOOK_ACTOR, fbInput, env);
      const fbStats = await processSourceResults('facebook', fbRun.items, keyword, runId, runStartedAt, newBySource, scored, env, fbRun.runId, aiBudget, newListings, RADAR_EMAIL_INCLUDE_EXISTING);
      console.info('Radar FB stats', { keyword, ...fbStats });
    }
  }

  const guitarListings = scored.filter((listing) => listing.isGuitar);
  const emailResult = await sendRadarEmail(runId, newListings, env, false);
  const summary = `Radar run ${runId}: ${scored.length} new, ${guitarListings.length} guitars, email ${emailResult.ok ? 'sent' : 'failed'}.`;

  return {
    matched: scored.length,
    saved: scored.length,
    smsSent: 0,
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

function buildFacebookSearchInput(baseUrl: string, keyword: string, resultsLimit: number): Record<string, unknown> {
  const withQuery = replaceQueryParam(baseUrl, 'query', keyword);
  const withSort = replaceQueryParam(withQuery, 'sortBy', 'creation_time_descend');
  return {
    includeListingDetails: false,
    resultsLimit,
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
    if (source === 'facebook') {
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
      } else if (url) {
        url = normalizeFacebookItemUrl(url) || url;
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

function normalizeFacebookItemUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes('facebook.com')) return rawUrl;
    const match = parsed.pathname.match(/\/marketplace\/item\/(\d+)/);
    if (match) {
      return `https://www.facebook.com/marketplace/item/${match[1]}/`;
    }
    return parsed.toString();
  } catch {
    return null;
  }
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
  aiBudget?: { remaining: number },
  newListings?: ListingCandidate[],
  includeExistingInEmail = false
): Promise<{ total: number; created: number; skippedSponsored: number; skippedNoUrl: number; skippedExisting: number; skippedAiLimit: number }> {
  return await processCandidatesWithState(source, items, keyword, runId, runStartedAt, newBySource, scored, env, {
    consecutiveSeen: 0,
    processedUrls: new Set<string>(),
  }, apifyRunId, aiBudget, newListings, includeExistingInEmail);
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
  aiBudget?: { remaining: number },
  newListings?: ListingCandidate[],
  includeExistingInEmail = false
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

    const existing = await dbSearchFindByUrl(candidate.url, env);
    if (existing) {
      skippedExisting += 1;
      if (includeExistingInEmail && newListings) {
        newListings.push(candidate);
        continue;
      }
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
    if (aiBudget && aiBudget.remaining > 0) {
      aiBudget.remaining -= 1;
      isGuitarResult = await runIsGuitar(candidate, env);
    } else if (aiBudget) {
      skippedAiLimit += 1;
    }

    pendingCreates.push(buildSearchFields(candidate, isGuitarResult, runId, runStartedAt));
    newBySource[source] += 1;
    createdCount += 1;
    if (newListings) newListings.push(candidate);

    if (pendingCreates.length >= 10) {
      await dbSearchCreateBatch(pendingCreates.splice(0, pendingCreates.length), env);
    }

    if (isGuitarResult) {
      scored.push({ ...candidate, isGuitar: isGuitarResult.isGuitar, reason: isGuitarResult.reason });
    }
  }

  if (pendingCreates.length > 0) {
    await dbSearchCreateBatch(pendingCreates.splice(0, pendingCreates.length), env);
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
  aiBudget?: { remaining: number },
  newListings?: ListingCandidate[]
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
      aiBudget,
      newListings
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

type RadarEmailResult = { ok: boolean; status?: number; statusText?: string; body?: string };

async function sendRadarEmail(
  runId: string,
  listings: ListingCandidate[],
  env: Env,
  sendEmpty: boolean,
  subjectPrefix = 'CCG/FBM Worker NEW Results'
): Promise<RadarEmailResult> {
  void runId;
  if (!listings.length && !sendEmpty) {
    return { ok: false, body: 'No new listings.' };
  }
  const toEmail = env.RADAR_EMAIL_TO || RADAR_DEFAULT_EMAIL_TO;
  const fromEmail = env.RADAR_EMAIL_FROM || 'onboarding@resend.dev';
  if (!toEmail) {
    console.warn('Radar email skipped: no recipient configured.');
    return { ok: false, body: 'Radar email skipped: no recipient configured.' };
  }

  if (!env.RESEND_API_KEY) {
    console.warn('Radar email skipped: RESEND_API_KEY missing.');
    return { ok: false, body: 'Radar email skipped: RESEND_API_KEY missing.' };
  }

  const lines = listings.map((listing) => {
    const title = listing.title?.trim() || 'Untitled listing';
    const price = listing.price ? `${listing.price}` : '—';
    const location = listing.location ? `${listing.location}` : '—';
    const sponsored = listing.isSponsored ? 'SPONSORED' : '';
    const url = listing.url || '';
    return `- ${title} | ${price} | ${location}${sponsored ? ` | ${sponsored}` : ''} | ${url}`.trim();
  });

  const textBody = lines.length > 0 ? lines.join('\n') : 'No new listings in this run.';
  const listItems = listings.map((listing) => {
    const title = listing.title?.trim() || 'Untitled listing';
    const price = listing.price ? `${listing.price}` : '—';
    const location = listing.location ? `${listing.location}` : '—';
    const sponsored = listing.isSponsored ? 'SPONSORED' : '';
    const url = listing.url || '#';
    const image = listing.images?.[0];
    const imageHtml = image
      ? `<div style="margin-top:6px;"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="max-width:220px;border-radius:8px;border:1px solid #ddd;" /></div>`
      : '';
    return `<li style="margin-bottom:16px;">
      <a href="${escapeHtml(url)}" style="text-decoration:none;color:#111;">
        <div style="font-weight:600;">${escapeHtml(title)}</div>
        <div style="font-size:13px;color:#444;"><strong>${escapeHtml(price)}</strong> | ${escapeHtml(location)}${sponsored ? ` | <strong>${escapeHtml(sponsored)}</strong>` : ''}</div>
        ${imageHtml}
      </a>
    </li>`;
  }).join('');
  const htmlBody = `<!doctype html>
<html>
  <body>
    <p>New Facebook Marketplace results:</p>
    ${listItems ? `<ul>${listItems}</ul>` : '<p>No new listings in this run.</p>'}
  </body>
</html>`;

  const subjectTimestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const payload = {
    from: `CCG Radar <${fromEmail}>`,
    to: [toEmail],
    subject: `${subjectPrefix} - ${subjectTimestamp}`,
    text: textBody,
    html: htmlBody,
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

  const responseText = await response.text();
  if (!response.ok) {
    console.error('Radar email failed', {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    });
    return { ok: false, status: response.status, statusText: response.statusText, body: responseText };
  }
  console.info('Radar email sent', {
    status: response.status,
    statusText: response.statusText,
    body: responseText,
  });
  return { ok: true, status: response.status, statusText: response.statusText, body: responseText };
} catch (error) {
  console.error('Radar email failed', { error });
  return { ok: false, body: error instanceof Error ? error.message : String(error) };
}
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function randomJitterMinutes(min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function isQuietHours(date: Date): boolean {
  const mst = shiftToMst(date);
  const hour = mst.getUTCHours();
  if (RADAR_QUIET_START_HOUR > RADAR_QUIET_END_HOUR) {
    return hour >= RADAR_QUIET_START_HOUR || hour < RADAR_QUIET_END_HOUR;
  }
  return hour >= RADAR_QUIET_START_HOUR && hour < RADAR_QUIET_END_HOUR;
}

function shiftToMst(date: Date): Date {
  return new Date(date.getTime() + MST_OFFSET_MINUTES * 60 * 1000);
}

function clampIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) return RADAR_DEFAULT_INTERVAL_MINUTES;
  return Math.min(Math.max(Math.round(value), RADAR_MIN_INTERVAL_MINUTES), RADAR_MAX_INTERVAL_MINUTES);
}

function clampResultsLimit(value: number): number {
  if (!Number.isFinite(value)) return RADAR_DEFAULT_RESULTS_LIMIT;
  return Math.min(Math.max(Math.round(value), RADAR_MIN_RESULTS_LIMIT), RADAR_MAX_RESULTS_LIMIT);
}

function nextRadarRunAt(now: number, intervalMinutes: number): number {
  const jitter = randomJitterMinutes(RADAR_JITTER_MINUTES, RADAR_JITTER_MAX_MINUTES);
  const minutes = clampIntervalMinutes(intervalMinutes) + jitter;
  const safeMinutes = Math.max(RADAR_MIN_INTERVAL_MINUTES, minutes);
  return now + safeMinutes * 60 * 1000;
}

async function getRadarSettings(env: Env): Promise<{ enabled: boolean; intervalMinutes: number; resultsLimit: number }> {
  const enabledRaw = await env.LISTING_JOBS.get(RADAR_ENABLED_KEY);
  const intervalRaw = await env.LISTING_JOBS.get(RADAR_INTERVAL_MINUTES_KEY);
  const resultsLimitRaw = await env.LISTING_JOBS.get(RADAR_RESULTS_LIMIT_KEY);
  const enabled = enabledRaw ? enabledRaw === 'true' : false;
  const intervalParsed = intervalRaw ? Number.parseInt(intervalRaw, 10) : RADAR_DEFAULT_INTERVAL_MINUTES;
  const resultsParsed = resultsLimitRaw ? Number.parseInt(resultsLimitRaw, 10) : RADAR_DEFAULT_RESULTS_LIMIT;
  return {
    enabled,
    intervalMinutes: clampIntervalMinutes(intervalParsed),
    resultsLimit: clampResultsLimit(resultsParsed),
  };
}

async function updateRadarSettings(
  env: Env,
  next: { enabled?: boolean; intervalMinutes?: number; resultsLimit?: number }
): Promise<{ enabled: boolean; intervalMinutes: number; resultsLimit: number }> {
  const current = await getRadarSettings(env);
  const enabled = typeof next.enabled === 'boolean' ? next.enabled : current.enabled;
  const intervalMinutes = typeof next.intervalMinutes === 'number'
    ? clampIntervalMinutes(next.intervalMinutes)
    : current.intervalMinutes;
  const resultsLimit = typeof next.resultsLimit === 'number'
    ? clampResultsLimit(next.resultsLimit)
    : current.resultsLimit;

  await env.LISTING_JOBS.put(RADAR_ENABLED_KEY, String(enabled));
  await env.LISTING_JOBS.put(RADAR_INTERVAL_MINUTES_KEY, String(intervalMinutes));
  await env.LISTING_JOBS.put(RADAR_RESULTS_LIMIT_KEY, String(resultsLimit));

  const now = Date.now();
  const nextRunAtValue = nextRadarRunAt(now, intervalMinutes);
  await env.LISTING_JOBS.put(RADAR_NEXT_RUN_KEY, String(nextRunAtValue));

  return { enabled, intervalMinutes, resultsLimit };
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
  saved?: boolean;
};

async function handleList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset') || undefined;
  const showSaved = url.searchParams.get('showSaved') === '1';
  const showArchived = url.searchParams.get('showArchived') === '1';

  let limit = DEFAULT_PAGE_SIZE;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_PAGE_SIZE);
    }
  }

  const mode: 'default' | 'saved' | 'archived' = showSaved ? 'saved' : (showArchived ? 'archived' : 'default');
  const data = await dbListListings(limit, offset, mode, env);
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

  const record = await dbGetListing(id, env);
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

  const record = await dbGetListing(recordId, env);
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

  const existing = await dbFindListingByUrl(normalizedUrl, env);
  if (!existing?.id) return jsonResponse({ message: 'Listing not found.' }, 404);

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

async function handleArchiveListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const archiveIndex = parts.indexOf('archive');
  const recordId = archiveIndex > 0 ? parts[archiveIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let archivedValue = true;
  try {
    const body = await request.json();
    if (typeof body?.archived === 'boolean') {
      archivedValue = body.archived;
    }
  } catch {
    archivedValue = true;
  }

  const updated = await dbSetListingArchived(recordId, archivedValue, env);
  if (!updated) {
    return jsonResponse({ message: 'Unable to archive listing.' }, 500);
  }

  return jsonResponse({ ok: true, archived: archivedValue });
}

async function handleSaveListing(request: Request, env: Env, path: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const saveIndex = parts.indexOf('save');
  const recordId = saveIndex > 0 ? parts[saveIndex - 1] : '';

  if (!recordId || recordId === 'listings') {
    return jsonResponse({ message: 'Missing listing ID.' }, 400);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const savedValue = typeof body?.saved === 'boolean' ? body.saved : null;
  if (savedValue === null) {
    return jsonResponse({ message: 'Missing saved state.' }, 400);
  }

  await dbUpdateListing(recordId, { saved: savedValue }, env);
  return jsonResponse({ ok: true, saved: savedValue });
}

async function handleSearchResults(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');
  const includeAll = url.searchParams.get('include_all') === 'true';
  if (!runId) {
    return jsonResponse({ message: 'Missing run_id.' }, 400);
  }

  const data = await dbSearchResults(runId, includeAll, env);
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

  const updated = await dbSearchSetArchivedState(recordId, true, env);
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

  const record = await dbSearchGet(recordId, env);
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

async function handleRadarSettings(_request: Request, env: Env): Promise<Response> {
  const settings = await getRadarSettings(env);
  const lastRunAt = await env.LISTING_JOBS.get(RADAR_LAST_RUN_KEY);
  const nextRunAt = await env.LISTING_JOBS.get(RADAR_NEXT_RUN_KEY);
  const lastSummary = await env.LISTING_JOBS.get(RADAR_LAST_SUMMARY_KEY);
  return jsonResponse({
    enabled: settings.enabled,
    intervalMinutes: settings.intervalMinutes,
    resultsLimit: settings.resultsLimit,
    lastRunAt: lastRunAt ? Number.parseInt(lastRunAt, 10) : null,
    nextRunAt: nextRunAt ? Number.parseInt(nextRunAt, 10) : null,
    lastSummary: lastSummary ?? null,
  });
}

async function handleRadarSettingsUpdate(request: Request, env: Env): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const enabled = typeof body?.enabled === 'boolean' ? body.enabled : undefined;
  const intervalMinutes = typeof body?.intervalMinutes === 'number' ? body.intervalMinutes : undefined;
  const resultsLimit = typeof body?.resultsLimit === 'number' ? body.resultsLimit : undefined;
  const updated = await updateRadarSettings(env, { enabled, intervalMinutes, resultsLimit });
  return jsonResponse({ ok: true, ...updated });
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
    const found = await dbFindListingByUrl(listing.url, env);
    if (found?.id) {
      recordId = found.id;
      await env.LISTING_JOBS.put(runId, recordId);
    }
  }
  const isMulti = recordId ? await getIsMultiFromRecord(recordId, env) : false;
  const aiResult = await runOpenAI(listing, env, { isMulti });
  let aiSummary = aiResult.kind === 'multi' ? ensureMultiTotals(aiResult.summary) : '';
  let aiData = aiResult.kind === 'single' ? aiResult.data : undefined;

  if (aiResult.kind === 'single' && aiData) {
    const pricing = await runOpenAIPrivatePartyPricing(listing, aiData, env);
    if (pricing) {
      aiData = { ...aiData, ...stripEmptyFallback(pricing) };
    }
  }

  if (aiResult.kind === 'multi') {
    const pricing = await runOpenAIMultiRangePricing(listing, aiSummary, env);
    if (pricing) {
      aiSummary = applyMultiRangeToSummary(aiSummary, pricing.low, pricing.high);
    }
  }

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
    aiData,
    notes: listing.notes,
  }, env, { recordId, isMulti });
}

function hasOwnField(fields: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, key);
}

function toDbBoolean(value: unknown): number | null {
  if (value == null) return null;
  return isArchivedValue(value) ? 1 : 0;
}

function toDbMulti(value: unknown): number | null {
  if (value == null) return null;
  return isMultiValue(value) ? 1 : 0;
}

function toBoolFromYesNo(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'yes' || normalized === 'true' || normalized === '1') return true;
    if (normalized === 'no' || normalized === 'false' || normalized === '0') return false;
  }
  return null;
}

function listingFieldsToColumns(fields: Record<string, unknown>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  const assign = (fieldKey: string, columnKey = fieldKey, transform?: (value: unknown) => unknown) => {
    if (!hasOwnField(fields, fieldKey)) return;
    const raw = fields[fieldKey];
    columns[columnKey] = transform ? transform(raw) : raw;
  };

  assign('submitted_at');
  assign('source');
  assign('url');
  assign('status');
  assign('title');
  assign('price_asking');
  assign('location');
  assign('description');
  assign('photos');
  assign('ai_summary');
  assign('ai_summary2');
  assign('ai_summary3');
  assign('ai_summary4');
  assign('ai_summary5');
  assign('ai_summary6');
  assign('ai_summary7');
  assign('ai_summary8');
  assign('ai_summary9');
  assign('ai_summary10');
  assign('price_private_party');
  assign('price_ideal');
  assign('score');
  assign('category');
  assign('brand');
  assign('model');
  assign('finish');
  assign('year');
  assign('condition');
  assign('serial');
  assign('serial_brand');
  assign('serial_year');
  assign('serial_model');
  assign('value_private_party_low');
  assign('value_private_party_low_notes');
  assign('value_private_party_medium');
  assign('value_private_party_medium_notes');
  assign('value_private_party_high');
  assign('value_private_party_high_notes');
  assign('value_pawn_shop_notes');
  assign('value_online_notes');
  assign('known_weak_points');
  assign('typical_repair_needs');
  assign('buyers_worry');
  assign('og_specs_pickups');
  assign('og_specs_tuners');
  assign('og_specs_common_mods');
  assign('buyer_what_to_check');
  assign('buyer_common_misrepresent');
  assign('seller_how_to_price_realistic');
  assign('seller_fixes_add_value_or_waste');
  assign('seller_as_is_notes');
  assign('archived', 'archived', toDbBoolean);
  assign('saved', 'saved', toDbBoolean);
  assign('IsMulti', 'is_multi', toDbMulti);

  return columns;
}

function searchFieldsToColumns(fields: Record<string, unknown>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  const assign = (fieldKey: string, columnKey = fieldKey, transform?: (value: unknown) => unknown) => {
    if (!hasOwnField(fields, fieldKey)) return;
    const raw = fields[fieldKey];
    columns[columnKey] = transform ? transform(raw) : raw;
  };

  assign('run_id');
  assign('run_started_at');
  assign('source');
  assign('keyword');
  assign('url');
  assign('title');
  assign('price');
  assign('image_url');
  assign('is_guitar');
  assign('is_sponsored', 'is_sponsored', toDbBoolean);
  assign('archived', 'archived', toDbBoolean);
  assign('ai_reason');
  assign('seen_at');
  assign('ai_checked_at');

  return columns;
}

function buildInsertStatement(table: string, columns: Record<string, unknown>): { sql: string; values: unknown[] } | null {
  const keys = Object.keys(columns);
  if (keys.length === 0) return null;
  const placeholders = keys.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    values: keys.map((key) => columns[key]),
  };
}

function buildUpdateStatement(table: string, columns: Record<string, unknown>, whereKey: string): { sql: string; values: unknown[] } | null {
  const keys = Object.keys(columns);
  if (keys.length === 0) return null;
  const assignments = keys.map((key) => `${key} = ?`).join(', ');
  return {
    sql: `UPDATE ${table} SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE ${whereKey} = ?`,
    values: keys.map((key) => columns[key]),
  };
}

function listingRowToRecord(row: Record<string, any>): { id: string; fields: Record<string, unknown> } {
  return {
    id: String(row.id),
    fields: {
      submitted_at: row.submitted_at ?? null,
      source: row.source ?? null,
      url: row.url ?? null,
      status: row.status ?? null,
      title: row.title ?? null,
      price_asking: row.price_asking ?? null,
      location: row.location ?? null,
      description: row.description ?? null,
      photos: row.photos ?? null,
      ai_summary: row.ai_summary ?? null,
      ai_summary2: row.ai_summary2 ?? null,
      ai_summary3: row.ai_summary3 ?? null,
      ai_summary4: row.ai_summary4 ?? null,
      ai_summary5: row.ai_summary5 ?? null,
      ai_summary6: row.ai_summary6 ?? null,
      ai_summary7: row.ai_summary7 ?? null,
      ai_summary8: row.ai_summary8 ?? null,
      ai_summary9: row.ai_summary9 ?? null,
      ai_summary10: row.ai_summary10 ?? null,
      price_private_party: row.price_private_party ?? null,
      price_ideal: row.price_ideal ?? null,
      score: row.score ?? null,
      archived: row.archived ? true : false,
      saved: row.saved ? true : false,
      IsMulti: row.is_multi ? true : false,
      category: row.category ?? null,
      brand: row.brand ?? null,
      model: row.model ?? null,
      finish: row.finish ?? null,
      year: row.year ?? null,
      condition: row.condition ?? null,
      serial: row.serial ?? null,
      serial_brand: row.serial_brand ?? null,
      serial_year: row.serial_year ?? null,
      serial_model: row.serial_model ?? null,
      value_private_party_low: row.value_private_party_low ?? null,
      value_private_party_low_notes: row.value_private_party_low_notes ?? null,
      value_private_party_medium: row.value_private_party_medium ?? null,
      value_private_party_medium_notes: row.value_private_party_medium_notes ?? null,
      value_private_party_high: row.value_private_party_high ?? null,
      value_private_party_high_notes: row.value_private_party_high_notes ?? null,
      value_pawn_shop_notes: row.value_pawn_shop_notes ?? null,
      value_online_notes: row.value_online_notes ?? null,
      known_weak_points: row.known_weak_points ?? null,
      typical_repair_needs: row.typical_repair_needs ?? null,
      buyers_worry: row.buyers_worry ?? null,
      og_specs_pickups: row.og_specs_pickups ?? null,
      og_specs_tuners: row.og_specs_tuners ?? null,
      og_specs_common_mods: row.og_specs_common_mods ?? null,
      buyer_what_to_check: row.buyer_what_to_check ?? null,
      buyer_common_misrepresent: row.buyer_common_misrepresent ?? null,
      seller_how_to_price_realistic: row.seller_how_to_price_realistic ?? null,
      seller_fixes_add_value_or_waste: row.seller_fixes_add_value_or_waste ?? null,
      seller_as_is_notes: row.seller_as_is_notes ?? null,
    },
  };
}

function searchRowToRecord(row: Record<string, any>): { id: string; fields: Record<string, unknown> } {
  return {
    id: String(row.id),
    fields: {
      run_id: row.run_id ?? null,
      run_started_at: row.run_started_at ?? null,
      source: row.source ?? null,
      keyword: row.keyword ?? null,
      url: row.url ?? null,
      title: row.title ?? null,
      price: row.price ?? null,
      image_url: row.image_url ?? null,
      is_guitar: toBoolFromYesNo(row.is_guitar),
      is_sponsored: row.is_sponsored ? true : false,
      archived: row.archived ? true : false,
      ai_reason: row.ai_reason ?? null,
      seen_at: row.seen_at ?? null,
      ai_checked_at: row.ai_checked_at ?? null,
    },
  };
}

async function dbListListings(
  limit: number,
  offset: string | undefined,
  mode: 'default' | 'saved' | 'archived',
  env: Env
): Promise<{ records: ListingListItem[]; nextOffset?: string | null; total?: number } | null> {
  const offsetValue = offset ? Math.max(0, Number.parseInt(offset, 10) || 0) : 0;
  let whereClause = 'WHERE (archived IS NULL OR archived = 0) AND (saved IS NULL OR saved = 0)';
  if (mode === 'saved') {
    whereClause = 'WHERE (archived IS NULL OR archived = 0) AND saved = 1';
  } else if (mode === 'archived') {
    whereClause = 'WHERE archived = 1';
  }
  const totalResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM listings ${whereClause}`
  ).first<{ total: number }>();
  const total = typeof totalResult?.total === 'number' ? totalResult.total : 0;
  const result = await env.DB.prepare(
    `SELECT id, url, source, status, title, price_asking, score, saved
     FROM listings
     ${whereClause}
     ORDER BY
       CASE WHEN status = 'queued' THEN 1 ELSE 0 END ASC,
       COALESCE(submitted_at, created_at) DESC,
       id DESC
     LIMIT ? OFFSET ?`
  )
    .bind(limit, offsetValue)
    .all<{
      id: number;
      url: string | null;
      source: string | null;
      status: string | null;
      title: string | null;
      price_asking: number | string | null;
      score: number | string | null;
    }>();

  const records = (result.results ?? []).map((row) => ({
    id: String(row.id),
    url: row.url ?? '',
    source: row.source ?? '',
    status: row.status ?? '',
    title: row.title ?? '',
    askingPrice: row.price_asking ?? null,
    score: row.score ?? null,
    saved: row.saved ? true : false,
  }));

  const nextOffset = records.length === limit ? String(offsetValue + limit) : null;
  return { records, nextOffset, total };
}

async function dbGetListing(recordId: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return null;
  const row = await env.DB.prepare('SELECT * FROM listings WHERE id = ?')
    .bind(idValue)
    .first<Record<string, any>>();
  return row ? listingRowToRecord(row) : null;
}

async function dbFindListingByUrl(url: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const row = await env.DB.prepare('SELECT * FROM listings WHERE url = ? LIMIT 1')
    .bind(url)
    .first<Record<string, any>>();
  return row ? listingRowToRecord(row) : null;
}

async function dbCreateListing(fields: Record<string, unknown>, env: Env): Promise<string | null> {
  const columns = listingFieldsToColumns(fields);
  const insert = buildInsertStatement('listings', columns);
  if (!insert) return null;
  const result = await env.DB.prepare(insert.sql).bind(...insert.values).run();
  return result.meta?.last_row_id ? String(result.meta.last_row_id) : null;
}

async function dbUpdateListing(recordId: string, fields: Record<string, unknown>, env: Env): Promise<void> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return;
  const columns = listingFieldsToColumns(fields);
  const update = buildUpdateStatement('listings', columns, 'id');
  if (!update) return;
  await env.DB.prepare(update.sql).bind(...update.values, idValue).run();
}

async function dbSetListingArchived(recordId: string, archived: boolean, env: Env): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  await env.DB.prepare(
    'UPDATE listings SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(archived ? 1 : 0, idValue)
    .run();
  return true;
}

async function dbSearchResults(
  runId: string,
  includeAll: boolean,
  env: Env
): Promise<{ records: any[] } | null> {
  const clause = includeAll ? '' : 'AND (archived IS NULL OR archived = 0)';
  const result = await env.DB.prepare(
    `SELECT * FROM search_results
     WHERE run_id = ?
     ${clause}
     ORDER BY seen_at DESC, id DESC`
  )
    .bind(runId)
    .all<Record<string, any>>();
  const records = (result.results ?? []).map((row) => searchRowToRecord(row));
  return { records };
}

async function dbSearchFindByUrl(url: string, env: Env): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const row = await env.DB.prepare('SELECT * FROM search_results WHERE url = ? LIMIT 1')
    .bind(url)
    .first<Record<string, any>>();
  return row ? searchRowToRecord(row) : null;
}

async function dbSearchGet(recordId: string, env: Env): Promise<{ id: string; fields: Record<string, any> } | null> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return null;
  const row = await env.DB.prepare('SELECT * FROM search_results WHERE id = ?')
    .bind(idValue)
    .first<Record<string, any>>();
  return row ? searchRowToRecord(row) : null;
}

async function dbSearchCreateBatch(fieldsList: Record<string, unknown>[], env: Env): Promise<void> {
  if (fieldsList.length === 0) return;
  const statements = fieldsList
    .map((fields) => {
      const columns = searchFieldsToColumns(fields);
      const keys = Object.keys(columns);
      if (keys.length === 0) return null;
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT OR IGNORE INTO search_results (${keys.join(', ')}) VALUES (${placeholders})`;
      const values = keys.map((key) => columns[key]);
      return env.DB.prepare(sql).bind(...values);
    })
    .filter((statement): statement is D1PreparedStatement => Boolean(statement));
  if (statements.length === 0) return;
  await env.DB.batch(statements);
}

async function dbSearchUpdate(recordId: string, fields: Record<string, unknown>, env: Env): Promise<void> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return;
  const columns = searchFieldsToColumns(fields);
  const update = buildUpdateStatement('search_results', columns, 'id');
  if (!update) return;
  await env.DB.prepare(update.sql).bind(...update.values, idValue).run();
}

async function dbSearchSetArchivedState(recordId: string, archived: boolean, env: Env): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  await env.DB.prepare(
    'UPDATE search_results SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(archived ? 1 : 0, idValue)
    .run();
  return true;
}

async function dbSearchListPending(limit: number, env: Env): Promise<Array<{ id: string; fields: Record<string, any> }>> {
  const result = await env.DB.prepare(
    `SELECT * FROM search_results
     WHERE (archived IS NULL OR archived = 0)
       AND (is_guitar IS NULL OR is_guitar = '' OR is_guitar = 'Unsure')
     ORDER BY seen_at DESC, id DESC
     LIMIT ?`
  )
    .bind(limit)
    .all<Record<string, any>>();
  return (result.results ?? []).map((row) => searchRowToRecord(row));
}

async function getIsMultiFromRecord(recordId: string, env: Env): Promise<boolean> {
  const record = await dbGetListing(recordId, env);
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
  const title = pickString(
    item.listingTitle,
    item.title?.text,
    item.title,
    item.name?.text,
    item.name,
    item.heading,
    item.marketplaceListingTitle,
    item.marketplace_listing_title,
    item.custom_title,
    item.listing_title,
    item.listing?.title,
    item.listing?.marketplaceListingTitle
  );
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
    item.listing_price?.formatted_amount,
    item.listing_price?.amount,
    item.listing_price?.amount_with_offset_in_currency,
    item.listingPrice?.formatted_amount_zeros_stripped,
    item.listingPrice?.amount,
    item.price,
    item.priceFormatted,
    item.priceText,
    item.priceAmount,
    item.priceRange
  );
  const location = pickLocation(
    item.location?.reverse_geocode?.city,
    item.location?.reverse_geocode?.city_page?.display_name,
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
      item.listingUrl,
      item.facebookUrl,
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
    item.primary_listing_photo,
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
    } else if (candidate?.photo_image_url) {
      images.push(candidate.photo_image_url);
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

function isMostlyGeneric(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('general:')) return true;
  if (normalized.length < 30) return true;
  const genericPhrases = [
    'electronics',
    'hardware',
    'setup',
    'cleaning',
    'neck straightness',
    'fret wear',
    'general',
  ];
  const hitCount = genericPhrases.filter((phrase) => normalized.includes(phrase)).length;
  return hitCount >= 3;
}

function needsSpecificity(aiData: SingleAiResult | undefined): boolean {
  if (!aiData) return false;
  return SPECIFIC_FIELDS.some((field) => isMostlyGeneric(normalizeText(aiData[field], '')));
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
  const timestamp = new Date().toISOString();
  const fields = {
    submitted_at: timestamp,
    source: formatSourceLabel(source),
    url,
    status: 'queued',
    IsMulti: isMulti,
  };

  try {
    const recordId = await dbCreateListing(fields, env);
    if (recordId) {
      await env.LISTING_JOBS.put(runId, recordId);
    }
  } catch (error) {
    console.error('D1 create failed', { error });
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
  try {
    const recordId = options?.recordId ?? await env.LISTING_JOBS.get(runId);
    if (!recordId) {
      console.error('D1 update failed: record not found for run_id', { runId });
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
          og_specs_pickups: normalizeText(updates.aiData.og_specs_pickups, 'Unknown'),
          og_specs_tuners: normalizeText(updates.aiData.og_specs_tuners, 'Unknown'),
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
    await dbUpdateListing(recordId, fields, env);
    if (aiFields && !isMulti) {
      await dbUpdateListing(recordId, aiFields, env);
    }
  } catch (error) {
    console.error('D1 update failed', { error });
    throw error;
  }
}


async function classifyPendingSearchResults(env: Env, limit: number): Promise<{ processed: number; updated: number }> {
  if (!env.OPENAI_API_KEY) {
    console.warn('OpenAI key missing; skipping radar classify.');
    return { processed: 0, updated: 0 };
  }

  const records = await dbSearchListPending(limit, env);
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

    await dbSearchUpdate(record.id, {
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

  const systemPrompt = buildSystemPrompt(isMulti);
  const userPrompt = buildMainUserPrompt(listing, isMulti, CATEGORY_OPTIONS, CONDITION_OPTIONS);

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
    if (needsSpecificity(parsed)) {
      const refined = await runOpenAISpecifics(listing, parsed, env);
      return { kind: 'single', data: refined };
    }
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

async function runOpenAISpecifics(listing: ListingData, base: SingleAiResult, env: Env): Promise<SingleAiResult> {
  if (!env.OPENAI_API_KEY) return base;
  const prompt = buildSpecificsPrompt(listing, base, SPECIFIC_FIELDS, DEFAULT_TEXT);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      temperature: 0.2,
      max_output_tokens: 1200,
      text: {
        format: {
          type: 'json_schema',
          name: 'specific_fields',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              ...SPECIFIC_FIELDS.reduce((acc, key) => {
                acc[key] = { type: 'string' };
                return acc;
              }, {} as Record<string, { type: 'string' }>),
              og_specs_pickups: { type: 'string' },
              og_specs_tuners: { type: 'string' },
            },
            required: [...SPECIFIC_FIELDS, 'og_specs_pickups', 'og_specs_tuners'],
          },
        },
      },
    }),
  });

  if (!response.ok) return base;
  const data = await response.json();
  const text = extractOpenAIText(data);
  try {
    const refined = JSON.parse(text) as Partial<SingleAiResult>;
    const refinedPickups =
      typeof refined.og_specs_pickups === 'string' ? refined.og_specs_pickups.trim() : '';
    if (!refinedPickups || refinedPickups.toLowerCase() === 'unknown') {
      refined.og_specs_pickups = base.og_specs_pickups || 'Unknown';
    }
    const refinedTuners =
      typeof refined.og_specs_tuners === 'string' ? refined.og_specs_tuners.trim() : '';
    if (!refinedTuners || refinedTuners.toLowerCase() === 'unknown') {
      refined.og_specs_tuners = base.og_specs_tuners || 'Unknown';
    }
    return { ...base, ...refined };
  } catch {
    return base;
  }
}

function stripEmptyFallback(fallback: Partial<SingleAiResult>): Partial<SingleAiResult> {
  const cleaned: Partial<SingleAiResult> = {};
  for (const [key, value] of Object.entries(fallback)) {
    if (value == null) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    (cleaned as Record<string, unknown>)[key] = value;
  }
  return cleaned;
}

async function runOpenAIPrivatePartyPricing(
  listing: ListingData,
  base: SingleAiResult,
  env: Env
): Promise<Partial<SingleAiResult> | null> {
  if (!env.OPENAI_API_KEY) return null;

  const redactedListing: ListingData = {
    title: redactPricingInput(listing.title || ''),
    description: redactPricingInput(listing.description || ''),
    location: listing.location || '',
  };
  const prompt = buildSinglePricingPrompt(redactedListing, base);

  const content: any[] = [{ type: 'input_text', text: prompt }];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content }],
      temperature: 0.2,
      max_output_tokens: 800,
      text: {
        format: {
          type: 'json_schema',
          name: 'private_party_fallback',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              value_private_party_low: { type: ['number', 'string', 'null'] },
              value_private_party_low_notes: { type: 'string' },
              value_private_party_medium: { type: ['number', 'string', 'null'] },
              value_private_party_medium_notes: { type: 'string' },
              value_private_party_high: { type: ['number', 'string', 'null'] },
              value_private_party_high_notes: { type: 'string' },
            },
            required: [
              'value_private_party_low',
              'value_private_party_low_notes',
              'value_private_party_medium',
              'value_private_party_medium_notes',
              'value_private_party_high',
              'value_private_party_high_notes',
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const text = extractOpenAIText(data);
  try {
    const parsed = JSON.parse(text) as Partial<SingleAiResult>;
    return parsed;
  } catch {
    return null;
  }
}

async function runOpenAIMultiRangePricing(
  listing: ListingData,
  aiSummary: string,
  env: Env
): Promise<{ low: number; high: number } | null> {
  if (!env.OPENAI_API_KEY) return null;

  const redactedListing: ListingData = {
    title: redactPricingInput(listing.title || ''),
    description: redactPricingInput(listing.description || ''),
    location: listing.location || '',
  };
  const redactedSummary = redactPricingInput(aiSummary || '');
  const prompt = buildMultiPricingPrompt(redactedListing, redactedSummary);

  const content: any[] = [{ type: 'input_text', text: prompt }];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [{ role: 'user', content }],
      temperature: 0.2,
      max_output_tokens: 600,
      text: {
        format: {
          type: 'json_schema',
          name: 'multi_range_pricing',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              used_market_low_total: { type: ['number', 'string', 'null'] },
              used_market_high_total: { type: ['number', 'string', 'null'] },
            },
            required: ['used_market_low_total', 'used_market_high_total'],
          },
        },
      },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const text = extractOpenAIText(data);
  try {
    const parsed = JSON.parse(text) as { used_market_low_total?: unknown; used_market_high_total?: unknown };
    const low = normalizeMoneyValue(parsed.used_market_low_total);
    const high = normalizeMoneyValue(parsed.used_market_high_total);
    if (low == null || high == null) return null;
    return low <= high ? { low, high } : { low: high, high: low };
  } catch {
    return null;
  }
}

function applyMultiRangeToSummary(aiSummary: string, low: number, high: number): string {
  const withTotals = ensureMultiTotals(aiSummary);
  const line = `- Used market range for all: ${formatCurrency(low)} to ${formatCurrency(high)}`;
  if (/- Used market range for all:[^\n]*/i.test(withTotals)) {
    return withTotals.replace(/- Used market range for all:[^\n]*/i, line);
  }
  return `${withTotals.trim()}\n${line}`.trim();
}

function redactPriceSignals(input: string): string {
  if (!input) return input;

  let output = input;

  // Remove explicit currency symbols with numbers.
  output = output.replace(/\$\s*\d[\d,]*(?:\.\d{1,2})?/g, '[price]');

  // Remove common price tags.
  output = output.replace(/\b(?:usd|dollars?)\s*\d[\d,]*(?:\.\d{1,2})?\b/gi, '[price]');
  output = output.replace(/\b\d[\d,]*(?:\.\d{1,2})?\s*(?:usd|dollars?)\b/gi, '[price]');

  // Remove numbers when clearly tied to price terms.
  output = output.replace(
    /\b(?:price|asking|ask|obo|or best offer|firm)\b[^.\n]*?\b(\d{2,5})\b/gi,
    (match) => match.replace(/\b\d{2,5}\b/g, '[price]')
  );
  output = output.replace(
    /\b(\d{2,5})\b[^.\n]*?\b(?:price|asking|ask|obo|or best offer|firm)\b/gi,
    (match) => match.replace(/\b\d{2,5}\b/g, '[price]')
  );

  // Remove "X OBO" / "X firm" style patterns.
  output = output.replace(/\b\d{2,5}\b\s*(?:obo|firm|negotiable)\b/gi, '[price]');

  return output;
}

function redactPricingInput(input: string): string {
  if (!input) return input;
  let output = redactPriceSignals(input);

  // Remove any remaining standalone 2-5 digit numbers to avoid price leakage.
  output = output.replace(/\b\d{2,5}\b/g, '[num]');

  return output;
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
