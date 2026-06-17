import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { DEFAULT_TEXT } from '../constants.js';
import type { ListingSource, SingleAiResult } from '../types/core.js';
import { dbGetListing, dbUpdateListing, dbCreateListing, getIsMultiFromRecord } from './db.js';
import { normalizeMoneyValue } from '../utils/money.js';
import { decodeSerial } from '../serial/utils.js';
import {
  formatSourceLabel,
  parseMoney,
  extractMultiAskingTotal,
  extractAskingFromSummary,
  chooseAskingPrice,
  buildSingleAiSummary,
  splitAiSummary,
  normalizeCondition,
  normalizeCategory,
  normalizeFinish,
  normalizeYear,
  chooseBestStructuredText,
  ensureDefaultSuffix,
} from './processing.js';

export async function insertQueuedRow(url: string, source: ListingSource, runId: string | null, isMulti: boolean, env: Env): Promise<string | null> {
  const timestamp = new Date().toISOString();
  const fields = {
    submitted_at: timestamp,
    source: formatSourceLabel(source),
    url,
    status: 'queued',
    IsMulti: isMulti,
  };

  try {
    const recordId = await dbCreateListing(fields, env);
    if (recordId && runId) {
      await env.LISTING_JOBS.put(runId, recordId);
    }
    return recordId;
  } catch (error) {
    console.error('D1 create failed', { error });
  }
  return null;
}

