import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { dbListInventoryCategories } from '../inventory/categories.js';
import type { InventoryCategoryRow } from '../types/inventory.js';

// "Refresh AI Analysis From Pics" on the admin inventory item page. The browser sends the
// item's photos (already downscaled to JPEG), the listing title and optional extra notes;
// Claude looks at the photos, researches comps with web search, and returns the readout
// for the AI Analysis box plus suggested values for the Inventory Details fields. Nothing
// is saved here — the page fills the form and the user reviews and saves.

const MODEL = 'claude-opus-5-5';
const MAX_IMAGES = 20;
const MAX_IMAGE_BASE64_CHARS = 5_000_000; // Anthropic's per-image cap is 5MB
const MAX_PAUSE_CONTINUATIONS = 4;
const HEARTBEAT_MS = 10_000;
const TOOL_NAME = 'record_inventory_analysis';

const SYSTEM_PROMPT = [
  'You help Coal Creek Guitars, a used musical instrument shop in the Denver, CO metro area (Englewood), identify and value used gear (guitars, basses, amps, pedals, keyboards, etc.) from photos.',
  '',
  'Identification:',
  '- Look closely at the photos: headstock logos, serial numbers, hardware, pickups, body shape, control layout, labels and model plates. Identify the item accurately.',
  '- Do not guess. If something looks off (misspelled logo, wrong serial format, non-matching hardware, a likely counterfeit or replica), say so plainly, even if it contradicts the title you were given.',
  '- Use web search to confirm the model and to find real current pricing: Reverb sold listings plus store new, used and open-box prices (Guitar Center, Sam Ash, Sweetwater). Base numbers on what you find, not memory.',
  '',
  'How to price for my shop (this applies to the private party value and the quick flip buy price):',
  '- Price it like Guitar Center would. I am a retail music shop in the Denver area, not a private seller: buyers can come in, see the item and try it before they buy, just like at Guitar Center, so my price should match what Guitar Center (or Sam Ash / Sweetwater) charges for the same item in the same condition.',
  '- When I say "private party value in Denver metro", I mean the price I should list it at in my shop: the Guitar Center-style price.',
  '- New or sealed items: price like a store open-box item, just under new retail/MAP. Used items: price like Guitar Center\'s used price for that item and condition. Reverb and marketplace sold prices are a floor, not the target.',
  '- Negotiation works like it does at Guitar Center: I negotiate and so do they. List at the store price with the normal $20–$50 of room to come down on most items; do not pre-discount to a private-sale price.',
  '- Do not factor in sales tax, marketplace fees or shipping.',
  '- For a project item (needs repair, incomplete, disassembled), estimate the working store price, then discount fairly for the work and risk.',
  '- Quick flip buy price: no more than 70% of that shop price (a 30% margin), with no tax or fee adjustments.',
  '',
  `When you have finished researching, call the ${TOOL_NAME} tool exactly once with your results. Do not write the readout as a normal reply — put it in the tool's analysis_html field.`,
].join('\n');

type InventoryPhotoAnalysisRequest = {
  title?: unknown;
  notes?: unknown;
  merchantCenterCatCodes?: unknown;
  images?: unknown;
};

type AnalysisImage = { mediaType: string; data: string };

type AnthropicContentBlock = { type: string; name?: string; input?: unknown; text?: string };
type AnthropicMessage = {
  content?: AnthropicContentBlock[];
  model?: string;
  usage?: Record<string, unknown>;
  stop_reason?: string;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
};

export type InventoryPhotoAnalysisFields = {
  title: string;
  brand: string;
  model: string;
  finish: string;
  yearRange: string;
  serialNumber: string;
  categoryId: string;
  secondaryCategoryId: string;
  merchantCenterCatCode: string;
  privatePartyValue: number | null;
};

export type InventoryPhotoAnalysisResult = {
  analysisHtml: string;
  fields: InventoryPhotoAnalysisFields;
};

function buildCategoryLines(categories: InventoryCategoryRow[]): string[] {
  const byId = new Map(categories.map((row) => [row.id, row]));
  return categories.map((row) => {
    const parent = row.parent_id != null ? byId.get(row.parent_id) : undefined;
    return parent
      ? `- ${row.id}: ${parent.name} > ${row.name} (secondary; parent ${parent.id})`
      : `- ${row.id}: ${row.name} (primary)`;
  });
}

