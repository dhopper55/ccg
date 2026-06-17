import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';

function detectContentTypeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'image/bmp';
  // HEIC/HEIF: bytes 4-7 = "ftyp", then brand "heic","heix","hevc","mif1" etc.
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1'].includes(brand)) return 'image/heic';
  }
  return null;
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('bmp')) return 'bmp';
  if (normalized.includes('heic') || normalized.includes('heif')) return 'heic';
  if (normalized.includes('avif')) return 'avif';
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('tiff') || normalized.includes('tif')) return 'tiff';
  return 'jpg'; // default to jpg instead of bin for image content
}

function buildCustomImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listings/custom-image?${params.toString()}`;
}

function buildListingImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/listing-image?${params.toString()}`;
}

export function isAllowedImageHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized.endsWith('fbcdn.net')) return true;
  if (normalized.startsWith('scontent-') && normalized.includes('.fbcdn.net')) return true;
  if (normalized === 'scontent.xx.fbcdn.net') return true;
  if (normalized.endsWith('.fbcdn.net')) return true;
  if (normalized.endsWith('scontent.xx.fbcdn.net')) return true;
  if (normalized === 'images.craigslist.org') return true;
  return false;
}

export async function handleCustomImage(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Custom item uploads are not configured.' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || !key.startsWith('custom-items/')) {
    return jsonResponse({ message: 'Missing or invalid image key.' }, 400);
  }

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) {
    return jsonResponse({ message: 'Image not found.' }, 404);
  }

  const body = await object.arrayBuffer();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  const ct = headers.get('content-type') || '';
  if (!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
    const detected = detectContentTypeFromBytes(new Uint8Array(body));
    headers.set('content-type', detected || 'application/octet-stream');
  }
  return new Response(body, { headers });
}

export async function handleListingImage(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Image storage is not configured.' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || !key.startsWith('listing-images/')) {
    return jsonResponse({ message: 'Missing or invalid image key.' }, 400);
  }

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) {
    return jsonResponse({ message: 'Image not found.' }, 404);
  }

  const body = await object.arrayBuffer();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  const ct = headers.get('content-type') || '';
  if (!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
    const detected = detectContentTypeFromBytes(new Uint8Array(body));
    headers.set('content-type', detected || 'application/octet-stream');
  }
  return new Response(body, { headers });
}

export async function handleImageProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');
  const referrer = url.searchParams.get('ref') || '';

  if (!imageUrl) {
    return jsonResponse({ message: 'Missing image URL.' }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return jsonResponse({ message: 'Invalid image URL.' }, 400);
  }

  if (parsed.protocol !== 'https:' || !isAllowedImageHost(parsed.hostname)) {
    return jsonResponse({ message: 'Image host not allowed.' }, 400);
  }

  const headers = new Headers({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  });
  if (referrer) {
    headers.set('Referer', referrer);
  }

  const response = await fetch(parsed.toString(), {
    headers,
    cf: { cacheTtl: 86400, cacheEverything: true },
  });

  if (!response.ok || !response.body) {
    return jsonResponse({ message: 'Unable to fetch image.' }, 404);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=86400',
    },
  });
}

export function extractR2KeyFromImageUrl(imageUrl: string): { key: string; prefix: string } | null {
  try {
    const listingMatch = imageUrl.match(/\/api\/listing-image\?key=(listing-images\/[^\s&]+)/);
    if (listingMatch) return { key: decodeURIComponent(listingMatch[1]), prefix: 'listing-images' };
    const customMatch = imageUrl.match(/\/api\/listings\/custom-image\?key=(custom-items\/[^\s&]+)/);
    if (customMatch) return { key: decodeURIComponent(customMatch[1]), prefix: 'custom-items' };
    return null;
  } catch {
    return null;
  }
}

export async function deleteR2ImagesForListing(
  listingId: string,
  photos: string,
  imageUrl: string,
  env: Env,
): Promise<number> {
  if (!env.CUSTOM_ITEMS_BUCKET) return 0;
  let deleted = 0;

  // Delete by known photo URLs in DB
  const allUrls = [
    ...photos.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    imageUrl.trim(),
  ].filter(Boolean);

  const keysToDelete = new Set<string>();
  for (const url of allUrls) {
    const parsed = extractR2KeyFromImageUrl(url);
    if (parsed) keysToDelete.add(parsed.key);
  }

  // Also list all objects under the listing-images/{id}/ prefix to catch stragglers
  try {
    let cursor: string | undefined;
    do {
      const listed = await env.CUSTOM_ITEMS_BUCKET.list({
        prefix: `listing-images/${listingId}/`,
        cursor,
      });
      for (const obj of listed.objects) {
        keysToDelete.add(obj.key);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch { /* best effort */ }

  for (const key of keysToDelete) {
    try {
      await env.CUSTOM_ITEMS_BUCKET.delete(key);
      deleted++;
    } catch { /* best effort */ }
  }
  return deleted;
}

export async function persistListingImagesToR2(
  listingId: string,
  imageUrls: string[],
  env: Env,
): Promise<string[]> {
  if (!env.CUSTOM_ITEMS_BUCKET || imageUrls.length === 0) return imageUrls;

  const results: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const sourceUrl = imageUrls[i];
    try {
      const response = await fetch(sourceUrl, { redirect: 'follow' });
      if (!response.ok || !response.body) {
        results.push(sourceUrl);
        continue;
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = extensionFromContentType(contentType);
      const key = `listing-images/${listingId}/${i}.${ext}`;
      const body = await response.arrayBuffer();
      await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
        httpMetadata: { contentType },
      });
      results.push(buildListingImageUrl(key));
    } catch {
      results.push(sourceUrl);
    }
  }
  return results;
}
