// Save a Claude evaluation straight to an inventory item (save_inventory_evaluation).
//
// Rules (owner's choices):
// - Always overwrite: AI Analysis, title (as "Brand Model"), brand, model, finish, year range,
//   serial number, category, Merchant Center category, private party value — each only when
//   Claude returned a value for it.
// - Never marks the item For Sale. Moves it to the "To Sell" queue; Unit Cost becomes $1 when
//   it is blank (same as the paste flow's Fill).
// - With a listing (Build Listing): sale title, description and bullets 1–5, the sale URL slug
//   when it is blank (unique), and "FINANCING AVAILABLE!" as bullet 6 when the item had no
//   bullet text yet (same as Fill).
// - An item that is already for sale (For Sale, Reverb, Gear Exchange, Facebook Marketplace) or
//   sold only gets its AI Analysis and private party value: its listing is live elsewhere and
//   this save does not go through the Reverb / Gear Exchange sync.
// The history row (previous values, for Undo), the item update and the queue entry go in one
// D1 batch.

import type { Env } from '../env.js';
import { dbFindInventoryBySaleUrl } from '../inventory/db-core.js';
import { buildInventoryCategoryTree, dbListInventoryCategories } from '../inventory/categories.js';
import type { InventoryCategoryNode } from '../types/inventory.js';
import {
  MERCHANT_CENTER_CATEGORY_OPTIONS,
  fitBullet,
  saleUrlSlugFromTitle,
  stripTrailingJsonBlock,
} from '../../../../shared/claude-eval-rules.js';
import { dbFindRecentDuplicate, dbInsertEvaluation } from './db.js';
import { renderAnalysisHtml } from './render.js';
import { dbMarkQueueDoneStatement } from './queue.js';
import { asTrimmedString, sha256Hex } from './util.js';

export const INVENTORY_EVAL_COLUMNS = [
  'ai_analysis_text',
  'title',
  'brand',
  'model',
  'finish',
  'year_range',
  'serial_number',
  'category_id',
  'secondary_category_id',
  'merchant_center_cat_code',
  'private_party_value',
  'queue',
  'unit_purchase_price',
  'sale_title',
  'sale_description',
  'bullet_1_text',
  'bullet_2_text',
  'bullet_3_text',
  'bullet_4_text',
  'bullet_5_text',
  'bullet_6_text',
  'bullet_6_danger',
  'bullet_6_highlight',
  'sale_url',
] as const;
type InventoryEvalColumn = (typeof INVENTORY_EVAL_COLUMNS)[number];
type InventoryEvalValues = Partial<Record<InventoryEvalColumn, string | number | null>>;

const COLUMN_LABELS: Record<InventoryEvalColumn, string> = {
  ai_analysis_text: 'AI Analysis',
  title: 'Title',
  brand: 'Brand',
  model: 'Model',
  finish: 'Finish',
  year_range: 'Year',
  serial_number: 'Serial Number',
  category_id: 'Category',
  secondary_category_id: 'Category',
  merchant_center_cat_code: 'Merchant Center Category',
  private_party_value: 'Private Party Value',
  queue: 'Queue (To Sell)',
  unit_purchase_price: 'Unit Cost',
  sale_title: 'Sale Title',
  sale_description: 'Description',
  bullet_1_text: 'Bullets',
  bullet_2_text: 'Bullets',
  bullet_3_text: 'Bullets',
  bullet_4_text: 'Bullets',
  bullet_5_text: 'Bullets',
  bullet_6_text: 'Bullets',
  bullet_6_danger: 'Bullets',
  bullet_6_highlight: 'Bullets',
  sale_url: 'Sale URL',
};

export function inventoryColumnLabels(columns: string[]): string[] {
  return Array.from(new Set(columns.map((column) => COLUMN_LABELS[column as InventoryEvalColumn] || column)));
}

type InventoryRow = {
  id: number;
  for_sale: number | null;
  is_sold: number | null;
  reverb_listing_id: string | null;
  fb_listing_id: string | null;
} & Record<InventoryEvalColumn, string | number | null>;

async function loadInventoryRow(env: Env, itemId: string): Promise<InventoryRow | null> {
  const idValue = Number.parseInt(itemId, 10);
  if (!Number.isFinite(idValue) || String(idValue) !== itemId.trim()) return null;
  return env.DB.prepare(
    `SELECT id, for_sale, is_sold, reverb_listing_id, fb_listing_id, ${INVENTORY_EVAL_COLUMNS.join(', ')}
     FROM ccg_inventory_items WHERE id = ? LIMIT 1`
  ).bind(idValue).first<InventoryRow>();
}