export async function updateRowByRunId(runId: string, updates: {
  runId?: string;
  status?: string;
  title?: string;
  price?: string;
  location?: string;
  condition?: string;
  description?: string;
  photos?: string;
  image_url?: string;
  aiSummary?: string;
  aiData?: SingleAiResult;
  notes?: string;
}, env: Env, options?: { recordId?: string | null; isMulti?: boolean | null }): Promise<void> {
  try {
    const recordId = options?.recordId ?? await env.LISTING_JOBS.get(runId);
    if (!recordId) {
      console.error('D1 update failed: record not found for run_id', { runId });
      return;
    }

    const existingRecord = await dbGetListing(recordId, env);
    const existingFields = existingRecord?.fields || {};
    const isCustomSource = normalizeText(existingFields.source, '').toLowerCase() === 'custom';
    const isMulti = options?.isMulti ?? await getIsMultiFromRecord(recordId, env);
    const aiAskingData = normalizeMoneyValue(updates.aiData?.asking_price);
    const listedPrice = updates.price ? parseMoney(updates.price) : null;
    const listedPriceOrAi = listedPrice ?? aiAskingData;
    const aiAsking = updates.aiSummary
      ? (isMulti ? extractMultiAskingTotal(updates.aiSummary) : extractAskingFromSummary(updates.aiSummary))
      : null;
    const asking = chooseAskingPrice(listedPriceOrAi, aiAsking, updates.description ?? '', updates.aiSummary ?? '', isMulti);
    const singleAiSummary = !isMulti ? buildSingleAiSummary(updates.aiData, { ideal: null, privateParty: null }) : '';
    const fullSummary = updates.aiSummary ?? singleAiSummary;
    const summaryChunks = splitAiSummary(fullSummary || null);
    if (fullSummary) {
      console.info('AI summary split', { length: fullSummary.length, chunks: summaryChunks.length });
    }

    const normalizedCondition = normalizeCondition(updates.aiData?.condition ?? updates.condition ?? '');
    const serialCandidate = typeof updates.aiData?.serial === 'string' ? updates.aiData.serial.trim() : '';
    const serialBrandCandidate = typeof updates.aiData?.serial_brand === 'string' ? updates.aiData.serial_brand.trim() : '';
    const decoded = serialCandidate
      ? decodeSerial(serialBrandCandidate || updates.aiData?.brand || '', serialCandidate)
      : null;
    const decodedBrand = decoded?.info?.brand || '';
    const decodedYear = decoded?.info?.year || '';
    const decodedModel = decoded?.info?.model || '';
    const serialShouldUse = decoded?.info?.serialNumber || serialCandidate;
    const serialBrand = decodedBrand || serialBrandCandidate || updates.aiData?.brand || '';
    const serialYear = decodedYear || updates.aiData?.serial_year || '';
    const serialModel = decodedModel || updates.aiData?.serial_model || '';
    const definitiveBrand = serialShouldUse ? normalizeText(serialBrand, '') : '';
    const definitiveYear = serialShouldUse ? normalizeText(serialYear, '') : '';
    const definitiveModel = serialShouldUse ? normalizeText(serialModel, '') : '';

    const aiFields = updates.aiData
      ? {
          category: normalizeCategory(updates.aiData.category),
          brand: isCustomSource
            ? chooseBestStructuredText(definitiveBrand || updates.aiData.brand, existingFields.brand)
            : definitiveBrand || normalizeText(updates.aiData.brand, 'Unknown'),
          model: isCustomSource
            ? chooseBestStructuredText(definitiveModel || updates.aiData.model, existingFields.model)
            : definitiveModel || normalizeText(updates.aiData.model, 'Unknown'),
          finish: normalizeFinish(updates.aiData.finish),
          year: definitiveYear || normalizeYear(updates.aiData.year),
          condition: isCustomSource
            ? chooseBestStructuredText(normalizedCondition, existingFields.condition)
            : normalizedCondition,
          serial: serialShouldUse || '',
          serial_brand: serialShouldUse ? normalizeText(serialBrand, '') : '',
          serial_year: serialShouldUse ? normalizeText(serialYear, '') : '',
          serial_model: serialShouldUse ? normalizeText(serialModel, '') : '',
          value_private_party_low: normalizeMoneyValue(updates.aiData.value_private_party_low),
          value_private_party_low_notes: normalizeText(updates.aiData.value_private_party_low_notes, ''),
          value_private_party_medium: normalizeMoneyValue(updates.aiData.value_private_party_medium),
          value_private_party_medium_notes: normalizeText(updates.aiData.value_private_party_medium_notes, ''),
          value_private_party_high: normalizeMoneyValue(updates.aiData.value_private_party_high),
          value_private_party_high_notes: normalizeText(updates.aiData.value_private_party_high_notes, ''),
          pricing_source: normalizeText(updates.aiData.pricing_source, ''),
          pricing_confidence: normalizeText(updates.aiData.pricing_confidence, ''),
          pricing_comp_count: normalizeMoneyValue(updates.aiData.pricing_comp_count),
          pricing_notes: normalizeText(updates.aiData.pricing_notes, ''),
          value_pawn_shop_notes: normalizeText(updates.aiData.value_pawn_shop_notes, ''),
          value_online_notes: normalizeText(updates.aiData.value_online_notes, ''),
          known_weak_points: ensureDefaultSuffix(updates.aiData.known_weak_points, DEFAULT_TEXT.known_weak_points),
          typical_repair_needs: ensureDefaultSuffix(updates.aiData.typical_repair_needs, DEFAULT_TEXT.typical_repair_needs),
          buyers_worry: ensureDefaultSuffix(updates.aiData.buyers_worry, DEFAULT_TEXT.buyers_worry),
          og_specs_pickups: normalizeText(updates.aiData.og_specs_pickups, 'Unknown'),
          og_specs_tuners: normalizeText(updates.aiData.og_specs_tuners, 'Unknown'),
          og_specs_common_mods: ensureDefaultSuffix(updates.aiData.og_specs_common_mods, DEFAULT_TEXT.og_specs_common_mods),
          buyer_what_to_check: ensureDefaultSuffix(updates.aiData.buyer_what_to_check, DEFAULT_TEXT.buyer_what_to_check),
          buyer_common_misrepresent: ensureDefaultSuffix(updates.aiData.buyer_common_misrepresent, DEFAULT_TEXT.buyer_common_misrepresent),
          seller_how_to_price_realistic: ensureDefaultSuffix(updates.aiData.seller_how_to_price_realistic, DEFAULT_TEXT.seller_how_to_price_realistic),
          seller_fixes_add_value_or_waste: ensureDefaultSuffix(updates.aiData.seller_fixes_add_value_or_waste, DEFAULT_TEXT.seller_fixes_add_value_or_waste),
          seller_as_is_notes: ensureDefaultSuffix(updates.aiData.seller_as_is_notes, DEFAULT_TEXT.seller_as_is_notes),
        }
      : null;
    const fields: Record<string, unknown> = {
      status: updates.status ?? null,
      title: updates.title ?? null,
      price_asking: asking ?? null,
      location: updates.location ?? null,
      description: updates.description ?? null,
      photos: updates.photos ?? null,
      image_url: updates.image_url ?? null,
      ai_summary: summaryChunks[0] ?? null,
      ai_summary2: isMulti ? summaryChunks[1] ?? null : null,
      ai_summary3: isMulti ? summaryChunks[2] ?? null : null,
      ai_summary4: isMulti ? summaryChunks[3] ?? null : null,
      ai_summary5: isMulti ? summaryChunks[4] ?? null : null,
      ai_summary6: isMulti ? summaryChunks[5] ?? null : null,
      ai_summary7: isMulti ? summaryChunks[6] ?? null : null,
      ai_summary8: isMulti ? summaryChunks[7] ?? null : null,
      ai_summary9: isMulti ? summaryChunks[8] ?? null : null,
      ai_summary10: isMulti ? summaryChunks[9] ?? null : null,
    };
    await dbUpdateListing(recordId, fields, env);
    if (aiFields && !isMulti) {
      await dbUpdateListing(recordId, aiFields, env);
    }
  } catch (error) {
    console.error('D1 update failed', { error });
    throw error;
  }
}
