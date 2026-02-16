-- Adds multi-image support for inventory items.
ALTER TABLE ccg_inventory_items ADD COLUMN image_urls TEXT;

UPDATE ccg_inventory_items
SET image_urls = image_url
WHERE (image_urls IS NULL OR TRIM(image_urls) = '')
  AND image_url IS NOT NULL
  AND TRIM(image_url) <> '';
