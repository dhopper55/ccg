import type { Env } from '../env.js';
import { normalizeText, normalizeUrl } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';
import { ALLOWED_IMAGE_TYPES, detectContentTypeFromBytes, extensionFromContentType, buildInventoryImageUrl } from '../utils/image.js';
import { ensureInventoryHostedImageUrls, importExternalImageToInventory } from './db-images.js';

export async function handleInventoryImage(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || !key.startsWith('inventory-items/')) {
    return jsonResponse({ message: 'Missing or invalid image key.' }, 400);
  }

  // Some external fetchers (e.g. Reverb's photo importer) send a HEAD request first to check
  // the URL/content-type/size before downloading — this must resolve the same as GET or they
  // treat the URL as broken and skip the image entirely.
  if (request.method === 'HEAD') {
    const head = await env.CUSTOM_ITEMS_BUCKET.head(key);
    if (!head) {
      return jsonResponse({ message: 'Image not found.' }, 404);
    }
    const headers = new Headers();
    head.writeHttpMetadata(headers);
    headers.set('etag', head.httpEtag);
    headers.set('cache-control', 'public, max-age=86400');
    headers.set('content-length', String(head.size));
    if (!headers.get('content-type')) {
      headers.set('content-type', 'application/octet-stream');
    }
    return new Response(null, { headers });
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

const PUBLIC_IMAGE_KEY_PREFIXES = ['inventory-items/', 'listing-images/', 'custom-items/'];

// Minimal, auth-free, wide-open-CORS image byte server. The key is part of the URL PATH (not a
// ?key= query param) so the URL genuinely ends in a real image extension (…/abc.jpg) — Reverb's
// own docs example photo URL is "http://i.stack.imgur.com/Sv4BC.png"; if their importer does a
// simple extension check on the URL rather than sniffing content-type after fetching, a
// query-string-only extension (as /api/inventory-image?key=...jpg used) would fail that check
// even though the bytes returned are a valid image.
export async function handlePublicImageBytes(request: Request, key: string, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return new Response('Not configured', { status: 500 });
  }

  if (!key || !PUBLIC_IMAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return new Response('Missing or invalid key', { status: 400 });
  }

  const corsHeaders: Record<string, string> = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'HEAD') {
    const head = await env.CUSTOM_ITEMS_BUCKET.head(key);
    if (!head) return new Response('Not found', { status: 404, headers: corsHeaders });
    const headers = new Headers(corsHeaders);
    head.writeHttpMetadata(headers);
    headers.set('content-length', String(head.size));
    headers.set('cache-control', 'public, max-age=86400');
    if (!headers.get('content-type')) headers.set('content-type', 'application/octet-stream');
    return new Response(null, { headers });
  }

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object || !object.body) {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
  const body = await object.arrayBuffer();
  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'public, max-age=86400');
  const ct = headers.get('content-type') || '';
  if (!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
    const detected = detectContentTypeFromBytes(new Uint8Array(body));
    headers.set('content-type', detected || 'application/octet-stream');
  }
  return new Response(body, { headers });
}

export async function handleInventoryImageUpload(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid form data.' }, 400);
  }

  const file = formData.get('image');
  if (!(file instanceof File) || file.size <= 0) {
    return jsonResponse({ message: 'Image file is required.' }, 400);
  }
  if (!file.type.startsWith('image/')) {
    return jsonResponse({ message: 'Only image uploads are supported.' }, 400);
  }

  const body = await file.arrayBuffer();
  const detectedType = detectContentTypeFromBytes(new Uint8Array(body)) || file.type;
  if (!ALLOWED_IMAGE_TYPES.includes(detectedType)) {
    return jsonResponse({ message: `Unsupported image format (${detectedType}). Please upload JPEG, PNG, WebP, or GIF.` }, 400);
  }

  const ext = extensionFromContentType(detectedType);
  const key = `inventory-items/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: detectedType,
    },
  });

  return jsonResponse({ ok: true, imageUrl: buildInventoryImageUrl(key) });
}

export async function handleInventoryImageImport(request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Inventory image uploads are not configured.' }, 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const sourceUrl = normalizeUrl(normalizeText(body.sourceUrl, ''));
  if (!sourceUrl) {
    return jsonResponse({ message: 'Source image URL is required.' }, 400);
  }

  try {
    const imageUrl = await importExternalImageToInventory(sourceUrl, env);
    return jsonResponse({ ok: true, imageUrl });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to import source image.',
    }, 400);
  }
}
