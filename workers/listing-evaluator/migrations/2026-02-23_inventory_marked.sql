ALTER TABLE ccg_inventory_items ADD COLUMN is_marked INTEGER NOT NULL DEFAULT 0;

UPDATE ccg_inventory_items
SET is_marked = 0
WHERE is_marked IS NULL;

CREATE INDEX IF NOT EXISTS ccg_inventory_items_marked_idx
  ON ccg_inventory_items(is_marked);
