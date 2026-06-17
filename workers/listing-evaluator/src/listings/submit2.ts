import type { Env } from '../env.js';
import type { ListingData, SingleAiResult } from '../types/core.js';
import { dbUpdateListing } from './db.js';
import { buildCustomAiTitle, toAbsoluteImageUrl, applyMultiRangeToSummary, clearPrivatePartyPricingFields, getRealisticPrivatePartyPricing, ensureMultiTotals } from './submit.js';
import { updateRowByRunId } from './db2.js';
import { runOpenAI, runOpenAIMultiRangePricing } from '../ai/eval-stubs.js';
import { decodeSerial } from '../serial/utils.js';

export async function processCustomListing(
  recordId: string,
  listing: ListingData,
  env: Env
): Promise<void> {
  const runId = `custom-${recordId}-${Date.now()}`;
  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const aiImages = listing.images.map((imageUrl) => toAbsoluteImageUrl(imageUrl, baseUrl));
  try {
    const aiResult = await runOpenAI({ ...listing, images: aiImages }, env, { isMulti: false });
    let aiData = aiResult.kind === 'single' ? aiResult.data : undefined;
    if (aiData) {
      aiData = clearPrivatePartyPricingFields(aiData);
      const pricing = await getRealisticPrivatePartyPricing(aiData, env);
      if (pricing) {
        aiData = { ...aiData, ...pricing };
      }
    }
    const serialCandidate = typeof aiData?.serial === 'string' ? aiData.serial.trim() : '';
    const serialBrandCandidate = typeof aiData?.serial_brand === 'string' ? aiData.serial_brand.trim() : '';
    const decoded = serialCandidate
      ? decodeSerial(serialBrandCandidate || aiData?.brand || '', serialCandidate)
      : null;
    const aiTitle = buildCustomAiTitle(aiData, {
      year: decoded?.info?.year || aiData?.serial_year || aiData?.year,
      brand: decoded?.info?.brand || aiData?.serial_brand || aiData?.brand,
      model: decoded?.info?.model || aiData?.serial_model || aiData?.model,
    });

    await updateRowByRunId(runId, {
      runId,
      status: 'complete',
      title: aiTitle,
      price: listing.price,
      location: listing.location,
      condition: listing.condition,
      description: listing.description,
      photos: listing.images.join('\n'),
      image_url: listing.images[0] ?? '',
      aiSummary: '',
      aiData,
      notes: listing.notes,
    }, env, { recordId, isMulti: false });
  } catch (error) {
    console.error('Custom listing processing failed', { recordId, error });
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
    }, env, { recordId, isMulti: false });
  }
}

export async function processDirectListing(
  recordId: string,
  runId: string,
  listing: ListingData,
  env: Env,
  options?: { isMulti?: boolean }
): Promise<void> {
  const isMulti = Boolean(options?.isMulti);
  const baseUrl = env.SITE_BASE_URL || 'https://www.coalcreekguitars.com';
  const aiImages = listing.images.map((imageUrl) => toAbsoluteImageUrl(imageUrl, baseUrl));

  try {
    await dbUpdateListing(recordId, { status: 'processing' }, env);
    const aiResult = await runOpenAI({ ...listing, images: aiImages }, env, { isMulti });
    let aiSummary = aiResult.kind === 'multi' ? ensureMultiTotals(aiResult.summary) : '';
    let aiData = aiResult.kind === 'single' ? aiResult.data : undefined;

    if (aiResult.kind === 'single' && aiData) {
      aiData = clearPrivatePartyPricingFields(aiData);
      const pricing = await getRealisticPrivatePartyPricing(aiData, env);
      if (pricing) {
        aiData = { ...aiData, ...pricing };
      }
    }

    if (aiResult.kind === 'multi') {
      const pricing = await runOpenAIMultiRangePricing(listing, aiSummary, env);
      if (pricing) {
        aiSummary = applyMultiRangeToSummary(aiSummary, pricing.low, pricing.high);
      }
    }

    await updateRowByRunId(runId, {
      runId,
      status: 'complete',
      title: listing.title,
      price: listing.price,
      location: listing.location,
      condition: listing.condition,
      description: listing.description,
      photos: listing.images.join('\n'),
      image_url: listing.images[0] ?? '',
      aiSummary,
      aiData,
      notes: listing.notes,
    }, env, { recordId, isMulti });
  } catch (error) {
    console.error('Direct listing processing failed', { recordId, runId, error });
    await updateRowByRunId(runId, {
      runId,
      status: 'failed',
      title: listing.title,
      price: listing.price,
      location: listing.location,
      condition: listing.condition,
      description: listing.description,
      photos: listing.images.join('\n'),
      image_url: listing.images[0] ?? '',
      notes: listing.notes,
    }, env, { recordId, isMulti });
    throw error;
  }
}
