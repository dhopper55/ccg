-- Allows multiple inventory rows to share the same CCG number for batch quantity support.
DROP INDEX IF EXISTS ccg_inventory_items_ccg_number_idx;

CREATE INDEX IF NOT EXISTS ccg_inventory_items_ccg_number_idx
  ON ccg_inventory_items(ccg_number);

CREATE INDEX IF NOT EXISTS ccg_inventory_items_filter_ccg_idx
  ON ccg_inventory_items(is_active, is_sold, category, ccg_number, id);

CREATE INDEX IF NOT EXISTS ccg_inventory_items_ccg_created_idx
  ON ccg_inventory_items(ccg_number, created_at, id);
