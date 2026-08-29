import type { Env } from '../env.js';
import type { InventoryItemRow, InventoryItemImageRow, InventoryImageInput, InventorySummaryTotals } from '../types/inventory.js';
import { INVENTORY_UNIT_COST_BASIS_SQL } from '../types/inventory.js';
import { INVENTORY_CATEGORY_SELECT_SQL, INVENTORY_CATEGORY_JOIN_SQL } from './db-core.js';
import { dbCcgNumberExists } from './db-core.js';

const CCG_NUMBER_MIN = 100000;
const CCG_NUMBER_MAX = 999999;
const CCG_NUMBER_ATTEMPTS = 25;

function randomIntInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function generateUniqueCcgNumber(env: Env): Promise<string | null> {
  for (let attempt = 0; attempt < CCG_NUMBER_ATTEMPTS; attempt += 1) {
    const value = randomIntInRange(CCG_NUMBER_MIN, CCG_NUMBER_MAX);
    const ccgNumber = `CCG-${value}`;
    const exists = await dbCcgNumberExists(ccgNumber, env);
    if (!exists) return ccgNumber;
  }
  return null;
}

export async function dbCreateInventoryItems(
  fields: {
    source_listing_id: number | null;
    ccg_number: string;
    image_url: string;
    image_urls: string;
    title: string;
    quantity: number;
    category_id: number;
    secondary_category_id: number | null;
    purchase_lot_id?: number | null;
    brand: string | null;
    queue: string;
    year_range: string | null;
    model: string | null;
    finish: string | null;
    repair_notes: string | null;
    original_listing_desc: string | null;
    video_url: string | null;
    sale_title: string | null;
    regular_price: number | null;
    sale_price: number | null;
    condition: string | null;
    allow_shipping?: number;
    sales_tax_included?: number;
    sale_description: string | null;
    clearance: number;
    bullet_1_text: string | null;
    bullet_1_danger: number;
    bullet_1_highlight: number;
    bullet_2_text: string | null;
    bullet_2_danger: number;
    bullet_2_highlight: number;
    bullet_3_text: string | null;
    bullet_3_danger: number;
    bullet_3_highlight: number;
    bullet_4_text: string | null;
    bullet_4_danger: number;
    bullet_4_highlight: number;
    bullet_5_text: string | null;
    bullet_5_danger: number;
    bullet_5_highlight: number;
    bullet_6_text: string | null;
    bullet_6_danger: number;
    bullet_6_highlight: number;
    barcode: string | null;
    purchased_date: string;
    unit_purchase_price: number | null;
    map_price: number | null;
    private_party_value: number;
    miles: number;
    minutes_spent: number;
    ship_cost: number;
    purchase_notes: string | null;
    ai_analysis_text: string | null;
    serial_number: string | null;
    weight_lbs: string | null;
    neck_profile: string | null;
    neck_thickness: string | null;
    nut_width: string | null;
    width_12_fret: string | null;
    fretboard_radius: string | null;
    twelve_fret_action: string | null;
    is_active: number;
    is_marked: number;
    is_personal: number;
    is_rented: number;
    is_custom?: number;
    for_sale: number;
    only_in_store: number;
    sales_channel_ccg?: number;
    sales_channel_fbm?: number;
    sales_channel_cl?: number;
    sales_channel_reverb?: number;
    sales_channel_gear_exchange?: number;
    sales_channel_offerup?: number;
    sales_channel_ebay?: number;
    sales_channel_nextdoor?: number;
    sales_channel_other?: number;
    for_sale_date: string | null;
    is_sold: number;
    sold_date: string | null;
    sold_amount: number | null;
    sell_notes: string | null;
    sale_url: string | null;
    sale_zip: string | null;
    merchant_center_cat_code: string | null;
    tag_reprint?: number;
  },
  env: Env
): Promise<{ firstId: string; ccgNumber: string } | null> {
  try {
    const statement = `INSERT INTO ccg_inventory_items
      (
        source_listing_id, ccg_number, image_url, title, quantity, category_id, brand, queue, year_range, model, finish,
        secondary_category_id,
        image_urls,
        repair_notes, original_listing_desc, video_url, sale_title, regular_price, sale_price, "condition", allow_shipping, sales_tax_included, sale_description, clearance,
        bullet_1_text, bullet_1_danger, bullet_1_highlight,
        bullet_2_text, bullet_2_danger, bullet_2_highlight,
        bullet_3_text, bullet_3_danger, bullet_3_highlight,
        bullet_4_text, bullet_4_danger, bullet_4_highlight,
        bullet_5_text, bullet_5_danger, bullet_5_highlight,
        bullet_6_text, bullet_6_danger, bullet_6_highlight,
        barcode,
        purchased_date, unit_purchase_price, map_price, private_party_value, miles, minutes_spent, ship_cost, purchase_notes, ai_analysis_text, serial_number,
        weight_lbs, neck_profile, neck_thickness, nut_width, width_12_fret, fretboard_radius, twelve_fret_action,
        is_active, is_marked, is_personal, is_rented, is_custom, for_sale, only_in_store,
        sales_channel_ccg, sales_channel_fbm, sales_channel_cl, sales_channel_reverb, sales_channel_gear_exchange,
        sales_channel_offerup, sales_channel_ebay, sales_channel_nextdoor, sales_channel_other,
        for_sale_date,
        is_sold, sold_date, sold_amount, sell_notes, sale_url, sale_zip, merchant_center_cat_code,
        tag_reprint, purchase_lot_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const result = await env.DB.prepare(statement).bind(
      fields.source_listing_id,
      fields.ccg_number,
      fields.image_url,
      fields.title,
      fields.quantity,
      fields.category_id,
      fields.brand,
      fields.queue,
      fields.year_range,
      fields.model,
      fields.finish,
      fields.secondary_category_id,
      fields.image_urls,
      fields.repair_notes,
      fields.original_listing_desc,
      fields.video_url,
      fields.sale_title,
      fields.regular_price,
      fields.sale_price,
      fields.condition,
      fields.allow_shipping ?? 0,
      fields.sales_tax_included ?? 0,
      fields.sale_description,
      fields.clearance,
      fields.bullet_1_text,
      fields.bullet_1_danger,
      fields.bullet_1_highlight,
      fields.bullet_2_text,
      fields.bullet_2_danger,
      fields.bullet_2_highlight,
      fields.bullet_3_text,
      fields.bullet_3_danger,
      fields.bullet_3_highlight,
      fields.bullet_4_text,
      fields.bullet_4_danger,
      fields.bullet_4_highlight,
      fields.bullet_5_text,
      fields.bullet_5_danger,
      fields.bullet_5_highlight,
      fields.bullet_6_text,
      fields.bullet_6_danger,
      fields.bullet_6_highlight,
      fields.barcode,
      fields.purchased_date,
      fields.unit_purchase_price,
      fields.map_price,
      fields.private_party_value,
      fields.miles,
      fields.minutes_spent,
      fields.ship_cost,
      fields.purchase_notes,
      fields.ai_analysis_text,
      fields.serial_number,
      fields.weight_lbs,
      fields.neck_profile,
      fields.neck_thickness,
      fields.nut_width,
      fields.width_12_fret,
      fields.fretboard_radius,
      fields.twelve_fret_action,
      fields.is_active,
      fields.is_marked,
      fields.is_personal,
      fields.is_rented,
      fields.is_custom ?? 0,
      fields.for_sale,
      fields.only_in_store,
      fields.sales_channel_ccg ?? 0,
      fields.sales_channel_fbm ?? 0,
      fields.sales_channel_cl ?? 0,
      fields.sales_channel_reverb ?? 0,
      fields.sales_channel_gear_exchange ?? 0,
      fields.sales_channel_offerup ?? 0,
      fields.sales_channel_ebay ?? 0,
      fields.sales_channel_nextdoor ?? 0,
      fields.sales_channel_other ?? 0,
      fields.for_sale_date,
      fields.is_sold,
      fields.sold_date,
      fields.sold_amount,
      fields.sell_notes,
      fields.sale_url,
      fields.sale_zip,
      fields.merchant_center_cat_code,
      fields.tag_reprint ?? 0,
      fields.purchase_lot_id ?? null,
    ).run();
    const firstId = result.meta?.last_row_id ? String(result.meta.last_row_id) : null;
    if (!firstId) return null;
    return { firstId, ccgNumber: fields.ccg_number };
  } catch (error) {
    console.error('Inventory insert failed', { error });
    return null;
  }
}

export async function dbUpdateInventoryById(
  recordId: string,
  fields: {
    image_url: string;
    image_urls: string;
    title: string;
    quantity: number;
    category_id: number;
    secondary_category_id: number | null;
    purchase_lot_id: number | null;
    brand: string | null;
    queue: string;
    year_range: string | null;
    model: string | null;
    finish: string | null;
    repair_notes: string | null;
    original_listing_desc: string | null;
    purchased_date: string;
    unit_purchase_price: number | null;
    map_price: number | null;
    private_party_value: number;
    miles: number;
    minutes_spent: number;
    ship_cost: number;
    purchase_notes: string | null;
    ai_analysis_text: string | null;
    serial_number: string | null;
    weight_lbs: string | null;
    neck_profile: string | null;
    neck_thickness: string | null;
    nut_width: string | null;
    width_12_fret: string | null;
    fretboard_radius: string | null;
    twelve_fret_action: string | null;
    storage_location: string | null;
    is_active: number;
    is_marked: number;
    is_personal: number;
    is_rented: number;
    is_custom: number;
    for_sale: number;
    only_in_store: number;
    sales_channel_ccg: number;
    sales_channel_fbm: number;
    sales_channel_cl: number;
    sales_channel_reverb: number;
    sales_channel_gear_exchange: number;
    sales_channel_offerup: number;
    sales_channel_ebay: number;
    sales_channel_nextdoor: number;
    sales_channel_other: number;
    for_sale_date: string | null;
    source_listing_id: number | null;
    video_url: string | null;
    sale_title: string | null;
    regular_price: number | null;
    sale_price: number | null;
    condition: string | null;
    allow_shipping: number;
    sales_tax_included: number;
    sale_description: string | null;
    clearance: number;
    bullet_1_text: string | null;
    bullet_1_danger: number;
    bullet_1_highlight: number;
    bullet_2_text: string | null;
    bullet_2_danger: number;
    bullet_2_highlight: number;
    bullet_3_text: string | null;
    bullet_3_danger: number;
    bullet_3_highlight: number;
    bullet_4_text: string | null;
    bullet_4_danger: number;
    bullet_4_highlight: number;
    bullet_5_text: string | null;
    bullet_5_danger: number;
    bullet_5_highlight: number;
    bullet_6_text: string | null;
    bullet_6_danger: number;
    bullet_6_highlight: number;
    barcode: string | null;
    is_sold: number;
    sold_date: string | null;
    sold_amount: number | null;
    sell_notes: string | null;
    subscription_id: number | null;
    sale_url: string | null;
    sale_zip: string | null;
    sold_channel: string | null;
    tag_reprint: number;
    merchant_center_cat_code: string | null;
  },
  env: Env,
): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  try {
    await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET
         image_url = ?, image_urls = ?, title = ?, quantity = ?, category_id = ?, secondary_category_id = ?, purchase_lot_id = ?,
         brand = ?, queue = ?, year_range = ?, model = ?, finish = ?,
         repair_notes = ?, original_listing_desc = ?, purchased_date = ?, unit_purchase_price = ?, map_price = ?,
         private_party_value = ?, miles = ?, minutes_spent = ?, ship_cost = ?, purchase_notes = ?, ai_analysis_text = ?, serial_number = ?,
         weight_lbs = ?, neck_profile = ?, neck_thickness = ?, nut_width = ?, width_12_fret = ?,
         fretboard_radius = ?, twelve_fret_action = ?, storage_location = ?,
         is_active = ?, is_marked = ?, is_personal = ?, is_rented = ?, is_custom = ?, for_sale = ?, only_in_store = ?,
         sales_channel_ccg = ?, sales_channel_fbm = ?, sales_channel_cl = ?, sales_channel_reverb = ?, sales_channel_gear_exchange = ?,
         sales_channel_offerup = ?, sales_channel_ebay = ?, sales_channel_nextdoor = ?, sales_channel_other = ?,
         for_sale_date = ?,
         source_listing_id = ?, video_url = ?, sale_title = ?, regular_price = ?, sale_price = ?, "condition" = ?, allow_shipping = ?, sales_tax_included = ?, sale_description = ?,
         clearance = ?,
         bullet_1_text = ?, bullet_1_danger = ?, bullet_1_highlight = ?,
         bullet_2_text = ?, bullet_2_danger = ?, bullet_2_highlight = ?,
         bullet_3_text = ?, bullet_3_danger = ?, bullet_3_highlight = ?,
         bullet_4_text = ?, bullet_4_danger = ?, bullet_4_highlight = ?,
         bullet_5_text = ?, bullet_5_danger = ?, bullet_5_highlight = ?,
         bullet_6_text = ?, bullet_6_danger = ?, bullet_6_highlight = ?,
         barcode = ?,
         is_sold = ?, sold_date = ?, sold_amount = ?, sell_notes = ?, subscription_id = ?,
         sale_url = ?, sale_zip = ?, sold_channel = ?,
         tag_reprint = ?,
         merchant_center_cat_code = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      fields.image_url,
      fields.image_urls,
      fields.title,
      fields.quantity,
      fields.category_id,
      fields.secondary_category_id,
      fields.purchase_lot_id,
      fields.brand,
      fields.queue,
      fields.year_range,
      fields.model,
      fields.finish,
      fields.repair_notes,
      fields.original_listing_desc,
      fields.purchased_date,
      fields.unit_purchase_price,
      fields.map_price,
      fields.private_party_value,
      fields.miles,
      fields.minutes_spent,
      fields.ship_cost,
      fields.purchase_notes,
      fields.ai_analysis_text,
      fields.serial_number,
      fields.weight_lbs,
      fields.neck_profile,
      fields.neck_thickness,
      fields.nut_width,
      fields.width_12_fret,
      fields.fretboard_radius,
      fields.twelve_fret_action,
      fields.storage_location,
      fields.is_active,
      fields.is_marked,
      fields.is_personal,
      fields.is_rented,
      fields.is_custom,
      fields.for_sale,
      fields.only_in_store,
      fields.sales_channel_ccg,
      fields.sales_channel_fbm,
      fields.sales_channel_cl,
      fields.sales_channel_reverb,
      fields.sales_channel_gear_exchange,
      fields.sales_channel_offerup,
      fields.sales_channel_ebay,
      fields.sales_channel_nextdoor,
      fields.sales_channel_other,
      fields.for_sale_date,
      fields.source_listing_id,
      fields.video_url,
      fields.sale_title,
      fields.regular_price,
      fields.sale_price,
      fields.condition,
      fields.allow_shipping,
      fields.sales_tax_included,
      fields.sale_description,
      fields.clearance,
      fields.bullet_1_text,
      fields.bullet_1_danger,
      fields.bullet_1_highlight,
      fields.bullet_2_text,
      fields.bullet_2_danger,
      fields.bullet_2_highlight,
      fields.bullet_3_text,
      fields.bullet_3_danger,
      fields.bullet_3_highlight,
      fields.bullet_4_text,
      fields.bullet_4_danger,
      fields.bullet_4_highlight,
      fields.bullet_5_text,
      fields.bullet_5_danger,
      fields.bullet_5_highlight,
      fields.bullet_6_text,
      fields.bullet_6_danger,
      fields.bullet_6_highlight,
      fields.barcode,
      fields.is_sold,
      fields.sold_date,
      fields.sold_amount,
      fields.sell_notes,
      fields.subscription_id,
      fields.sale_url,
      fields.sale_zip,
      fields.sold_channel,
      fields.tag_reprint,
      fields.merchant_center_cat_code,
      idValue,
    ).run();
    return true;
  } catch (error) {
    console.error('Inventory row update failed', { error });
    return false;
  }
}

export async function dbSetInventorySoldAvailability(
  recordId: string,
  isSold: boolean,
  env: Env,
): Promise<void> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return;

  if (isSold) {
    await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET availability_status = 'sold',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(idValue).run();
    return;
  }

  await env.DB.prepare(
    `UPDATE ccg_inventory_items
     SET availability_status = 'available',
         active_order_id = NULL,
         reserved_until = NULL,
         sold_date = NULL,
         sold_amount = NULL,
         sell_notes = NULL,
         sold_channel = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(idValue).run();
}

export async function dbClearInventoryTagReprint(recordId: string, env: Env): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  try {
    await env.DB.prepare(
      `UPDATE ccg_inventory_items SET tag_reprint = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(idValue).run();
    return true;
  } catch (error) {
    console.error('Failed to clear tag_reprint', { error });
    return false;
  }
}

export async function dbSetInventoryMarked(recordId: string, isMarked: boolean, env: Env): Promise<boolean> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return false;
  try {
    const result = await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET is_marked = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(isMarked ? 1 : 0, idValue).run();
    return Number(result.meta?.changes || 0) > 0;
  } catch (error) {
    console.error('Inventory mark update failed', { error });
    return false;
  }
}

export async function dbDeactivateInventoryItemById(recordId: string, env: Env): Promise<number> {
  const idValue = Number.parseInt(recordId, 10);
  if (!Number.isFinite(idValue)) return 0;
  try {
    const result = await env.DB.prepare(
      'UPDATE ccg_inventory_items SET is_active = 0, for_sale = 0, is_marked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(idValue).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory deactivate failed', { error });
    return 0;
  }
}

export async function dbDeleteInventoryItemsByIds(ids: number[], env: Env): Promise<number> {
  const normalizedIds = ids.filter((id) => Number.isFinite(id) && id > 0);
  if (normalizedIds.length === 0) return 0;
  try {
    await dbDeleteInventoryImagesByItemIds(normalizedIds, env);
    await dbDeleteInventoryTagsByItemIds(normalizedIds, env);
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `DELETE FROM ccg_inventory_items WHERE id IN (${placeholders})`
    ).bind(...normalizedIds).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory bulk delete failed', { error });
    return 0;
  }
}

export async function dbListMarkedInventoryRowsForPackage(env: Env): Promise<InventoryItemRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      i.id,
      i.source_listing_id,
      i.ccg_number,
      i.image_url,
      i.image_urls,
      i.title,
      i.quantity,
      ${INVENTORY_CATEGORY_SELECT_SQL},
      i.brand,
      i.year_range,
      i.model,
      i.finish,
      i.original_listing_desc,
      i.purchased_date,
      i.unit_purchase_price,
      i.private_party_value,
      i.purchase_notes,
      i.serial_number,
      i.is_active,
      i.is_marked,
      i.is_personal,
      i.for_sale,
      i.for_sale_date,
      i.is_sold,
      i.sold_date,
      i.sold_amount,
      i.sell_notes,
      i.created_at,
      i.updated_at
     FROM ccg_inventory_items i
     ${INVENTORY_CATEGORY_JOIN_SQL}
     WHERE COALESCE(i.is_marked, 0) = 1
     ORDER BY i.created_at ASC, i.id ASC`
  ).all<InventoryItemRow>();
  return result.results ?? [];
}

export async function dbListInventoryImagesForItemIds(
  itemIds: number[],
  env: Env,
): Promise<Map<number, Array<{ id: string; url: string; order: number; isPrivate: boolean }>>> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  const output = new Map<number, Array<{ id: string; url: string; order: number; isPrivate: boolean }>>();
  if (normalizedIds.length === 0) return output;
  try {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `SELECT id, inventory_item_id, image_url, display_order, is_private
       FROM ccg_inventory_item_images
       WHERE inventory_item_id IN (${placeholders})
       ORDER BY inventory_item_id ASC, display_order ASC, id ASC`
    ).bind(...normalizedIds).all<InventoryItemImageRow>();
    for (const row of result.results ?? []) {
      const key = Number(row.inventory_item_id);
      if (!output.has(key)) output.set(key, []);
      output.get(key)?.push({
        id: String(row.id),
        url: String(row.image_url || '').trim(),
        order: Number(row.display_order || 0),
        isPrivate: Boolean(row.is_private),
      });
    }
  } catch (error) {
    console.warn('Inventory image child lookup failed; falling back to legacy image columns.', { error });
  }
  return output;
}

