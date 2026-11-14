-- Default storage location: new inventory items start on it, and every item must have a location.
-- Run after d1-add-storage-locations.sql, BEFORE deploying the worker that reads is_default:
--   wrangler d1 execute listing_evaluator --remote --file=../../d1-add-storage-location-default.sql
--
-- To change the default later (one row at most can be the default):
--   UPDATE ccg_storage_locations SET is_default = 0 WHERE is_default = 1;
--   UPDATE ccg_storage_locations SET is_default = 1 WHERE name = '<new default>';

ALTER TABLE ccg_storage_locations ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

UPDATE ccg_storage_locations SET is_default = 1 WHERE name = 'CCG Shop';

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_locations_one_default
  ON ccg_storage_locations (is_default) WHERE is_default = 1;

-- Items with no location get the default.
UPDATE ccg_inventory_items
  SET storage_location_id = (SELECT id FROM ccg_storage_locations WHERE is_default = 1)
  WHERE storage_location_id IS NULL;