// Where the item is currently for sale (or that it is sold). Empty = safe to update fully.
export async function inventoryLiveChannels(env: Env, itemId: string, row?: InventoryRow | null): Promise<string[]> {
  const item = row ?? (await loadInventoryRow(env, itemId));
  if (!item) return [];
  const channels: string[] = [];
  if (item.is_sold) channels.push('marked Sold');
  if (item.for_sale) channels.push('CCG shop (For Sale)');
  if (item.reverb_listing_id) channels.push('Reverb');
  let onGx = false;
  try {
    const gx = await env.DB.prepare('SELECT 1 AS linked FROM ccg_inventory_gx_listings WHERE inventory_item_id = ? LIMIT 1')
      .bind(item.id)
      .first<{ linked: number }>();
    onGx = Boolean(gx);
  } catch {
    // Table missing in some environments: treat as not on Gear Exchange.
  }
  if (onGx) channels.push('Gear Exchange');
  if (item.fb_listing_id) channels.push('Facebook Marketplace');
  return channels;
}

type CategoryOption = { id: number; name: string; parentId: number | null; line: string };

async function categoryOptions(env: Env): Promise<CategoryOption[]> {
  const tree = buildInventoryCategoryTree(await dbListInventoryCategories(env));
  const options: CategoryOption[] = [];
  const walk = (nodes: InventoryCategoryNode[], parent: InventoryCategoryNode | null) => {
    for (const node of nodes) {
      options.push({ id: node.id, name: node.name, parentId: node.parentId, line: parent ? `${parent.name} > ${node.name}` : node.name });
      walk(node.children || [], node);
    }
  };
  walk(tree, null);
  return options;
}

export async function inventoryCategoryLines(env: Env): Promise<string[]> {
  return (await categoryOptions(env)).map((option) => option.line);
}

// Same matching as the inventory page's Fill: exact "Parent > Child" line, else the last segment
// by name. A child category is stored as category = its parent, secondary = the child.
function matchCategory(options: CategoryOption[], category: string): { categoryId: number; secondaryId: number | null } | null {
  const wanted = category.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!wanted) return null;
  const lastSegment = wanted.split('>').pop()?.trim() || '';
  const match = options.find((option) => option.line.toLowerCase() === wanted)
    || options.find((option) => option.name.toLowerCase() === lastSegment);
  if (!match) return null;
  return match.parentId != null
    ? { categoryId: match.parentId, secondaryId: match.id }
    : { categoryId: match.id, secondaryId: null };
}

async function uniqueSaleUrl(env: Env, base: string, itemId: string): Promise<string> {
  if (!base) return '';
  for (let suffix = 1; suffix <= 20; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await dbFindInventoryBySaleUrl(candidate, env, itemId);
    if (!existing) return candidate;
  }
  return '';
}

export type InventorySaveInput = {
  itemId: string;
  userId: string;
  queueId?: string | null;
  analysisMarkdown: string;
  fields: Record<string, unknown>;
  listing: { sale_title?: unknown; description?: unknown; bullets?: unknown } | null;
};

export type InventorySaveResult =
  | {
      ok: true;
      evaluationId: string;
      itemId: string;
      title: string;
      written: string[];
      liveChannels: string[];
      listingSkipped: boolean;
      deduplicated: boolean;
      savedAt: string;
    }
  | { ok: false; error: string };