function buildUserText(
  title: string,
  notes: string,
  categories: InventoryCategoryRow[],
  merchantCodes: string[],
): string {
  const titleLine = title
    ? `The listing title is "${title}".`
    : 'No listing title was given — identify the item from the pictures.';

  return [
    `${titleLine} Do your own evaluation on this item based on the pictures. Give me a concise readout of the following: Reverb sold range, realistic private party value in Denver metro, quick flip buy price (for 30% margin or more), and lastly, is this gear desirable - meaning do listings for this sit for a long time and are there a lot of them, or are they more rare and desirable?`,
    ...(notes ? ['', 'Additional details from the shop about this item:', notes] : []),
    '',
    `Then call ${TOOL_NAME} with:`,
    '- analysis_html: the readout above as simple HTML (only <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>). Keep it concise. Include the identification notes, the four answers, and any authenticity or condition concerns.',
    '- suggested_title: a concise product title (year if known, brand, model, finish), no price.',
    '- brand, model, finish, year_range, serial_number: use "" for anything you cannot determine. model must not repeat the brand. serial_number only if it is legible in the photos. year_range can be a single year or a range like "1978-1981".',
    '- category_id: the best primary category id below; secondary_category_id: a child of that primary, or "" if none fits.',
    '- merchant_center_cat_code: the best Google Merchant Center code below, or "".',
    '- private_party_value: the whole-dollar price to list it at in the Denver shop (Guitar Center-style) per the shop pricing rules; 0 if you cannot estimate it.',
    '',
    'Inventory categories (id: name):',
    ...buildCategoryLines(categories),
    '',
    `Merchant Center codes: ${merchantCodes.join(', ')}`,
  ].join('\n');
}

function buildTool(categories: InventoryCategoryRow[], merchantCodes: string[]) {
  const primaryIds = categories.filter((row) => row.parent_id == null).map((row) => String(row.id));
  const secondaryIds = categories.filter((row) => row.parent_id != null).map((row) => String(row.id));
  const stringField = { type: 'string' };
  return {
    name: TOOL_NAME,
    description: 'Record the finished photo analysis and the suggested inventory field values for this item.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'analysis_html', 'suggested_title', 'brand', 'model', 'finish', 'year_range', 'serial_number',
        'category_id', 'secondary_category_id', 'merchant_center_cat_code', 'private_party_value',
      ],
      properties: {
        analysis_html: stringField,
        suggested_title: stringField,
        brand: stringField,
        model: stringField,
        finish: stringField,
        year_range: stringField,
        serial_number: stringField,
        category_id: { type: 'string', enum: [...primaryIds, ''] },
        secondary_category_id: { type: 'string', enum: [...secondaryIds, ''] },
        merchant_center_cat_code: { type: 'string', enum: [...merchantCodes, ''] },
        private_party_value: { type: 'integer' },
      },
    },
  };
}

// The AI Analysis box renders this HTML directly, so keep only plain formatting tags.
const ALLOWED_TAGS = new Set(['p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'h3', 'h4']);
function sanitizeAnalysisHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?)([a-z0-9]+)[^>]*>/gi, (_match, slash: string, tag: string) => {
      const lower = tag.toLowerCase();
      return ALLOWED_TAGS.has(lower) ? `<${slash}${lower}>` : '';
    })
    .trim();
}

function parseImages(value: unknown): AnalysisImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const mediaType = normalizeText(record.mediaType, '');
      const data = typeof record.data === 'string' ? record.data : '';
      return { mediaType, data };
    })
    .filter((image) => /^image\/(jpeg|png|webp|gif)$/.test(image.mediaType)
      && image.data.length > 0
      && image.data.length <= MAX_IMAGE_BASE64_CHARS)
    .slice(0, MAX_IMAGES);
}

