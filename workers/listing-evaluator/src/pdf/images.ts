import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { extractInventoryImageKey } from '../inventory/db-images.js';
import type { PdfImageAsset } from './types.js';
import { concatenatePdfParts } from './utils.js';
import { isJpegBytes, isPngBytes, parseJpegPdfAsset, parsePngPdfAsset } from './parse.js';

export async function fetchPdfImageAsset(imageUrl: string, env: Env): Promise<PdfImageAsset | null> {
  try {
    const directAsset = await fetchPdfImageAssetFromBucket(imageUrl, env);
    if (directAsset) return directAsset;

    const absoluteUrl = resolvePdfImageUrl(imageUrl, env);
    if (!absoluteUrl) return null;

    const response = await fetch(absoluteUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    const parsedAsset = parsePdfImageAsset(bytes, contentType);
    if (parsedAsset) {
      return parsedAsset;
    }
  } catch (error) {
    console.warn('Unable to fetch label image asset', { imageUrl, error });
  }

  return null;
}

export async function fetchPdfImageAssetFromBucket(imageUrl: string, env: Env): Promise<PdfImageAsset | null> {
  if (!env.CUSTOM_ITEMS_BUCKET) return null;
  const key = extractInventoryImageKey(imageUrl);
  if (!key) return null;

  const object = await env.CUSTOM_ITEMS_BUCKET.get(key);
  if (!object?.body) return null;

  const bytes = new Uint8Array(await object.arrayBuffer());
  const contentType = (object.httpMetadata?.contentType || '').toLowerCase();
  return parsePdfImageAsset(bytes, contentType);
}

export function parsePdfImageAsset(bytes: Uint8Array, contentType: string): PdfImageAsset | null {
  if (contentType.includes('jpeg') || contentType.includes('jpg') || isJpegBytes(bytes)) {
    return parseJpegPdfAsset(bytes);
  }
  if (contentType.includes('png') || isPngBytes(bytes)) {
    return parsePngPdfAsset(bytes);
  }
  return null;
}

export function buildPdfImageObject(asset: PdfImageAsset): Uint8Array {
  const encoder = new TextEncoder();
  const decodeParms = asset.decodeParms ? ` /DecodeParms ${asset.decodeParms}` : '';
  return concatenatePdfParts([
    encoder.encode(
      `<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace ${asset.colorSpace} /BitsPerComponent ${asset.bitsPerComponent} /Filter ${asset.filter}${decodeParms} /Length ${asset.data.length} >>\nstream\n`,
    ),
    asset.data,
    encoder.encode('\nendstream'),
  ]);
}

export function resolvePdfImageUrl(imageUrl: string, env: Env): string | null {
  const normalized = normalizeText(imageUrl, '');
  if (!normalized) return null;
  try {
    return new URL(normalized, env.SITE_BASE_URL).toString();
  } catch {
    return null;
  }
}
