import type { Env } from '../env.js';
import { normalizeText, normalizeUrl } from '../utils/text.js';

type ListingSource = 'facebook' | 'craigslist' | 'reverb';

export function pickLocation(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      const trimmed = value.trim();
      if (isPriceLike(trimmed)) continue;
      return trimmed;
    }
  }
  return '';
}

export function isPriceLike(input: string): boolean {
  if (!input) return false;
  const normalized = input.replace(/\s+/g, '');
  if (/^\$?[\d,]+(?:\.\d{1,2})?$/.test(normalized)) {
    return true;
  }
  return false;
}

export function isFacebookShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('facebook.com')) return false;
    return parsed.pathname.startsWith('/share/');
  } catch {
    return false;
  }
}

export function extractFacebookRedirectTarget(url: string): string | null {
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

export async function fetchFacebookShare(
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

export async function resolveFromResponse(response: Response, fallbackUrl: string): Promise<string> {
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

export function buildFacebookApifyInput(url: string): Record<string, unknown> {
  return {
    startUrls: [{ url }],
    resultsLimit: 1,
    includeListingDetails: true,
  };
}

export function normalizeFacebookItemUrl(url: string): string | null {
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

export async function startApifyRun(url: string, source: ListingSource, env: Env, recordId?: string | null): Promise<string | null> {
  if (source === 'reverb') return null;
  const actorId = source === 'facebook' ? env.APIFY_FACEBOOK_ACTOR : env.APIFY_CRAIGSLIST_ACTOR;
  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const webhookUrl = new URL('/api/listings/webhook', baseUrl);
  if (env.WEBHOOK_SECRET) {
    webhookUrl.searchParams.set('key', env.WEBHOOK_SECRET);
  }
  if (recordId) {
    webhookUrl.searchParams.set('recordId', recordId);
  }

  const webhookPayload = [{
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
    requestUrl: webhookUrl.toString(),
    payloadTemplate: '{"resource":{{resource}},"eventType":"{{eventType}}"}',
  }];

  const webhooksParam = btoa(JSON.stringify(webhookPayload));

  const input = source === 'facebook'
    ? buildFacebookApifyInput(url)
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

export async function fetchApifyRun(runId: string, env: Env): Promise<any | null> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${env.APIFY_TOKEN}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data?.data || data;
}

export async function abortApifyRun(runId: string, env: Env): Promise<void> {
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

export async function waitForApifyRun(runId: string, env: Env, attempts: number): Promise<any | null> {
  let current = await fetchApifyRun(runId, env);
  let remaining = attempts;
  while (remaining > 0 && current && current.status && current.status !== 'SUCCEEDED' && current.status !== 'FAILED') {
    await delay(2000);
    remaining -= 1;
    current = await fetchApifyRun(runId, env);
  }
  return current;
}

export async function processApifyRunWhenReady(runId: string, env: Env, recordId: string): Promise<void> {
  try {
    await env.LISTING_JOBS.put(runId, recordId);
    const runDetails = await waitForApifyRun(runId, env, 20);
    const status = normalizeText(runDetails?.status, '');
    if (status !== 'SUCCEEDED' && status !== 'FAILED') {
      console.warn('Apify run not finished during submit fallback', { runId, recordId, status });
      return;
    }
    await processRun(runId, runDetails, status, env);
  } catch (error) {
    console.error('Apify submit fallback processing failed', { runId, recordId, error });
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchApifyDataset(datasetId: string, env: Env): Promise<any[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${env.APIFY_TOKEN}&clean=true&format=json`);
  if (!response.ok) return [];
  return await response.json();
}

function detectSource(url: string): ListingSource | null {
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

// Forward reference for processApifyRunWhenReady — processRun is in process.ts
import { processRun } from './process.js';
