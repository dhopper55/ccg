-- Default Reverb category for every item in a CCG (sub)category, saved when listing on Reverb
-- and reused to prefill the next one — the Reverb counterpart of gx_category_id.
ALTER TABLE ccg_inventory_categories ADD COLUMN reverb_category_uuid TEXT;
