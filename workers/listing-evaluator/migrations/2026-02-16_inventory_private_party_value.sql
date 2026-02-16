-- Adds private party value support for inventory items.
ALTER TABLE ccg_inventory_items ADD COLUMN private_party_value REAL NOT NULL DEFAULT 0;

UPDATE ccg_inventory_items
SET private_party_value = 0
WHERE private_party_value IS NULL;