async function callAnthropic(body: Record<string, unknown>, env: Env): Promise<AnthropicMessage> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${errorBody.slice(0, 600)}`);
  }
  return response.json() as Promise<AnthropicMessage>;
}

export async function runInventoryPhotoAnalysis(
  title: string,
  notes: string,
  images: AnalysisImage[],
  merchantCodes: string[],
  env: Env,
): Promise<InventoryPhotoAnalysisResult> {
  const categories = await dbListInventoryCategories(env);
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    {
      role: 'user',
      content: [
        ...images.map((image) => ({
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.data },
        })),
        { type: 'text', text: buildUserText(title, notes, categories, merchantCodes) },
      ],
    },
  ];
  const requestBase = {
    model: MODEL,
    max_tokens: 16000,
    fallbacks: 'default',
    output_config: { effort: 'high' },
    system: SYSTEM_PROMPT,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
      buildTool(categories, merchantCodes),
    ],
  };

  const startedAt = Date.now();
  let message = await callAnthropic({ ...requestBase, messages }, env);
  let continuations = 0;
  // Web search runs in a server-side loop that can pause; re-send the turn to resume it.
  for (; message.stop_reason === 'pause_turn' && continuations < MAX_PAUSE_CONTINUATIONS; continuations++) {
    messages.push({ role: 'assistant', content: message.content ?? [] });
    message = await callAnthropic({ ...requestBase, messages }, env);
  }
  console.log('[inventory-photo-analysis] response', JSON.stringify({
    images: images.length,
    seconds: Math.round((Date.now() - startedAt) / 1000),
    continuations,
    model: message.model,
    stopReason: message.stop_reason,
    usage: message.usage,
    blocks: (message.content ?? []).map((block) => block.type + (block.name ? `:${block.name}` : '')),
  }));

  if (message.stop_reason === 'refusal') {
    throw new Error(`The AI declined to analyze this item${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : '.'}`);
  }

  const toolCall = message.content?.find((block) => block.type === 'tool_use' && block.name === TOOL_NAME);
  if (!toolCall || !toolCall.input || typeof toolCall.input !== 'object') {
    const text = (message.content ?? []).filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    console.warn('[inventory-photo-analysis] no tool call', JSON.stringify({ stopReason: message.stop_reason, text: text.slice(0, 1500) }));
    throw new Error(`The AI did not return an analysis (stop reason: ${message.stop_reason ?? 'unknown'}). Try again.`);
  }

  const input = toolCall.input as Record<string, unknown>;
  const categoryIds = new Map(categories.map((row) => [String(row.id), row]));
  const categoryId = normalizeText(input.category_id, '');
  const primary = categoryIds.get(categoryId);
  const validPrimaryId = primary && primary.parent_id == null ? categoryId : '';
  const secondaryId = normalizeText(input.secondary_category_id, '');
  const secondary = categoryIds.get(secondaryId);
  const validSecondaryId = validPrimaryId && secondary && String(secondary.parent_id) === validPrimaryId ? secondaryId : '';
  const merchantCode = normalizeText(input.merchant_center_cat_code, '');
  const value = Number(input.private_party_value);

  return {
    analysisHtml: sanitizeAnalysisHtml(normalizeText(input.analysis_html, '')),
    fields: {
      title: normalizeText(input.suggested_title, '').slice(0, 240),
      brand: normalizeText(input.brand, '').slice(0, 120),
      model: normalizeText(input.model, '').slice(0, 180),
      finish: normalizeText(input.finish, '').slice(0, 120),
      yearRange: normalizeText(input.year_range, '').slice(0, 120),
      serialNumber: normalizeText(input.serial_number, '').slice(0, 180),
      categoryId: validPrimaryId,
      secondaryCategoryId: validSecondaryId,
      merchantCenterCatCode: merchantCodes.includes(merchantCode) ? merchantCode : '',
      privatePartyValue: Number.isFinite(value) && value > 0 ? Math.round(value) : null,
    },
  };
}

// The analysis (photos + several web searches) can run past Cloudflare's 100s wait for a
// first response byte, so the response streams: a space every few seconds while Claude
// works, then the JSON result. Leading whitespace is still valid JSON for the client.
export async function handleAdminV2InventoryPhotoAnalysis(request: Request, env: Env): Promise<Response> {
  let body: InventoryPhotoAnalysisRequest = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const title = normalizeText(body.title, '').slice(0, 240);
  const notes = normalizeText(body.notes, '').slice(0, 4000);
  const images = parseImages(body.images);
  const merchantCodes = Array.isArray(body.merchantCenterCatCodes)
    ? [...new Set(body.merchantCenterCatCodes
      .map((code) => normalizeText(code, ''))
      .filter((code) => /^[A-Z0-9_]{1,64}$/.test(code)))]
    : [];

  if (images.length === 0) return jsonResponse({ message: 'At least one image is required.' }, 400);
  if (!env.ANTHROPIC_API_KEY) return jsonResponse({ message: 'AI analysis is not configured.' }, 500);

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const heartbeat = setInterval(() => {
    writer.write(encoder.encode(' ')).catch(() => {});
  }, HEARTBEAT_MS);

  const work = (async () => {
    let payload: unknown;
    try {
      payload = { ok: true, ...(await runInventoryPhotoAnalysis(title, notes, images, merchantCodes, env)) };
    } catch (error) {
      console.error('[inventory-photo-analysis] failed', error instanceof Error ? error.message : String(error));
      payload = { ok: false, message: error instanceof Error ? error.message : 'AI analysis failed.' };
    } finally {
      clearInterval(heartbeat);
    }
    await writer.write(encoder.encode(JSON.stringify(payload)));
    await writer.close();
  })();
  work.catch(() => {});

  return new Response(readable, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
