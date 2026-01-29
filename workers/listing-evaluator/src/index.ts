interface Env {
  OPENAI_API_KEY: string;
  APIFY_TOKEN: string;
  APIFY_FACEBOOK_ACTOR: string;
  APIFY_CRAIGSLIST_ACTOR: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  GOOGLE_SHEET_ID: string;
  GOOGLE_SHEET_RANGE: string;
  SITE_BASE_URL: string;
  MAX_IMAGES: string;
  WEBHOOK_SECRET?: string;
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

    const row = await appendQueuedRow(item.url, item.source as ListingSource, runId, env);

    if (row) {
      await env.LISTING_JOBS.put(runId, JSON.stringify({ row, url: item.url, source: item.source }));
    }

    results.push({ ...item, runId, row });
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
  const mapping = await env.LISTING_JOBS.get(runId, { type: 'json' }) as { row?: number; url?: string; source?: string } | null;
  if (!mapping?.row) {
    return;
  }

  if (eventType && eventType.includes('FAILED')) {
    await updateRow(mapping.row, {
      runId,
      status: 'failed',
      notes: 'Apify run failed.',
    }, env);
    return;
  }

  const runDetails = await fetchApifyRun(runId, env);
  const datasetId = resource?.defaultDatasetId || runDetails?.defaultDatasetId;

  if (!datasetId) {
    await updateRow(mapping.row, {
      runId,
      status: 'failed',
      notes: 'No dataset returned from scraper.',
    }, env);
    return;
  }

  const items = await fetchApifyDataset(datasetId, env);
  if (!items || items.length === 0) {
    await updateRow(mapping.row, {
      runId,
      status: 'failed',
      notes: 'Scraper returned no listing data.',
    }, env);
    return;
  }

  const listing = normalizeListing(items[0]);
  const aiResponse = await runOpenAI(listing, env);

  await updateRow(mapping.row, {
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
  const description = pickString(item.description, item.details, item.body, item.text);
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
        urls: [url],
        maxAge: 365,
      };

  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${env.APIFY_TOKEN}&webhooks=${encodeURIComponent(webhooksParam)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
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

async function appendQueuedRow(url: string, source: ListingSource, runId: string, env: Env): Promise<number | null> {
  const timestamp = new Date().toISOString();
  const values = [
    timestamp,
    source,
    url,
    'queued',
    runId,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const sheetRange = env.GOOGLE_SHEET_RANGE || 'Listings!A1';
  const response = await sheetsAppend(values, sheetRange, env);
  if (!response?.updates?.updatedRange) return null;
  return extractRowNumber(response.updates.updatedRange);
}

async function updateRow(row: number, updates: {
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

  const values = [
    updates.status || '',
    updates.runId || '',
    updates.title || '',
    updates.price || '',
    updates.location || '',
    updates.condition || '',
    updates.description || '',
    updates.photos || '',
    updates.aiSummary || '',
    updates.notes || '',
    timestamp,
  ];

  const sheetRange = env.GOOGLE_SHEET_RANGE || 'Listings!A1';
  const sheetName = sheetRange.split('!')[0];
  const targetRange = `${sheetName}!D${row}:N${row}`;

  await sheetsUpdate(values, targetRange, env);
}

async function sheetsAppend(values: string[], range: string, env: Env): Promise<any | null> {
  const token = await getGoogleAccessToken(env);
  if (!token) return null;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    }
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

async function sheetsUpdate(values: string[], range: string, env: Env): Promise<void> {
  const token = await getGoogleAccessToken(env);
  if (!token) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    }
  );
}

function extractRowNumber(range: string): number | null {
  const match = range.match(/!A(\d+):/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

async function getGoogleAccessToken(env: Env): Promise<string | null> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;

  let creds: any;
  try {
    creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const jwt = await signJwt(header, claimSet, creds.private_key);

  const formData = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.access_token || null;
}

async function signJwt(header: any, payload: any, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder();
  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerBase64}.${payloadBase64}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(data));
  const signatureBase64 = base64UrlEncode(signature);

  return `${data}.${signatureBase64}`;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }

  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function runOpenAI(listing: ListingData, env: Env): Promise<string> {
  const maxImages = Number.parseInt(env.MAX_IMAGES || '3', 10);
  const images = listing.images.slice(0, Number.isFinite(maxImages) ? maxImages : 3);

  const systemPrompt = `You are an expert used-guitar buyer and appraiser. Produce a concise valuation with the exact format below. If details are missing, be clear about uncertainty and suggest the specific photo or detail needed. Avoid hype.`;

  const userPrompt = `Listing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nAsking price: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\n\nProvide the response in this format:\n\nWhat it appears to be\n- bullet points\n\nReal-world value (used market)\n- Typical private-party value: $X–$Y\n- Music store pricing: $X–$Y\n- Quick verdict on the asking price\n\nWhat affects the price\nAdds value\n- bullets\nHurts value\n- bullets\n\nComparison (for context)\n- bullets\n\nBottom line\n- Realistic value range\n- Buy/skip note\n- Any missing info to tighten valuation\n`;

  const content: any[] = [{ type: 'input_text', text: userPrompt }];

  for (const imageUrl of images) {
    content.push({ type: 'input_image', image_url: imageUrl });
  }

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
