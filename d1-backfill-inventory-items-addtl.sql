-- Idempotent: only inserts rows for items that don't already have one.
INSERT INTO ccg_inventory_items_addtl (inventory_item_id, fixed_shipping_amount)
SELECT id, 0 FROM ccg_inventory_items
WHERE id NOT IN (SELECT inventory_item_id FROM ccg_inventory_items_addtl);
