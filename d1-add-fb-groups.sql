-- Which Facebook "List in more places" groups an item was posted to, chosen per item in
-- ccg-fbm-sync/add_all.py: 1 = music groups, 2 = general groups, 3 = all (music + general),
-- 4 = no groups (default). Group lists: MUSIC_GROUPS / GENERAL_GROUPS in ccg-fbm-sync/fbm_client.py.
-- On the addtl table: ccg_inventory_items is at D1's 100-column limit. Items with no addtl row
-- read as 4. Apply before deploying the Worker that reads this column:
--   cd workers/listing-evaluator && npx wrangler d1 execute listing_evaluator --remote --command="<the ALTER below>"
ALTER TABLE ccg_inventory_items_addtl ADD COLUMN fb_groups INTEGER NOT NULL DEFAULT 4;
