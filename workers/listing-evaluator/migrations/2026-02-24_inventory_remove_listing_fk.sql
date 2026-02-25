PRAGMA defer_foreign_keys = TRUE;

CREATE TABLE ccg_inventory_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_listing_id INTEGER,
  ccg_number TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_urls TEXT,
  title TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  year_range TEXT,
  model TEXT,
  finish TEXT,
  original_listing_desc TEXT,
  purchased_date TEXT NOT NULL DEFAULT (DATE('now')),
  purchase_price REAL,
  private_party_value REAL NOT NULL DEFAULT 0,
  purchase_notes TEXT,
  serial_number TEXT,
  is_active INTEGER DEFAULT 1,
  is_marked INTEGER NOT NULL DEFAULT 0,
  for_sale INTEGER DEFAULT 0,
  for_sale_date TEXT,
  is_sold INTEGER DEFAULT 0,
  sold_date TEXT,
  sold_amount REAL,
  sell_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ccg_inventory_items_new (
  id,
  source_listing_id,
  ccg_number,
  image_url,
  image_urls,
  title,
  category,
  brand,
  year_range,
  model,
  finish,
  original_listing_desc,
  purchased_date,
  purchase_price,
  private_party_value,
  purchase_notes,
  serial_number,
  is_active,
  is_marked,
  for_sale,
  for_sale_date,
  is_sold,
  sold_date,
  sold_amount,
  sell_notes,
  created_at,
  updated_at
)
SELECT
  id,
  source_listing_id,
  ccg_number,
  image_url,
  image_urls,
  title,
  category,
  brand,
  year_range,
  model,
  finish,
  original_listing_desc,
  purchased_date,
  purchase_price,
  private_party_value,
  purchase_notes,
  serial_number,
  is_active,
  is_marked,
  for_sale,
  for_sale_date,
  is_sold,
  sold_date,
  sold_amount,
  sell_notes,
  created_at,
  updated_at
FROM ccg_inventory_items;

DROP TABLE ccg_inventory_items;
ALTER TABLE ccg_inventory_items_new RENAME TO ccg_inventory_items;

CREATE INDEX IF NOT EXISTS ccg_inventory_items_ccg_number_idx
  ON ccg_inventory_items(ccg_number);
CREATE UNIQUE INDEX IF NOT EXISTS ccg_inventory_items_source_listing_idx
  ON ccg_inventory_items(source_listing_id)
  WHERE source_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ccg_inventory_items_active_idx
  ON ccg_inventory_items(is_active);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_marked_idx
  ON ccg_inventory_items(is_marked);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_for_sale_idx
  ON ccg_inventory_items(for_sale);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_sold_idx
  ON ccg_inventory_items(is_sold);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_filter_ccg_idx
  ON ccg_inventory_items(is_active, is_sold, category, ccg_number, id);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_ccg_created_idx
  ON ccg_inventory_items(ccg_number, created_at, id);
