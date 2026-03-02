ALTER TABLE ccg_inventory_items
  ADD COLUMN is_personal INTEGER NOT NULL DEFAULT 0;

UPDATE ccg_inventory_items
SET is_personal = 0
WHERE is_personal IS NULL;
