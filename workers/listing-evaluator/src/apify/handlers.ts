import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { normalizeListing, pickImages, processRun } from './process.js';
import { pickLocation, fetchApifyRun, fetchApifyDataset, waitForApifyRun, startApifyRun } from './handlers2.js';

export type ApifyRunResult = {
  runId?: string;
  items: any[];
};

export async function startApifySearchRun(actorId: string, input: Record<string, unknown>, env: Env): Promise<string | null> {
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

export async function runApifySearch(actorId: string, input: Record<string, unknown>, env: Env): Promise<ApifyRunResult> {
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

export async function handleWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
  const recordId = normalizeText(url.searchParams.get('recordId'), '');

  if (!runId) {
    return jsonResponse({ message: 'Missing run ID.' }, 400);
  }

  if (recordId) {
    await env.LISTING_JOBS.put(runId, recordId);
  }

  await processRun(runId, resource, eventType, env);
  return jsonResponse({ ok: true });
}

export async function handleYoutubeVideos(): Promise<Response> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CCG_YOUTUBE_CHANNEL_ID)}`;
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Coal Creek Guitars video feed fetcher',
      'Accept': 'application/atom+xml, application/xml, text/xml',
    },
    cf: {
      cacheTtl: 900,
      cacheEverything: true,
    },
  } as RequestInit);

  if (!response.ok) {
    return jsonResponse({ message: 'Unable to load YouTube videos.' }, 502);
  }

  const xml = await response.text();
  const records = parseYoutubeVideoFeed(xml).slice(0, 12);

  return jsonResponse(
    { records },
    200,
    { 'Cache-Control': 'public, max-age=900' },
  );
}

export function parseYoutubeVideoFeed(xml: string): Array<{
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  videoUrl: string;
}> {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/g) || [];

  return entries
    .map((entry) => {
      const id = decodeXmlEntity(extractXmlText(entry, 'yt:videoId'));
      const title = decodeXmlEntity(extractXmlText(entry, 'title'));
      const publishedAt = decodeXmlEntity(extractXmlText(entry, 'published'));
      const link = extractXmlAttribute(entry, 'link', 'href') || (id ? `https://www.youtube.com/watch?v=${id}` : '');
      const thumbnail = extractXmlAttribute(entry, 'media:thumbnail', 'url') || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');

      return {
        id,
        title,
        thumbnail,
        publishedAt,
        videoUrl: link,
      };
    })
    .filter((video) => video.id && video.title && video.videoUrl);
}

export function extractXmlText(xml: string, tagName: string): string {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escapedTagName}[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

export function extractXmlAttribute(xml: string, tagName: string, attributeName: string): string {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagMatch = xml.match(new RegExp(`<${escapedTagName}\\b[^>]*>`, 'i'));
  if (!tagMatch) return '';
  const attributeMatch = tagMatch[0].match(new RegExp(`${escapedAttributeName}="([^"]*)"`, 'i'));
  return attributeMatch ? decodeXmlEntity(attributeMatch[1]) : '';
}

export function decodeXmlEntity(value: string): string {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// CCG_YOUTUBE_CHANNEL_ID is defined in the main index.ts constants
declare const CCG_YOUTUBE_CHANNEL_ID: string;
