import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import type { ListingData } from '../types/core.js';
import { fetchApifyRun, fetchApifyDataset, pickLocation } from './handlers2.js';
import {
  dbFindListingByUrl,
  dbGetListing,
  dbUpdateListing,
  getIsMultiFromRecord,
} from '../listings/db.js';
import { updateRowByRunId } from '../listings/db2.js';
import { normalizeQueuedListingUrl, ensureMultiTotals } from '../listings/submit.js';
import { persistListingImagesToR2 } from '../listings/images.js';
import { runOpenAI } from '../ai/eval-stubs.js';
import {
  toAbsoluteSiteUrl,
  insertActivityLogBestEffort,
  buildAdminListingEvaluatorItemUrl,
} from '../admin/activity.js';

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

export function pickImages(item: any): string[] {
  const images: string[] = [];

  const candidates = [
    item.images,
    item.imageUrls,
    item.photos,
    item.photosSmall,
    item.imageUrl,
    item.image,
    item.pics,
    item.picUrls,
    item.listingPhotos,
    item.primary_listing_photo,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => {
        if (typeof entry === 'string') images.push(entry);
        if (entry?.url) images.push(entry.url);
        if (entry?.imageUrl) images.push(entry.imageUrl);
        if (entry?.image?.uri) images.push(entry.image.uri);
      });
    } else if (typeof candidate === 'string') {
      images.push(candidate);
    } else if (candidate?.photo_image_url) {
      images.push(candidate.photo_image_url);
    }
  }

  const unique = Array.from(new Set(images.filter(Boolean)));
  return unique;
}

export function normalizeListing(item: any): ListingData {
  const title = pickString(
    item.listingTitle,
    item.title?.text,
    item.title,
    item.name?.text,
    item.name,
    item.heading,
    item.marketplaceListingTitle,
    item.marketplace_listing_title,
    item.custom_title,
    item.listing_title,
    item.listing?.title,
    item.listing?.marketplaceListingTitle
  );
  const description = pickString(
    item.description?.text,
    item.post,
    item.description,
    item.details,
    item.body,
    item.text,
    item.postingBody,
    item.posting_body,
    item.desc,
    item.summary
  );
  const price = pickString(
    item.listing_price?.formatted_amount,
    item.listing_price?.amount,
    item.listing_price?.amount_with_offset_in_currency,
    item.listingPrice?.formatted_amount_zeros_stripped,
    item.listingPrice?.amount,
    item.price,
    item.priceFormatted,
    item.priceText,
    item.priceAmount,
    item.priceRange
  );
  const location = pickLocation(
    item.location?.reverse_geocode?.city,
    item.location?.reverse_geocode?.city_page?.display_name,
    item.locationText?.text,
    item.location,
    item.locationText,
    item.where,
    item.city,
    item.region,
    item.address?.city,
    item.address?.region
  );
  const condition = pickString(item.condition, item.itemCondition, item.conditionText);

  const images = pickImages(item);

  return {
    title,
    description,
    price,
    location,
    condition,
    images,
    url: pickString(
      item.url,
      item.itemUrl,
      item.item_url,
      item.listingUrl,
      item.listingURL,
      item.listingUrl,
      item.facebookUrl,
      item.itemUrl,
      item.itemURL,
      item.canonicalUrl,
      item.canonicalURL,
      item.shareUrl,
      item.shareURL,
      item.marketplaceListingUrl,
      item.marketplaceListingURL
    ),
  };
}

export async function processRun(runId: string, resource: any, eventType: string | undefined, env: Env): Promise<void> {
  if (eventType && eventType.includes('FAILED')) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Apify run failed.',
    }, env);
    return;
  }

  const runDetails = await fetchApifyRun(runId, env);
  const datasetId = resource?.defaultDatasetId || runDetails?.defaultDatasetId;

  if (!datasetId) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'No dataset returned from scraper.',
    }, env);
    return;
  }

  const items = await fetchApifyDataset(datasetId, env);
  if (!items || items.length === 0) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Scraper returned no listing data.',
    }, env);
    return;
  }

  const listing = normalizeListing(items[0]);
  let recordId = await env.LISTING_JOBS.get(runId);
  if (!recordId && listing.url) {
    const found = await dbFindListingByUrl(listing.url, env);
    if (found?.id) {
      recordId = found.id;
      await env.LISTING_JOBS.put(runId, recordId);
    }
  }
  if (!listing.title.trim() && listing.images.length === 0) {
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      notes: 'Scraper returned incomplete listing metadata (missing title and image). Check URL format; Facebook share links may not resolve.',
    }, env, { recordId });
    return;
  }
  const isMulti = recordId ? await getIsMultiFromRecord(recordId, env) : false;
  const canonicalListingUrl = normalizeQueuedListingUrl(listing.url || '') || '';
  const aiResult = await runOpenAI(listing, env, { isMulti });
  let aiSummary = aiResult.kind === 'multi' ? ensureMultiTotals(aiResult.summary) : '';
  let aiData = aiResult.kind === 'single' ? aiResult.data : undefined;

  let finalImages = listing.images;
  if (recordId && env.CUSTOM_ITEMS_BUCKET && listing.images.length > 0) {
    finalImages = await persistListingImagesToR2(recordId, listing.images, env);
  }

  await updateRowByRunId(runId, {
    runId,
    status: 'complete',
    title: listing.title,
    price: listing.price,
    location: listing.location,
    condition: listing.condition,
    description: listing.description,
    photos: finalImages.join('\n'),
    image_url: finalImages[0] ?? '',
    aiSummary,
    aiData,
    notes: listing.notes,
  }, env, { recordId, isMulti });

  if (recordId && canonicalListingUrl) {
    const currentRecord = await dbGetListing(recordId, env);
    const currentUrl = normalizeText(currentRecord?.fields?.url, '');
    if (currentUrl && currentUrl !== canonicalListingUrl) {
      const existingCanonical = await dbFindListingByUrl(canonicalListingUrl, env);
      if (!existingCanonical || existingCanonical.id === recordId) {
        await dbUpdateListing(recordId, { url: canonicalListingUrl }, env);
      }
    }
  }

  const listingTitle = normalizeText(listing.title, '').slice(0, 300) || 'Untitled listing';
  const listingUrl = toAbsoluteSiteUrl(listing.url || '');
  const listingImageUrl = toAbsoluteSiteUrl(listing.images[0] || '');
  await insertActivityLogBestEffort(env, {
    eventKey: 'listing_eval_completed',
    eventText: `Listing Eval completed for ${listingTitle}`,
    eventUrl: recordId ? buildAdminListingEvaluatorItemUrl(recordId) : listingUrl,
    imageUrl: listingImageUrl,
    entityType: 'listing_eval',
    entityId: recordId || null,
    metadata: {
      runId,
      listingId: recordId || null,
      title: listingTitle,
      sourceUrl: listingUrl,
    },
  });
}
