-- "Meta Store" checkbox on inventory add/edit: only checked items go in the Meta
-- catalog feed (/feeds/meta.csv). Lives on the addtl table because
-- ccg_inventory_items is at D1's 100-column limit. Defaults to off, so the feed
-- starts empty. Apply before deploying the Worker that reads this column.
ALTER TABLE ccg_inventory_items_addtl ADD COLUMN meta_store INTEGER NOT NULL DEFAULT 0;
