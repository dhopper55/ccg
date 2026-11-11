import type { Env } from '../env.js';
import { detectContentTypeFromBytes } from '../utils/image.js';
import { isAllowedImageHost } from '../listings/images.js';
import { bytesToBase64, extractR2Key } from './util.js';

// One photo to fetch: an R2 object (inventory uploads, listing photos copied to R2) or a
// Facebook / Craigslist CDN URL (listing photos as scraped).
export type PhotoSource = { r2Key: string } | { url: string; referer?: string };

export type PhotoResult =
  | { ok: true; index: number; mimeType: string; data: string; bytes: number; resized: boolean }
  | { ok: false; index: number; error: string };

const CLAUDE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_PHOTO_BYTES = 1_500_000; // per photo, after resizing (or as stored if resizing fails)
const MAX_TOTAL_BYTES = 4_500_000; // all photos in one tool result

// Turn the stored photo URLs of a listing or inventory item into fetchable sources. Anything
// that is neither one of our R2 keys nor an allowed marketplace CDN host is dropped.
export function photoSourcesFromUrls(urls: string[], referer?: string): PhotoSource[] {
  const sources: PhotoSource[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const text = (raw || '').trim().split(/\s+/)[0] || '';
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const key = extractR2Key(text);
    if (key) {
      sources.push({ r2Key: key });
      continue;
    }
    try {
      const parsed = new URL(text);
      if (parsed.protocol === 'https:' && isAllowedImageHost(parsed.hostname)) {
        sources.push({ url: parsed.toString(), referer });
      }
    } catch {
      // Not a URL: skip it.
    }
  }
  return sources;
}

// Fetch up to `max` photos as base64 for MCP image content. Each is resized to 1024 px on the
// long edge as JPEG through Cloudflare image resizing when that is available; otherwise the
// stored bytes are used if they are small enough. Failures are reported per photo.
export async function fetchPhotos(env: Env, sources: PhotoSource[], max: number): Promise<PhotoResult[]> {
  const results: PhotoResult[] = [];
  let total = 0;
  const selected = sources.slice(0, max);
  for (let index = 0; index < selected.length; index += 1) {
    const result = await fetchOnePhoto(env, selected[index], index);
    if (result.ok && total + result.data.length > MAX_TOTAL_BYTES) {
      results.push({ ok: false, index, error: 'skipped: the tool result would be too large; ask for fewer photos with max' });
      continue;
    }
    if (result.ok) total += result.data.length;
    results.push(result);
  }
  return results;
}

async function fetchOnePhoto(env: Env, source: PhotoSource, index: number): Promise<PhotoResult> {
  const publicUrl = 'r2Key' in source
    ? `${(env.SITE_BASE_URL || 'https://www.coalcreekguitars.com').replace(/\/+$/, '')}/api/img/${source.r2Key}`
    : source.url;
  const headers = new Headers({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  });
  if ('url' in source && source.referer) headers.set('Referer', source.referer);

  // 1. Resized through Cloudflare image resizing.
  try {
    const response = await fetch(publicUrl, {
      headers,
      cf: { image: { width: 1024, height: 1024, fit: 'scale-down', format: 'jpeg', quality: 80 } },
    } as RequestInit);
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mimeType = detectContentTypeFromBytes(bytes) || '';
      if (CLAUDE_IMAGE_TYPES.has(mimeType) && bytes.length <= MAX_PHOTO_BYTES) {
        return { ok: true, index, mimeType, data: bytesToBase64(bytes), bytes: bytes.length, resized: true };
      }
    }
  } catch {
    // Fall through to the stored bytes.
  }

  // 2. The stored bytes, if small enough.
  try {
    let bytes: Uint8Array | null = null;
    if ('r2Key' in source) {
      if (!env.CUSTOM_ITEMS_BUCKET) return { ok: false, index, error: 'image storage is not configured' };
      const object = await env.CUSTOM_ITEMS_BUCKET.get(source.r2Key);
      if (!object) return { ok: false, index, error: 'photo not found in storage' };
      bytes = new Uint8Array(await object.arrayBuffer());
    } else {
      const response = await fetch(source.url, { headers });
      if (!response.ok) {
        return { ok: false, index, error: `photo host returned ${response.status} (marketplace photo links expire)` };
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    const mimeType = detectContentTypeFromBytes(bytes) || '';
    if (!CLAUDE_IMAGE_TYPES.has(mimeType)) return { ok: false, index, error: `unsupported image type ${mimeType || 'unknown'}` };
    if (bytes.length > MAX_PHOTO_BYTES) {
      return { ok: false, index, error: `photo is ${(bytes.length / 1_000_000).toFixed(1)} MB and could not be resized` };
    }
    return { ok: true, index, mimeType, data: bytesToBase64(bytes), bytes: bytes.length, resized: false };
  } catch (error) {
    return { ok: false, index, error: error instanceof Error ? error.message : 'photo fetch failed' };
  }
}
