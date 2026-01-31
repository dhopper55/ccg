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

    return withCors(new Response('Not found', { status: 404 }), request, env);
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
  params.append('filterByFormula', 'NOT({archived})');
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
