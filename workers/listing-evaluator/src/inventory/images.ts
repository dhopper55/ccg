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
