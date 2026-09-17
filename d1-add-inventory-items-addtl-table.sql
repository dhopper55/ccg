-- ccg_inventory_items is at D1's 100-column hard limit, so new per-item
-- settings go here instead of as columns on the main table. 1:1 with
-- ccg_inventory_items, keyed by inventory_item_id.
CREATE TABLE ccg_inventory_items_addtl (
  inventory_item_id INTEGER PRIMARY KEY REFERENCES ccg_inventory_items(id) ON DELETE CASCADE,
  fixed_shipping_amount REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
