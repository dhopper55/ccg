import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { jsonResponse } from '../utils/misc.js';
import { dbListInventoryItems } from './db-core.js';
import { dbListInventoryBrands } from './db-core.js';
import { normalizeInventoryQueue, parseInventoryTriState, parseInventorySortKey, parseInventorySortDir } from './db-core.js';
import { generateUniqueCcgNumber } from './db-write.js';
import { dbGetInventorySummary } from './db-write.js';

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  let parsed: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    parsed = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const next = Number.parseInt(value.trim(), 10);
    parsed = Number.isFinite(next) ? next : null;
  }
  if (parsed == null) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseOptionalPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export async function handleInventoryList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
  const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, 1_000_000);
  const categoryId = parseOptionalPositiveInt(url.searchParams.get('categoryId'));
  const brand = normalizeText(url.searchParams.get('brand'), '').slice(0, 120);
  const queue = normalizeInventoryQueue(url.searchParams.get('queue'));
  const sold = parseInventoryTriState(url.searchParams.get('sold'), 'no');
  const active = parseInventoryTriState(url.searchParams.get('active'), 'yes');
  const marked = parseInventoryTriState(url.searchParams.get('marked') ?? url.searchParams.get('onlyMarked'), 'all');
  const personal = parseInventoryTriState(url.searchParams.get('personal') ?? url.searchParams.get('onlyPersonal'), 'all');
  const tagReprintParam = url.searchParams.get('tagReprint');
  const tagReprint = tagReprintParam === '1' || tagReprintParam === 'true' || tagReprintParam === 'yes';
  const sortBy = parseInventorySortKey(url.searchParams.get('sortBy'));
  const sortDir = parseInventorySortDir(url.searchParams.get('sortDir'));

  const availableBrands = await dbListInventoryBrands({ categoryId, sold, active, marked, personal, queue, tagReprint }, env);

  const result = await dbListInventoryItems({
    categoryId,
    brand,
    queue,
    sold,
    active,
    marked,
    personal,
    tagReprint,
    page,
    limit,
    sortBy,
    sortDir,
  }, env);

  return jsonResponse({
    records: result.records,
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    availableBrands,
  });
}

export async function handleInventorySummary(env: Env): Promise<Response> {
  const totals = await dbGetInventorySummary(env);
  return jsonResponse(totals);
}

export async function handleInventoryNextCcgNumber(env: Env): Promise<Response> {
  const ccgNumber = await generateUniqueCcgNumber(env);
  if (!ccgNumber) {
    return jsonResponse({ message: 'Unable to generate CCG Number. Please try again.' }, 500);
  }
  return jsonResponse({ ccgNumber });
}

export function validateForSaleInventoryFields(input: {
  forSale: boolean;
  saleTitle: string;
  salePrice: number | null;
  regularPrice: number | null;
  condition: string;
  saleDescription: string;
  bulletTexts: string[];
  saleUrl: string;
  saleZip: string;
}): string | null {
  if (!input.forSale) return null;
  if (!input.saleTitle.trim()) return 'Sale Details Title is required when For Sale is checked.';
  if ((input.salePrice ?? 0) <= 0) return 'Sale Details Sale Price is required when For Sale is checked.';
  if ((input.regularPrice ?? 0) <= 0) {
    return 'Sale Details Regular Price is required when For Sale is checked.';
  }
  if (!input.condition.trim()) return 'Sale Details Condition is required when For Sale is checked.';
  if (!input.saleDescription.trim()) {
    return 'Sale Details Description is required when For Sale is checked.';
  }
  if (!input.bulletTexts.some((bulletText) => bulletText.trim())) {
    return 'At least one Sale Details bullet is required when For Sale is checked.';
  }
  if (!input.saleUrl.trim()) return 'Sale Details URL is required when For Sale is checked.';
  if (!isValidSaleUrlSlug(input.saleUrl)) {
    return 'Sale Details URL must use only lowercase letters, numbers, and hyphens.';
  }
  if (!input.saleZip.trim()) return 'Sale Details ZIP is required when For Sale is checked.';
  return null;
}

function isValidSaleUrlSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

export function resolveToggleTimestamp(args: {
  previousOn: boolean;
  nextOn: boolean;
  previousTimestamp: string | null;
}): string | null {
  if (!args.nextOn) return null;
  if (args.previousOn && args.previousTimestamp) return args.previousTimestamp;
  return new Date().toISOString();
}