export async function saveInventoryEvaluation(env: Env, input: InventorySaveInput): Promise<InventorySaveResult> {
  const row = await loadInventoryRow(env, input.itemId);
  if (!row) return { ok: false, error: `No inventory item with id "${input.itemId}". Use the item_id from get_next_queued_item.` };

  const markdown = stripTrailingJsonBlock(input.analysisMarkdown.trim());
  if (!markdown) return { ok: false, error: 'analysis_markdown is empty. Pass the full readout you showed the owner.' };
  if (markdown.length > 60000) return { ok: false, error: 'analysis_markdown is longer than 60,000 characters. Shorten it and save again.' };

  const itemId = String(row.id);
  const contentHash = await sha256Hex(JSON.stringify([markdown, input.fields, input.listing]));
  const duplicate = await dbFindRecentDuplicate(env, { kind: 'inventory', recordId: itemId, draftKey: null }, contentHash);
  if (duplicate) {
    if (input.queueId) await dbMarkQueueDoneStatement(env, input.queueId, duplicate.id).run();
    return {
      ok: true,
      evaluationId: duplicate.id,
      itemId,
      title: String(row.title || ''),
      written: [],
      liveChannels: [],
      listingSkipped: false,
      deduplicated: true,
      savedAt: new Date(duplicate.created_at).toISOString(),
    };
  }

  const liveChannels = await inventoryLiveChannels(env, itemId, row);
  const isLive = liveChannels.length > 0;
  const f = input.fields || {};
  const values: InventoryEvalValues = {};
  const analysisHtml = renderAnalysisHtml(markdown);
  values.ai_analysis_text = analysisHtml;

  const ppvRaw = f.private_party_value;
  const ppv = typeof ppvRaw === 'number' ? ppvRaw : typeof ppvRaw === 'string' ? Number(ppvRaw.replace(/[$,\s]/g, '')) : 0;
  if (Number.isFinite(ppv) && ppv > 0) values.private_party_value = Math.round(ppv);

  let listingSkipped = false;
  if (!isLive) {
    const brand = asTrimmedString(f.brand, 120);
    const model = asTrimmedString(f.model, 180);
    const textFields: Array<[InventoryEvalColumn, string]> = [
      ['brand', brand],
      ['model', model],
      ['finish', asTrimmedString(f.finish, 120)],
      ['year_range', asTrimmedString(f.year_range, 120)],
      ['serial_number', asTrimmedString(f.serial_number, 120)],
    ];
    for (const [column, value] of textFields) if (value) values[column] = value;

    const claudeTitle = asTrimmedString(f.title, 240);
    if (brand && model) values.title = `${brand} ${model}`.slice(0, 240);
    else if (claudeTitle && !String(row.title || '').trim()) values.title = claudeTitle;

    const category = matchCategory(await categoryOptions(env), asTrimmedString(f.category, 240));
    if (category) {
      values.category_id = category.categoryId;
      values.secondary_category_id = category.secondaryId;
    }

    const merchant = asTrimmedString(f.merchant_center_category, 80).toUpperCase();
    if (merchant && MERCHANT_CENTER_CATEGORY_OPTIONS.some((option) => option.key === merchant)) {
      values.merchant_center_cat_code = merchant;
    }

    values.queue = 'To Sell';
    if (!Number(row.unit_purchase_price || 0)) values.unit_purchase_price = 1;

    const listing = input.listing;
    if (listing) {
      const saleTitle = asTrimmedString(listing.sale_title, 200).replace(/^\s*title\s*[:\-–—]\s*/i, '');
      const description = typeof listing.description === 'string'
        ? listing.description.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000)
        : '';
      const bullets = Array.isArray(listing.bullets)
        ? listing.bullets.map((bullet) => (typeof bullet === 'string' ? fitBullet(bullet) : '')).filter(Boolean).slice(0, 5)
        : [];
      const hadBulletText = [1, 2, 3, 4, 5, 6].some((n) => String(row[`bullet_${n}_text` as InventoryEvalColumn] || '').trim());
      if (saleTitle) values.sale_title = saleTitle;
      if (description) values.sale_description = description;
      bullets.forEach((bullet, index) => {
        values[`bullet_${index + 1}_text` as InventoryEvalColumn] = bullet;
      });
      if (!hadBulletText && bullets.length) {
        values.bullet_6_text = 'FINANCING AVAILABLE!';
        values.bullet_6_danger = 0;
        values.bullet_6_highlight = 1;
      }
      if (saleTitle && !String(row.sale_url || '').trim()) {
        const slug = await uniqueSaleUrl(env, saleUrlSlugFromTitle(saleTitle).slice(0, 150), itemId);
        if (slug) values.sale_url = slug;
      }
    }
  } else if (input.listing) {
    listingSkipped = true;
  }

  const previous: InventoryEvalValues = {};
  for (const column of Object.keys(values) as InventoryEvalColumn[]) previous[column] = row[column] ?? null;

  const now = Date.now();
  const evaluationId = crypto.randomUUID();
  const columns = Object.keys(values) as InventoryEvalColumn[];
  const statements: D1PreparedStatement[] = [
    dbInsertEvaluation(env, {
      id: evaluationId,
      kind: 'inventory',
      record_id: itemId,
      draft_key: null,
      user_id: input.userId,
      analysis_md: markdown,
      analysis_html: analysisHtml,
      fields_json: JSON.stringify(input.fields || {}),
      listing_json: input.listing ? JSON.stringify(input.listing) : null,
      options_json: JSON.stringify({ live_channels: liveChannels }),
      previous_values_json: JSON.stringify(previous),
      fields_written_json: JSON.stringify(values),
      status: 'saved',
      content_hash: contentHash,
      source: 'claude-connector',
      created_at: now,
      applied_at: now,
      undone_at: null,
    }),
    env.DB.prepare(
      `UPDATE ccg_inventory_items SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(...columns.map((column) => values[column] ?? null), row.id),
  ];
  if (input.queueId) statements.push(dbMarkQueueDoneStatement(env, input.queueId, evaluationId));
  await env.DB.batch(statements);

  return {
    ok: true,
    evaluationId,
    itemId,
    title: String(values.title ?? row.title ?? ''),
    written: inventoryColumnLabels(columns),
    liveChannels,
    listingSkipped,
    deduplicated: false,
    savedAt: new Date(now).toISOString(),
  };
}