export async function dbReplaceInventoryImagesByItemIds(
  itemIds: number[],
  images: InventoryImageInput[],
  env: Env,
): Promise<boolean> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (normalizedIds.length === 0) return true;
  try {
    await dbDeleteInventoryImagesByItemIds(normalizedIds, env);
    if (images.length === 0) return true;
    const statements = normalizedIds.flatMap((inventoryItemId) =>
      images.map((image, index) =>
        env.DB.prepare(
          `INSERT INTO ccg_inventory_item_images (inventory_item_id, image_url, display_order, is_private)
           VALUES (?, ?, ?, ?)`
        ).bind(inventoryItemId, image.url, index + 1, image.isPrivate ? 1 : 0),
      ),
    );
    await env.DB.batch(statements);
    return true;
  } catch (error) {
    console.error('Inventory image child replace failed', { error });
    return false;
  }
}

export async function dbDeleteInventoryImagesByItemIds(itemIds: number[], env: Env): Promise<void> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (normalizedIds.length === 0) return;
  try {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    await env.DB.prepare(
      `DELETE FROM ccg_inventory_item_images WHERE inventory_item_id IN (${placeholders})`
    ).bind(...normalizedIds).run();
  } catch (error) {
    console.warn('Inventory image child delete skipped', { error });
  }
}

