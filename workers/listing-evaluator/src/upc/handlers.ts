import type { Env } from '../env.js';
import { jsonResponse, normalizeText } from '../utils/misc.js';
import { normalizeUrl } from '../utils/text.js';
import { parseCurrencyAmount } from '../utils/money.js';
import { INVENTORY_MAX_IMAGES } from '../constants.js';

export type DunlopMfrPriceListRow = {
  item_number: string;
  description: string;
  upc: string;
  map: number | null;
  msrp: number | null;
  dealer_cost: number | null;
};

export type UpcAiEnrichment = {
  clean_title: string;
  clean_description: string;
  clean_bullets: string[];
};

export async function handleAdminV2BarcodeLookup(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const barcode = normalizeText(url.searchParams.get('barcode'), '').trim().slice(0, 80);
  if (!barcode) return jsonResponse({ found: false });

  const row = await env.DB.prepare(
    `SELECT id, ccg_number
     FROM ccg_inventory_items
     WHERE TRIM(COALESCE(barcode, '')) = ?
       AND COALESCE(is_active, 0) = 1
     ORDER BY id DESC
     LIMIT 1`
  ).bind(barcode).first<{ id: number; ccg_number: string | null }>();

  if (!row?.id) return jsonResponse({ found: false });

  return jsonResponse({
    found: true,
    id: String(row.id),
    ccgNumber: normalizeText(row.ccg_number, ''),
    url: `/admin/inventory-item?id=${encodeURIComponent(String(row.id))}`,
  });
}

export async function handleAdminV2UpcLookup(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const barcode = normalizeText(url.searchParams.get('barcode'), '').replace(/\D/g, '').slice(0, 20);
  const requestedBrandCode = normalizeText(url.searchParams.get('brand'), 'DUNLOP').toUpperCase().slice(0, 120);
  const isDunlopLookup = requestedBrandCode === 'DUNLOP';
  const isOtherLookup = requestedBrandCode === 'OTHER';
  if (!isDunlopLookup && !isOtherLookup) {
    return jsonResponse({ message: 'Brand is invalid.' }, 400);
  }
  const brand = isDunlopLookup ? 'Dunlop' : 'Other';
  if (!/^\d{8,20}$/.test(barcode)) {
    return jsonResponse({ message: 'Barcode must be 8 to 20 digits.' }, 400);
  }

  const mfrRow = isDunlopLookup ? await dbGetDunlopMfrPriceListByUpc(barcode, env) : null;

  const lookupUrl = new URL('https://api.upcitemdb.com/prod/trial/lookup');
  lookupUrl.searchParams.set('upc', barcode);

  let item: Record<string, unknown> | null = null;
  let response: Response;
  try {
    response = await fetch(lookupUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CCG Admin UPC Lookup/1.0',
      },
    });
  } catch {
    if (!mfrRow) return jsonResponse({ message: 'Unable to reach UPC lookup service.' }, 502);
    response = new Response('{}', { status: 200 });
  }

  if (!response.ok && !mfrRow) {
    return jsonResponse({ message: 'UPC lookup service returned an error.' }, 502);
  }

  if (response.ok) {
    try {
      const data = await response.json() as Record<string, unknown>;
      const items = Array.isArray(data.items) ? data.items : [];
      item = items.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')) || null;
    } catch {
      if (!mfrRow) return jsonResponse({ message: 'UPC lookup service returned invalid JSON.' }, 502);
    }
  }
  if (!item && !mfrRow) return jsonResponse({ found: false, barcode, brand, source: 'upcitemdb' });

  const normalized = normalizeUpcItemDbItem(barcode, brand, item || {}, mfrRow);
  const ai = await runOpenAIUpcProductEnrichment(normalized, env);

  return jsonResponse({
    found: true,
    ...normalized,
    ...(ai || {}),
  });
}

export async function dbGetDunlopMfrPriceListByUpc(upc: string, env: Env): Promise<DunlopMfrPriceListRow | null> {
  try {
    return await env.DB.prepare(
      `SELECT item_number, description, upc, map, msrp, dealer_cost
       FROM mfr_price_list_dunlop
       WHERE upc = ?
       LIMIT 1`,
    ).bind(upc).first<DunlopMfrPriceListRow>();
  } catch (error) {
    console.warn('Dunlop price list lookup failed', { error, upc });
    return null;
  }
}

