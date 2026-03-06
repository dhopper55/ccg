ALTER TABLE ccg_inventory_items
  ADD COLUMN fbm_listing INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ccg_inventory_items
  ADD COLUMN fbm_title TEXT;

ALTER TABLE ccg_inventory_items
  ADD COLUMN fbm_url TEXT;

ALTER TABLE ccg_inventory_items
  ADD COLUMN fbm_image_url TEXT;

ALTER TABLE ccg_inventory_items
  ADD COLUMN fbm_listing_price REAL;

UPDATE ccg_inventory_items
SET fbm_listing = 0
WHERE fbm_listing IS NULL;

CREATE INDEX IF NOT EXISTS ccg_inventory_items_fbm_listing_idx
  ON ccg_inventory_items(fbm_listing);

DROP TABLE IF EXISTS ccg_marketplace_listings;