const INVENTORY_TAG_PATTERN = /^[a-z0-9_]{1,50}$/;

export function normalizeInventoryTagsInput(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const normalized = raw.trim().toLowerCase();
    if (!INVENTORY_TAG_PATTERN.test(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= 200) break;
  }
  return output;
}

export async function dbListInventoryTagsForItemIds(
  itemIds: number[],
  env: Env,
): Promise<Map<number, string[]>> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  const output = new Map<number, string[]>();
  if (normalizedIds.length === 0) return output;
  try {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `SELECT inventory_item_id, tag
       FROM ccg_inventory_item_tags
       WHERE inventory_item_id IN (${placeholders})
       ORDER BY inventory_item_id ASC, tag ASC`
    ).bind(...normalizedIds).all<{ inventory_item_id: number; tag: string }>();
    for (const row of result.results ?? []) {
      const key = Number(row.inventory_item_id);
      if (!output.has(key)) output.set(key, []);
      output.get(key)?.push(String(row.tag));
    }
  } catch (error) {
    console.warn('Inventory tag lookup failed', { error });
  }
  return output;
}

export async function dbReplaceInventoryTagsByItemIds(
  itemIds: number[],
  tags: string[],
  env: Env,
): Promise<boolean> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (normalizedIds.length === 0) return true;
  try {
    await dbDeleteInventoryTagsByItemIds(normalizedIds, env);
    if (tags.length === 0) return true;
    const statements = normalizedIds.flatMap((inventoryItemId) =>
      tags.map((tag) =>
        env.DB.prepare(
          `INSERT INTO ccg_inventory_item_tags (inventory_item_id, tag) VALUES (?, ?)`
        ).bind(inventoryItemId, tag),
      ),
    );
    await env.DB.batch(statements);
    return true;
  } catch (error) {
    console.error('Inventory tag child replace failed', { error });
    return false;
  }
}