export function normalizeUpcItemDbItem(
  barcode: string,
  requestedBrand: string,
  item: Record<string, unknown>,
  mfrRow: DunlopMfrPriceListRow | null,
): Record<string, unknown> {
  const title = normalizeText(item.title, '');
  const brand = normalizeText(item.brand, '') || requestedBrand;
  const sourceDescription = normalizeText(item.description, '');
  const images = normalizeUpcItemDbImages(item.images);
  const attributes = normalizeUpcItemDbAttributes(item);
  const brandDesc = normalizeText(mfrRow?.description, '') || pickUpcString(item, ['brand_desc', 'brandDescription']);
  const mapValue = mfrRow?.map ?? pickUpcNumber(item, ['map', 'minimum_advertised_price', 'lowest_recorded_price']);
  const msrpValue = mfrRow?.msrp ?? pickUpcNumber(item, ['msrp', 'list_price']);
  const dealerCostValue = mfrRow?.dealer_cost ?? null;

  return {
    barcode,
    requested_brand: requestedBrand || null,
    source: 'upcitemdb',
    title,
    description: sourceDescription,
    features: [],
    attributes,
    images,
    item_no: normalizeText(mfrRow?.item_number, '') || pickUpcString(item, ['asin', 'elid', 'ean', 'upc']),
    brand_desc: brandDesc,
    brand,
    map: formatNullableCurrency(mapValue),
    msrp: formatNullableCurrency(msrpValue),
    dealer_cost: formatNullableCurrency(dealerCostValue),
    mfr_price_list: mfrRow
      ? {
        item_number: normalizeText(mfrRow.item_number, ''),
        description: normalizeText(mfrRow.description, ''),
        upc: normalizeText(mfrRow.upc, ''),
        map: formatNullableCurrency(mfrRow.map),
        msrp: formatNullableCurrency(mfrRow.msrp),
        dealer_cost: formatNullableCurrency(mfrRow.dealer_cost),
      }
      : null,
    raw: item,
  };
}

export function normalizeUpcItemDbImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((entry) => normalizeUrl(normalizeText(entry, '')))
      .filter((entry): entry is string => Boolean(entry)),
  )).slice(0, INVENTORY_MAX_IMAGES);
}

export function normalizeUpcItemDbAttributes(item: Record<string, unknown>): Record<string, string> {
  const keys = ['color', 'size', 'weight'];
  const attributes: Record<string, string> = {};
  keys.forEach((key) => {
    const value = normalizeText(item[key], '');
    if (value) attributes[key] = value;
  });
  return attributes;
}

export async function runOpenAIUpcProductEnrichment(
  product: Record<string, unknown>,
  env: Env,
): Promise<UpcAiEnrichment | null> {
  if (!env.ANTHROPIC_API_KEY) return null;

  const prompt = [
    'Create clean ecommerce copy for a music store product draft.',
    'Use only the provided product data. Do not invent specs.',
    'Return JSON only — no markdown, no explanation.',
    '',
    'Keys required:',
    '- clean_title: concise retail product title.',
    '- clean_description: 1-2 short paragraphs, plain text.',
    '- clean_bullets: exactly 5 useful bullets, each 60 characters or less.',
    '- Bullets should describe product benefits/features, not price.',
    '',
    'Product data:',
    JSON.stringify({
      barcode: product.barcode,
      brand: product.brand,
      item_no: product.item_no,
      brand_desc: product.brand_desc,
      upcitemdb_title: product.title,
      upcitemdb_description: product.description,
      attributes: product.attributes,
      mfr_price_list: product.mfr_price_list,
    }, null, 2),
  ].join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.warn('UPC product enrichment failed', { status: response.status, body: bodyText.slice(0, 600) });
      return null;
    }

    const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';
    const parsed = JSON.parse(text) as UpcAiEnrichment;
    return {
      clean_title: normalizeText(parsed.clean_title, '').slice(0, 200),
      clean_description: normalizeText(parsed.clean_description, '').slice(0, 4000),
      clean_bullets: (Array.isArray(parsed.clean_bullets) ? parsed.clean_bullets : [])
        .map((bullet) => normalizeText(bullet, '').slice(0, 60))
        .filter(Boolean)
        .slice(0, 5),
    };
  } catch (error) {
    console.warn('UPC product enrichment parse/request failed', { error });
    return null;
  }
}

export function pickUpcString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeText(item[key], '');
    if (value) return value;
  }
  return null;
}

export function pickUpcNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = parseCurrencyAmount(item[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function formatNullableCurrency(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
