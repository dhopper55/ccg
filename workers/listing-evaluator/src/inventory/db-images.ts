import type { Env } from '../env.js';
import type { InventoryItemRow } from '../types/inventory.js';
import { dbListAllInventoryImageRefs } from './db-write.js';

const INVENTORY_MAX_IMAGES = 20;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
  return null;
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  return 'jpg';
}

function buildInventoryImageUrl(key: string): string {
  const params = new URLSearchParams();
  params.set('key', key);
  return `/api/inventory-image?${params.toString()}`;
}

export function isInventoryImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/inventory-image?')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/api/inventory-image') return false;
    const key = parsed.searchParams.get('key') || '';
    return key.startsWith('inventory-items/');
  } catch {
    return false;
  }
}

export function extractInventoryImageKey(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = url.startsWith('/api/inventory-image?')
      ? new URL(url, 'https://www.coalcreekguitars.com')
      : new URL(url);
    if (parsed.pathname !== '/api/inventory-image') return null;
    const key = (parsed.searchParams.get('key') || '').trim();
    if (!key.startsWith('inventory-items/')) return null;
    return key;
  } catch {
    return null;
  }
}

export function parseStoredInventoryImageUrls(imageUrlsRaw: string | null, fallbackPrimary: string | null): string[] {
  const urls = typeof imageUrlsRaw === 'string'
    ? imageUrlsRaw.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
    : [];
  if ((!urls || urls.length === 0) && fallbackPrimary) {
    urls.push(String(fallbackPrimary).trim());
  }
  return Array.from(new Set(urls.filter((url) => isInventoryImageUrl(url)))).slice(0, INVENTORY_MAX_IMAGES);
}

export async function dbIsInventoryImagePublic(imageUrl: string, env: Env): Promise<boolean> {
  try {
    const normalized = imageUrl?.trim() || '';
    if (!normalized) return false;

    const result = await env.DB.prepare(
      `SELECT
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM ccg_inventory_item_images
             WHERE image_url = ?
           ) THEN CASE
             WHEN EXISTS (
               SELECT 1
               FROM ccg_inventory_item_images
               WHERE image_url = ?
                 AND COALESCE(is_private, 0) = 0
             ) THEN 1
             ELSE 0
           END
           WHEN EXISTS (
             SELECT 1
             FROM ccg_inventory_items
             WHERE image_url = ?
           ) THEN 1
           ELSE 0
         END AS is_public`
    ).bind(normalized, normalized, normalized).first<{ is_public?: number }>();

    return Number(result?.is_public || 0) === 1;
  } catch (error) {
    console.error('Inventory image visibility lookup failed', { error, imageUrl });
    return false;
  }
}

export async function ensureInventoryHostedImageUrls(urls: string[], env: Env): Promise<string[]> {
  const normalized = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean))).slice(
    0,
    INVENTORY_MAX_IMAGES,
  );
  const hostedUrls: string[] = [];
  for (const url of normalized) {
    if (isInventoryImageUrl(url)) {
      hostedUrls.push(url);
      continue;
    }
    hostedUrls.push(await importExternalImageToInventory(url, env));
  }
  return Array.from(new Set(hostedUrls)).slice(0, INVENTORY_MAX_IMAGES);
}

export async function importExternalImageToInventory(sourceUrl: string, env: Env): Promise<string> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    throw new Error('Inventory image uploads are not configured.');
  }

  let sourceResponse: Response;
  try {
    sourceResponse = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'CCG Inventory Import/1.0' },
      redirect: 'follow',
    });
  } catch {
    throw new Error('Unable to fetch source image.');
  }

  if (!sourceResponse.ok) {
    throw new Error('Unable to fetch source image.');
  }

  const bodyBytes = await sourceResponse.arrayBuffer();
  let contentType = sourceResponse.headers.get('content-type') || '';

  // Use magic-byte detection to override unreliable content-type headers
  const detected = detectContentTypeFromBytes(new Uint8Array(bodyBytes));
  if (detected) {
    contentType = detected;
  } else if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Source URL did not return an image.');
  }

  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(`Unsupported image format (${contentType}). Please use JPEG, PNG, WebP, or GIF.`);
  }

  const extension = extensionFromContentType(contentType);
  const key = `inventory-items/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  await env.CUSTOM_ITEMS_BUCKET.put(key, bodyBytes, {
    httpMetadata: {
      contentType,
    },
  });

  return buildInventoryImageUrl(key);
}

export async function cloneInventoryImageKeyToNewPackageImageUrl(sourceKey: string, env: Env): Promise<string> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    throw new Error('Inventory image uploads are not configured.');
  }
  const object = await env.CUSTOM_ITEMS_BUCKET.get(sourceKey);
  if (!object || !object.body) {
    throw new Error(`Source image not found for package creation: ${sourceKey}`);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const contentType = headers.get('content-type') || 'application/octet-stream';
  const ext = extensionFromContentType(contentType);
  const key = `inventory-items/packages/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const body = await object.arrayBuffer();
  await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
    httpMetadata: {
      contentType,
    },
  });
  return buildInventoryImageUrl(key);
}

export async function purgeOrphanedInventoryImagesForDeletedRows(rows: InventoryItemRow[], env: Env): Promise<void> {
  if (!env.CUSTOM_ITEMS_BUCKET) return;

  const candidateKeys = new Set<string>();
  for (const row of rows) {
    const imageUrls = parseStoredInventoryImageUrls(row.image_urls, row.image_url);
    imageUrls.forEach((url) => {
      const key = extractInventoryImageKey(url);
      if (key) candidateKeys.add(key);
    });
  }
  if (candidateKeys.size === 0) return;

  const refs = await dbListAllInventoryImageRefs(env);
  const stillReferenced = new Set<string>();
  for (const ref of refs) {
    const urls = parseStoredInventoryImageUrls(ref.image_urls, ref.image_url);
    urls.forEach((url) => {
      const key = extractInventoryImageKey(url);
      if (key) stillReferenced.add(key);
    });
  }

  for (const key of candidateKeys) {
    if (stillReferenced.has(key)) continue;
    try {
      await env.CUSTOM_ITEMS_BUCKET.delete(key);
    } catch (error) {
      console.warn('Failed to purge orphaned inventory image', { key, error });
    }
  }
}