export async function dbDeleteInventoryTagsByItemIds(itemIds: number[], env: Env): Promise<void> {
  const normalizedIds = Array.from(new Set(itemIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (normalizedIds.length === 0) return;
  try {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    await env.DB.prepare(
      `DELETE FROM ccg_inventory_item_tags WHERE inventory_item_id IN (${placeholders})`
    ).bind(...normalizedIds).run();
  } catch (error) {
    console.warn('Inventory tag child delete skipped', { error });
  }
}

export async function dbListAllInventoryImageRefs(env: Env): Promise<Array<{ image_url: string | null; image_urls: string | null }>> {
  const [legacyResult, childResult] = await Promise.all([
    env.DB.prepare('SELECT image_url, image_urls FROM ccg_inventory_items')
      .all<{ image_url: string | null; image_urls: string | null }>(),
    env.DB.prepare(
      `SELECT NULL AS image_url, GROUP_CONCAT(image_url, char(10)) AS image_urls
       FROM (
         SELECT inventory_item_id, image_url
         FROM ccg_inventory_item_images
         ORDER BY inventory_item_id ASC, display_order ASC, id ASC
       )
       GROUP BY inventory_item_id`
    ).all<{ image_url: string | null; image_urls: string | null }>(),
  ]);
  return [...(legacyResult.results ?? []), ...(childResult.results ?? [])];
}

export async function dbGetInventorySummary(env: Env): Promise<InventorySummaryTotals> {
  const row = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN i.is_active = 1 THEN l.price_asking ELSE 0 END), 0) AS total_listed,
      COALESCE(SUM(CASE WHEN i.is_sold = 1 THEN i.sold_amount ELSE 0 END), 0) AS total_sold,
      COALESCE(SUM(${INVENTORY_UNIT_COST_BASIS_SQL}), 0) AS total_purchased,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 0 AND COALESCE(i.is_personal, 0) = 0 THEN ${INVENTORY_UNIT_COST_BASIS_SQL} ELSE 0 END), 0) AS ccg_paid_unsold,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 0 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.private_party_value, 0) ELSE 0 END), 0) AS ccg_private_party_unsold,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN ${INVENTORY_UNIT_COST_BASIS_SQL} ELSE 0 END), 0) AS ccg_sold_paid,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.private_party_value, 0) ELSE 0 END), 0) AS ccg_sold_private_party,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN (COALESCE(i.sold_amount, 0) - (${INVENTORY_UNIT_COST_BASIS_SQL})) ELSE 0 END), 0) AS ccg_sold_profit_amount,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND i.is_sold = 1 AND COALESCE(i.is_personal, 0) = 0 THEN COALESCE(i.sold_amount, 0) ELSE 0 END), 0) AS ccg_sold_amount_total,
      COALESCE(SUM(CASE WHEN i.is_active = 1 THEN 1 ELSE 0 END), 0) AS ccg_active_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.for_sale, 0) = 0 THEN 1 ELSE 0 END), 0) AS ccg_not_for_sale_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.for_sale, 0) = 1 THEN 1 ELSE 0 END), 0) AS ccg_for_sale_items,
      COALESCE(SUM(CASE WHEN i.is_active = 1 AND COALESCE(i.is_sold, 0) = 1 THEN 1 ELSE 0 END), 0) AS ccg_sold_items
     FROM ccg_inventory_items i
     LEFT JOIN listings l ON l.id = i.source_listing_id`
  ).first<{
    total_listed: number | null;
    total_sold: number | null;
    total_purchased: number | null;
    ccg_paid_unsold: number | null;
    ccg_private_party_unsold: number | null;
    ccg_sold_paid: number | null;
    ccg_sold_private_party: number | null;
    ccg_sold_profit_amount: number | null;
    ccg_sold_amount_total: number | null;
    ccg_active_items: number | null;
    ccg_not_for_sale_items: number | null;
    ccg_for_sale_items: number | null;
    ccg_sold_items: number | null;
  }>();

  const soldProfitAmount = Number(row?.ccg_sold_profit_amount || 0);
  const soldAmountTotal = Number(row?.ccg_sold_amount_total || 0);
  const soldProfitMarginPercent = soldAmountTotal > 0
    ? (soldProfitAmount / soldAmountTotal) * 100
    : 0;

  return {
    totalListed: Number(row?.total_listed || 0),
    totalSold: Number(row?.total_sold || 0),
    totalPurchased: Number(row?.total_purchased || 0),
    ccgPaidUnsold: Number(row?.ccg_paid_unsold || 0),
    ccgPrivatePartyUnsold: Number(row?.ccg_private_party_unsold || 0),
    ccgSoldPaid: Number(row?.ccg_sold_paid || 0),
    ccgSoldPrivateParty: Number(row?.ccg_sold_private_party || 0),
    ccgSoldProfitMarginPercent: soldProfitMarginPercent,
    ccgActiveItems: Number(row?.ccg_active_items || 0),
    ccgNotForSaleItems: Number(row?.ccg_not_for_sale_items || 0),
    ccgForSaleItems: Number(row?.ccg_for_sale_items || 0),
    ccgSoldItems: Number(row?.ccg_sold_items || 0),
  };
}

export async function dbUnmarkAllInventoryItems(env: Env): Promise<number> {
  try {
    const result = await env.DB.prepare(
      `UPDATE ccg_inventory_items
       SET is_marked = 0, updated_at = CURRENT_TIMESTAMP
       WHERE COALESCE(is_marked, 0) = 1`
    ).run();
    return Number(result.meta?.changes || 0);
  } catch (error) {
    console.error('Inventory unmark all failed', { error });
    return 0;
  }
}

export async function dbListMarkedInventoryLabelRows(
  env: Env,
): Promise<Array<{ ccg_number: string | null; title: string | null; image_url: string | null }>> {
  const result = await env.DB.prepare(
    `SELECT
      i.ccg_number,
      i.title,
      i.image_url
     FROM ccg_inventory_items i
     WHERE COALESCE(i.is_marked, 0) = 1
     ORDER BY i.created_at ASC, i.id ASC`
  ).all<{ ccg_number: string | null; title: string | null; image_url: string | null }>();
  return result.results ?? [];
}
