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
}

interface RejectResult {
  url: string;
  reason: string;
}

const MAX_URLS = 20;

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

    if (url.pathname === '/api/listings/submit' && request.method === 'POST') {
      const response = await handleSubmit(request, env, ctx);
      return withCors(response, request, env);
    }

    if (url.pathname === '/api/listings/webhook' && request.method === 'POST') {
      const response = await handleWebhook(request, env, ctx);
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

  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
    const source = detectSource(url);
    if (!source) {
      rejected.push({ url, reason: 'Unsupported URL. Use Craigslist or Facebook Marketplace.' });
      continue;
    }

    accepted.push({ url, source });
  }

  const results: QueueResult[] = [];

  for (const item of accepted) {
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
  const title = pickString(item.title, item.name, item.heading);
  const description = pickString(
    item.description,
    item.details,
    item.body,
    item.text,
    item.postingBody,
    item.posting_body,
    item.desc,
    item.summary
  );
  const price = pickString(item.price, item.priceFormatted, item.priceText, item.priceAmount, item.priceRange);
  const location = pickString(item.location, item.locationText, item.where, item.city, item.region);
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
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => {
        if (typeof entry === 'string') images.push(entry);
        if (entry?.url) images.push(entry.url);
        if (entry?.imageUrl) images.push(entry.imageUrl);
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
    if (parsed.hostname.includes('facebook.com') && parsed.pathname.includes('/marketplace')) return 'facebook';
    return null;
  } catch {
    return null;
  }
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
  const timestamp = new Date().toISOString();
  const fields = {
    submitted_at: timestamp,
    source,
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

    const score = updates.aiSummary ? extractScore(updates.aiSummary) : null;
    const fields: Record<string, unknown> = {
      status: updates.status ?? null,
      title: updates.title ?? null,
      price: updates.price ?? null,
      location: updates.location ?? null,
      description: updates.description ?? null,
      ai_summary: updates.aiSummary ?? null,
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

function extractScore(aiSummary: string): number | null {
  const match = aiSummary.match(/score\s*[:\-]?\s*(\d{1,2})(?:\s*\/\s*10)?/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.min(10, value));
}

async function runOpenAI(listing: ListingData, env: Env): Promise<string> {
  const maxImages = Number.parseInt(env.MAX_IMAGES || '3', 10);
  const images = listing.images.slice(0, Number.isFinite(maxImages) ? maxImages : 3);

  const systemPrompt = `You are an expert used gear buyer and appraiser focused on music gear. Produce a concise valuation with the exact format below. If details are missing, be clear about uncertainty and suggest the specific photo or detail needed. Avoid hype. When listings include multiple items, identify each item and provide a price breakdown per item.`;

  const userPrompt = `Listing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nAsking price: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\n\nProvide the response in this format:\n\nWhat it appears to be\n- bullet points\n\nReal-world value (used market)\n- Typical private-party value: $X–$Y\n- Music store pricing: $X–$Y\n- Quick verdict on the asking price\n\nWhat affects the price\nAdds value\n- bullets\nHurts value\n- bullets\n\nComparison (for context)\n- bullets\n\nScore\n- Score: X/10 (resell potential based on ask vs realistic value, condition, and included extras)\n\nBottom line\n- Realistic value range\n- Buy/skip note\n- Any missing info to tighten valuation\n`;

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
