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

// Batched lookup for list queries — avoids N+1 and, more importantly, avoids
// joining this table into the main inventory queries, several of which are
// already at D1's 100-column-per-result-set limit.
export async function dbGetInventoryAddtlForIds(
  inventoryItemIds: number[],
  env: Env,
): Promise<Map<number, InventoryItemAddtlRow>> {
  const ids = inventoryItemIds.filter((id) => Number.isFinite(id));
  const map = new Map<number, InventoryItemAddtlRow>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT inventory_item_id, fixed_shipping_amount
     FROM ccg_inventory_items_addtl
     WHERE inventory_item_id IN (${placeholders})`
  ).bind(...ids).all<InventoryItemAddtlRow>();
  for (const row of result.results ?? []) {
    map.set(row.inventory_item_id, row);
  }
  return map;
}
