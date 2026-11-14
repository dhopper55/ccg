-- Storage locations move from free text (ccg_inventory_items.storage_location) to a lookup table
-- (ccg_storage_locations) referenced by ccg_inventory_items.storage_location_id.
--
-- ccg_inventory_items is at SQLite's 100-column limit, so the new column can only be added after
-- the old one is dropped. Each item's location id is parked in a scratch table in between.
--
-- Run once, then deploy the worker right away (the old worker reads storage_location):
--   cd workers/listing-evaluator
--   npx wrangler d1 execute listing_evaluator --remote --file=../../d1-add-storage-locations.sql && npx wrangler deploy
--
-- Edit locations directly in the table for now: add rows, rename (items follow, they hold the id),
-- reorder with sort_order, or hide one from the dropdown with is_active = 0. A location still used
-- by an item cannot be deleted (foreign key).

CREATE TABLE IF NOT EXISTS ccg_storage_locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO ccg_storage_locations (id, name, sort_order) VALUES
  (1, 'CCG Shop', 10),
  (2, 'Extra Space 23225', 20),
  (3, 'Cellar', 30),
  (4, 'Garage', 40),
  (5, 'Repair Room', 50);

-- Any other text already on an item becomes a location too, so nothing is lost.
INSERT OR IGNORE INTO ccg_storage_locations (name, sort_order)
  SELECT DISTINCT TRIM(storage_location), 100 FROM ccg_inventory_items
  WHERE TRIM(COALESCE(storage_location, '')) <> '';

-- Park each item's location id.
DROP TABLE IF EXISTS tmp_inventory_storage_location;
CREATE TABLE tmp_inventory_storage_location AS
  SELECT i.id AS item_id, s.id AS location_id
  FROM ccg_inventory_items i
  JOIN ccg_storage_locations s ON s.name = TRIM(i.storage_location);

-- Swap the text column for the id column.
ALTER TABLE ccg_inventory_items DROP COLUMN storage_location;
ALTER TABLE ccg_inventory_items ADD COLUMN storage_location_id INTEGER REFERENCES ccg_storage_locations(id);

UPDATE ccg_inventory_items
  SET storage_location_id = (
    SELECT t.location_id FROM tmp_inventory_storage_location t WHERE t.item_id = ccg_inventory_items.id
  );

DROP TABLE tmp_inventory_storage_location;
