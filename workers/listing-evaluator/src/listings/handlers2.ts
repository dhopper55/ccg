import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import type { ListingData } from '../types/core.js';
import { CUSTOM_MAX_PHOTOS } from '../constants.js';
import { dbCreateListing, dbUpdateListing } from './db.js';
import {
  normalizeCustomText,
  buildCustomListingTitle,
  buildCustomListingDescription,
} from './submit.js';
import { processCustomListing } from './submit2.js';

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

export async function handleCustomListingSubmit(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Custom item uploads are not configured.' }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: 'Invalid form data.' }, 400);
  }

  const files = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length < 1) {
    return jsonResponse({ message: 'At least one photo is required.' }, 400);
  }
  if (files.length > CUSTOM_MAX_PHOTOS) {
    return jsonResponse({ message: `You can upload up to ${CUSTOM_MAX_PHOTOS} photos.` }, 400);
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return jsonResponse({ message: 'Only image uploads are supported.' }, 400);
    }
  }

  const now = new Date();
  const datePrefix = now.toISOString().slice(0, 10);
  const imageUrls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const ext = extensionFromContentType(file.type);
    const key = `custom-items/${datePrefix}/${crypto.randomUUID()}-${index + 1}.${ext}`;
    const body = await file.arrayBuffer();
    await env.CUSTOM_ITEMS_BUCKET.put(key, body, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });
    imageUrls.push(buildCustomImageUrl(key));
  }

  const brand = normalizeCustomText(formData.get('brand'), 180);
  const model = normalizeCustomText(formData.get('model'), 180);
  const condition = normalizeCustomText(formData.get('condition'), 180);
  const notes = normalizeCustomText(formData.get('notes'));
  const title = buildCustomListingTitle({ brand, model });
  const description = buildCustomListingDescription({ brand, model, condition, notes });
  const syntheticUrl = `custom-listing://${crypto.randomUUID()}`;
  const fields: Record<string, unknown> = {
    submitted_at: now.toISOString(),
    source: 'Custom',
    url: syntheticUrl,
    status: 'queued',
    title,
    description,
    brand: brand || null,
    model: model || null,
    condition: condition || null,
    notes: notes || null,
    photos: imageUrls.join('\n'),
    image_url: imageUrls[0] ?? null,
    IsMulti: false,
    archived: false,
  };

  const recordId = await dbCreateListing(fields, env);
  if (!recordId) {
    return jsonResponse({ message: 'Unable to queue custom item.' }, 500);
  }

  const listing: ListingData = {
    title,
    price: '',
    location: '',
    condition,
    description,
    images: imageUrls,
    notes,
    brandHint: brand,
    modelHint: model,
  };

  ctx.waitUntil((async () => {
    try {
      await dbUpdateListing(recordId, { status: 'processing' }, env);
      await processCustomListing(recordId, listing, env);
    } catch (error) {
      console.error('Custom listing background processing failed', { recordId, error });
      await dbUpdateListing(recordId, { status: 'failed' }, env);
    }
  })());

  return jsonResponse({ ok: true, recordId, status: 'queued' });
}
