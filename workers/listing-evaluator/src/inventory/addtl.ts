import type { Env } from '../env.js';

// ccg_inventory_items sits at D1's 100-column hard limit, so any new per-item
// setting goes in this 1:1 extension table instead of a new column on the
// main table. Keyed by inventory_item_id; upsert on every inventory save.
export type InventoryItemAddtlRow = {
  inventory_item_id: number;
  fixed_shipping_amount: number;
};

export async function dbUpsertInventoryAddtl(
  inventoryItemId: number,
  fields: { fixed_shipping_amount: number },
  env: Env,
): Promise<boolean> {
  if (!Number.isFinite(inventoryItemId)) return false;
  try {
    await env.DB.prepare(
      `INSERT INTO ccg_inventory_items_addtl (inventory_item_id, fixed_shipping_amount, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(inventory_item_id) DO UPDATE SET
         fixed_shipping_amount = excluded.fixed_shipping_amount,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(inventoryItemId, fields.fixed_shipping_amount).run();
    return true;
  } catch (error) {
    console.error('Inventory addtl upsert failed', { error, inventoryItemId });
    return false;
  }
}

export async function dbGetInventoryAddtl(inventoryItemId: number, env: Env): Promise<InventoryItemAddtlRow | null> {
  if (!Number.isFinite(inventoryItemId)) return null;
  const row = await env.DB.prepare(
    `SELECT inventory_item_id, fixed_shipping_amount
     FROM ccg_inventory_items_addtl
     WHERE inventory_item_id = ?`
  ).bind(inventoryItemId).first<InventoryItemAddtlRow>();
  return row ?? null;
}
