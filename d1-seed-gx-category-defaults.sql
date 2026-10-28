-- One-time: Gear Exchange category defaults on CCG subcategories (listing forms prefill from the
-- item's subcategory first, then its category). GX ids from GET /categories (2026-10-27).
-- The broad top-level defaults set by earlier listings are cleared: "Guitar" had picked up
-- Acoustic > 6-string, which every electric would have inherited.
UPDATE ccg_inventory_categories SET gx_category_id = NULL WHERE id IN (15, 16); -- Guitar, Bass

UPDATE ccg_inventory_categories SET gx_category_id = 109 WHERE id = 9;   -- Electric Guitars -> Solidbody
UPDATE ccg_inventory_categories SET gx_category_id = 107 WHERE id = 5;   -- Acoustic Guitars -> 6-string
UPDATE ccg_inventory_categories SET gx_category_id = 107 WHERE id = 81;  -- Classical -> 6-string (no classical on GX)
UPDATE ccg_inventory_categories SET gx_category_id = 26  WHERE id = 110; -- Lap -> Other Guitar
UPDATE ccg_inventory_categories SET gx_category_id = 146 WHERE id = 93;  -- Banjo
UPDATE ccg_inventory_categories SET gx_category_id = 147 WHERE id = 83;  -- Mandolin
UPDATE ccg_inventory_categories SET gx_category_id = 123 WHERE id = 8;   -- Electric Basses -> 4-string
UPDATE ccg_inventory_categories SET gx_category_id = 126 WHERE id = 52;  -- Acoustic Basses
UPDATE ccg_inventory_categories SET gx_category_id = 20  WHERE id = 94;  -- Ukulele

UPDATE ccg_inventory_categories SET gx_category_id = 132 WHERE id IN (25, 24, 31); -- Overdrive/Distortion, Fuzz, Boost
UPDATE ccg_inventory_categories SET gx_category_id = 131 WHERE id IN (40, 67);     -- Compressor/Sustainer, EQ
UPDATE ccg_inventory_categories SET gx_category_id = 141 WHERE id IN (23, 28);     -- Reverb, Delay
UPDATE ccg_inventory_categories SET gx_category_id = 130 WHERE id = 27;            -- Chorus
UPDATE ccg_inventory_categories SET gx_category_id = 133 WHERE id = 69;            -- Flanger
UPDATE ccg_inventory_categories SET gx_category_id = 139 WHERE id = 30;            -- Phase -> Phaser
UPDATE ccg_inventory_categories SET gx_category_id = 142 WHERE id IN (68, 91);     -- Tremolo, Vibrato
UPDATE ccg_inventory_categories SET gx_category_id = 143 WHERE id = 29;            -- Wah -> Wah and Filter
UPDATE ccg_inventory_categories SET gx_category_id = 135 WHERE id = 97;            -- Volume -> Volume and Expression
UPDATE ccg_inventory_categories SET gx_category_id = 256 WHERE id = 47;            -- Noise Gate
UPDATE ccg_inventory_categories SET gx_category_id = 134 WHERE id = 48;            -- Switcher -> Footswitch and Selector
UPDATE ccg_inventory_categories SET gx_category_id = 144 WHERE id = 49;            -- Power -> Pedalboards and Power Supplies
UPDATE ccg_inventory_categories SET gx_category_id = 137 WHERE id = 33;            -- Multi -> Multi-Effects
UPDATE ccg_inventory_categories SET gx_category_id = 129 WHERE id = 96;            -- Acoustic -> Acoustic Guitar Effects
UPDATE ccg_inventory_categories SET gx_category_id = 253 WHERE id = 32;            -- Octave -> Harmony Pedals & Processors
UPDATE ccg_inventory_categories SET gx_category_id = 118 WHERE id = 26;            -- Tuner -> Guitar Tuners
UPDATE ccg_inventory_categories SET gx_category_id = 140 WHERE id = 41;            -- Other -> Other Effects
