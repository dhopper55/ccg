-- Adds inventory date/sale fields and backfills existing rows.
ALTER TABLE ccg_inventory_items ADD COLUMN purchased_date TEXT;
ALTER TABLE ccg_inventory_items ADD COLUMN for_sale INTEGER DEFAULT 0;
ALTER TABLE ccg_inventory_items ADD COLUMN for_sale_date TEXT;
ALTER TABLE ccg_inventory_items ADD COLUMN sold_date TEXT;

UPDATE ccg_inventory_items
SET purchased_date = '2026-02-01'
WHERE purchased_date IS NULL OR TRIM(purchased_date) = '';

UPDATE ccg_inventory_items
SET for_sale = 0
WHERE for_sale IS NULL;

CREATE INDEX IF NOT EXISTS ccg_inventory_items_for_sale_idx
  ON ccg_inventory_items(for_sale);
