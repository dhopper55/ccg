ALTER TABLE ccg_inventory_items ADD COLUMN miles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ccg_inventory_items ADD COLUMN minutes_spent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ccg_inventory_items ADD COLUMN ship_cost REAL NOT NULL DEFAULT 0;
