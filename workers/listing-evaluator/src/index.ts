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
  RADAR_FB_SEARCH_URL?: string;
  RADAR_CL_SEARCH_URL?: string;
  RADAR_KEYWORDS?: string;
  TELNYX_API_KEY?: string;
  TELNYX_FROM_NUMBER?: string;
  TELNYX_TO_NUMBER?: string;
  LISTING_JOBS: KVNamespace;
}

interface SubmitPayload {
  urls: string[];
}

interface QueueResult {
  url: string;
  source?: string;
  runId?: string;
  row?: number;
  unarchived?: boolean;
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
const MST_OFFSET_MINUTES = -7 * 60;
const RADAR_QUIET_START_HOUR = 23;
const RADAR_QUIET_END_HOUR = 6;
const RADAR_DEFAULT_PAGE = '/listing-radar.html';

const SUPPORTED_ORIGINS = [
  'https://www.coalcreekguitars.com',
  'http://localhost:3000',
  'http://localhost:8080',
];

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

  const urls = rawUrls.map((url) => normalizeUrl(url)).filter(Boolean) as string[];
  const uniqueUrls = Array.from(new Set(urls)).slice(0, MAX_URLS);

  const accepted: QueueResult[] = [];
  const rejected: RejectResult[] = [];

  for (const url of uniqueUrls) {
    const resolvedUrl = await resolveFacebookShareUrl(url);
    const source = detectSource(resolvedUrl);
    if (!source) {
      rejected.push({ url, reason: 'Unsupported URL. Use Craigslist or Facebook Marketplace.' });
      continue;
    }

    accepted.push({ url: resolvedUrl, source });
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

    await insertQueuedRow(item.url, item.source as ListingSource, runId, env);

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

type RadarResult = {
  matched: number;
  saved: number;
  smsSent: number;
  summary: string;
};

async function runRadarScan(env: Env): Promise<RadarResult> {
  const keywords = parseRadarKeywords(env.RADAR_KEYWORDS);
  const fbUrl = env.RADAR_FB_SEARCH_URL;
  const clUrl = env.RADAR_CL_SEARCH_URL;
  if (!fbUrl || !clUrl) {
    console.warn('Radar search URLs missing.');
    return { matched: 0, saved: 0, smsSent: 0, summary: 'Radar search URLs missing.' };
  }

  const runId = generateRunId();
  const runStartedAt = formatMountainTimestamp(new Date());
  const allListings: ListingCandidate[] = [];
  let consecutiveSeen = 0;

  for (const keyword of keywords) {
    const fbInput = buildFacebookSearchInput(fbUrl, keyword);
    const clInput = buildCraigslistSearchInput(clUrl, keyword);

    const [fbItems, clItems] = await Promise.all([
      runApifySearch(env.APIFY_FACEBOOK_ACTOR, fbInput, env),
      runApifySearch(env.APIFY_CRAIGSLIST_ACTOR, clInput, env),
    ]);

    allListings.push(...normalizeSearchItems(fbItems, 'facebook', keyword));
    allListings.push(...normalizeSearchItems(clItems, 'craigslist', keyword));
  }

  const unique = dedupeCandidates(allListings);
  const scored: ScoredListing[] = [];

  for (const candidate of unique) {
    if (candidate.isSponsored) {
      continue;
    }

    if (!candidate.url) continue;
    const existing = await airtableSearchFindByUrl(candidate.url, env);
    if (existing) {
      consecutiveSeen += 1;
      if (consecutiveSeen >= RADAR_CONSECUTIVE_SEEN_LIMIT) {
        break;
      }
      continue;
    }

    consecutiveSeen = 0;

    const isGuitarResult = await runIsGuitar(candidate, env);
    if (!isGuitarResult) continue;

    const created = await airtableSearchCreate(candidate, isGuitarResult, runId, runStartedAt, env);
    if (created) {
      scored.push({ ...candidate, isGuitar: isGuitarResult.isGuitar, reason: isGuitarResult.reason });
    }
  }

  const guitarListings = scored.filter((listing) => listing.isGuitar);
  const smsSent = await sendRadarSms(runId, guitarListings.length, env);
  const summary = `Radar run ${runId}: ${unique.length} candidates, ${scored.length} new, ${guitarListings.length} guitars, ${smsSent} SMS.`;

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
    resultsLimit: 20,
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

async function runApifySearch(actorId: string, input: Record<string, unknown>, env: Env): Promise<any[]> {
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
    return [];
  }

  const data = await response.json();
  const run = data?.data || data;
  if (!run?.id) return [];
  if (run?.status && run.status !== 'SUCCEEDED') {
    console.warn('Apify search run not complete', { runId: run.id, status: run.status });
  }

  const datasetId = run?.defaultDatasetId;
  if (!datasetId) return [];
  return await fetchApifyDataset(datasetId, env);
}

function normalizeSearchItems(items: any[], source: ListingSource, keyword: string): ListingCandidate[] {
  return items.map((item) => {
    const normalized = normalizeListing(item);
    return {
      source,
      keyword,
      title: normalized.title,
      price: normalized.price,
      location: normalized.location,
      images: normalized.images,
      url: normalized.url,
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
  if (!guitarMatch) return null;
  const reasonMatch = text.match(/Reason:\s*(.+)/i);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided.';
  return {
    isGuitar: guitarMatch[1].toUpperCase() === 'YES',
    reason,
  };
}

async function airtableSearchCreate(
  listing: ListingCandidate,
  isGuitarResult: { isGuitar: boolean; reason: string },
  runId: string,
  runStartedAt: string,
  env: Env
): Promise<string | null> {
  const priceValue = listing.price ? parseMoney(listing.price) : null;
  const fields: Record<string, unknown> = {
    run_id: runId,
    run_started_at: runStartedAt,
    source: formatSourceLabel(listing.source),
    keyword: listing.keyword,
    url: listing.url ?? null,
    title: listing.title ?? null,
    price: priceValue ?? null,
    image_url: listing.images[0] ?? null,
    is_guitar: isGuitarResult.isGuitar,
    ai_reason: isGuitarResult.reason,
    is_sponsored: listing.isSponsored ?? false,
    archived: false,
    seen_at: formatMountainTimestamp(new Date()),
    ai_checked_at: formatMountainTimestamp(new Date()),
  };

  return await airtableSearchCreateRow(fields, env);
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

async function sendTelnyxMessage(text: string, env: Env): Promise<boolean> {
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
    return false;
  }

  return true;
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

  ctx.waitUntil(processRun(runId, resource, eventType, env));

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
  const aiResponse = await runOpenAI(listing, env);

  await updateRowByRunId(runId, {
    runId,
    status: 'complete',
    title: listing.title,
    price: listing.price,
    location: listing.location,
    condition: listing.condition,
    description: listing.description,
    photos: listing.images.join('\n'),
    aiSummary: aiResponse,
    notes: listing.notes,
  }, env);
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
    url: item.url || item.listingUrl,
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

async function fetchApifyDataset(datasetId: string, env: Env): Promise<any[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${env.APIFY_TOKEN}&clean=true&format=json`);
  if (!response.ok) return [];
  return await response.json();
}

async function insertQueuedRow(url: string, source: ListingSource, runId: string, env: Env): Promise<void> {
  const timestamp = formatMountainTimestamp(new Date());
  const fields = {
    submitted_at: timestamp,
    source: formatSourceLabel(source),
    url,
    status: 'queued',
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
  notes?: string;
}, env: Env): Promise<void> {
  const timestamp = new Date().toISOString();

  try {
    const recordId = await env.LISTING_JOBS.get(runId);
    if (!recordId) {
      console.error('Airtable update failed: record not found for run_id', { runId });
      return;
    }

  const privateParty = updates.aiSummary ? extractPrivatePartyRange(updates.aiSummary) : null;
  const listedPrice = updates.price ? parseMoney(updates.price) : null;
  const aiAsking = updates.aiSummary ? extractAskingFromSummary(updates.aiSummary) : null;
  const aiScore = updates.aiSummary ? extractScoreFromSummary(updates.aiSummary) : null;
  const asking = chooseAskingPrice(listedPrice, aiAsking, updates.description ?? '', updates.aiSummary ?? '');
  const ideal = privateParty?.low != null ? Math.round(privateParty.low * 0.8) : null;
  const computedScore = privateParty && asking != null ? computeScore(asking, privateParty.low, privateParty.high) : null;
  const score = aiScore ?? computedScore;
  const fields: Record<string, unknown> = {
    status: updates.status ?? null,
    title: updates.title ?? null,
    price_asking: asking ?? null,
    location: updates.location ?? null,
    description: updates.description ?? null,
    photos: updates.photos ?? null,
    ai_summary: updates.aiSummary ?? null,
    price_private_party: privateParty ? formatRange(privateParty.low, privateParty.high) : null,
    price_ideal: ideal ?? null,
    };
    if (score !== null) {
      fields.score = score;
    }

    await airtableUpdate(recordId, fields, env);
  } catch (error) {
    console.error('Airtable update failed', { error });
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
    filters.push('{is_guitar}');
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

function isArchivedValue(value: unknown): boolean {
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

function extractAskingFromSummary(aiSummary: string): number | null {
  const match = aiSummary.match(/Asking price \(from listing text\):\s*\$?([\d,]+)/i);
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

function chooseAskingPrice(
  listed: number | null,
  aiAsking: number | null,
  description: string,
  aiSummary: string
): number | null {
  if (listed == null && aiAsking == null) return null;
  if (listed == null) return aiAsking;

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

async function runOpenAI(listing: ListingData, env: Env): Promise<string> {
  const maxImages = Number.parseInt(env.MAX_IMAGES || '3', 10);
  const images = listing.images.slice(0, Number.isFinite(maxImages) ? maxImages : 3);

  const systemPrompt = `You are an expert used gear buyer and appraiser focused on music gear. Produce a concise valuation with the exact format below. If details are missing, be clear about uncertainty and suggest the specific photo or detail needed. Avoid hype. When listings include multiple items, identify each item and provide a price breakdown per item. Always state the asking price you infer from the listing text.`;

  const userPrompt = `Listing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nAsking price: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\n\nProvide the response in this format using plain bullet points (no extra dashes or nested bullet markers):\n\nWhat it appears to be\n- Make/model/variant\n- Estimated year or range (if possible; otherwise \"Year: Not enough info\")\n- Estimated condition from photos (or \"Condition from photos: Inconclusive\")\n- Notable finish/features\n\nReal-world value (used market)\n- Typical private-party value: $X–$Y\n- Music store pricing: $X–$Y\n\n- Adds Value: include one specific, model-relevant value add if it exists; avoid generic condition/finish statements; otherwise omit this line entirely\n\nNew Price (output exactly one line)\n- $X (append \"(no longer available)\" if discontinued); or \"Unknown\" if you cannot determine\n\nScore\n- Score: X/10 (resell potential based on ask vs realistic value, condition, and included extras)\n\nBottom line\n- Realistic value range\n- Buy/skip note\n- Any missing info to tighten valuation\n`;

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
      max_output_tokens: 700,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI response failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return 'AI analysis failed.';
  }

  const data = await response.json();
  return extractOpenAIText(data) || 'AI analysis returned no text.';
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
