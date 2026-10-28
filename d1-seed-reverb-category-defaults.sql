-- One-time: Reverb category defaults on CCG subcategories (the Reverb listing form prefills from
-- these; uuids from Reverb's public GET /api/categories/flat, 2026-10-28). "Other" pedals are
-- left without a default — they vary too much to guess.
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'e57deb7a-382b-4e18-a008-67d4fbcb2879' WHERE id = 9;   -- Electric Guitars -> Electric Guitars / Solid Body
UPDATE ccg_inventory_categories SET reverb_category_uuid = '3ca3eb03-7eac-477d-b253-15ce603d2550' WHERE id = 5;   -- Acoustic Guitars -> Acoustic Guitars
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'a7f470d1-266d-4495-b4d6-998cc84b7474' WHERE id = 81;  -- Classical -> Acoustic Guitars / Classical
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'ddd7553e-68d5-4005-a356-3f94202682a8' WHERE id = 110; -- Lap -> Electric Guitars / Lap Steel
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'ac571749-28c7-4eec-a1d9-09dca3cf3e5f' WHERE id = 8;   -- Electric Basses -> Bass Guitars / 4-String
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'bd0f2bd8-714b-4d19-ad87-05c5695a3b02' WHERE id = 52;  -- Acoustic Basses -> Bass Guitars / Acoustic Bass Guitars

UPDATE ccg_inventory_categories SET reverb_category_uuid = '732e30f0-21cf-4960-a3d4-bb90c68081db' WHERE id = 25;  -- Overdrive/Distortion -> Distortion
UPDATE ccg_inventory_categories SET reverb_category_uuid = '305e09a1-f9cb-4171-8a70-6428ad1b55a8' WHERE id = 24;  -- Fuzz
UPDATE ccg_inventory_categories SET reverb_category_uuid = '9bee8b39-c5f1-4fa7-90af-38740fc21a73' WHERE id = 31;  -- Boost -> Overdrive and Boost
UPDATE ccg_inventory_categories SET reverb_category_uuid = '86d377ed-c038-4353-a391-f592ebd6d921' WHERE id = 40;  -- Compressor/Sustainer -> Compression and Sustain
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'ec612b9c-6227-4249-9010-b85b6b0eb5b0' WHERE id = 67;  -- EQ
UPDATE ccg_inventory_categories SET reverb_category_uuid = '1738a9ae-6485-46c2-8ead-0807bb2e20e9' WHERE id = 23;  -- Reverb
UPDATE ccg_inventory_categories SET reverb_category_uuid = '3b09f948-3462-4ac2-93b3-59dd66da787e' WHERE id = 28;  -- Delay
UPDATE ccg_inventory_categories SET reverb_category_uuid = '15800d29-53a1-446e-8560-7a74a6d8d962' WHERE id IN (27, 91); -- Chorus, Vibrato -> Chorus and Vibrato
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'b753bcd4-2cc5-4ea1-8f01-c8b034012372' WHERE id = 69;  -- Flanger
UPDATE ccg_inventory_categories SET reverb_category_uuid = '75e55b59-f57b-4e39-87b1-fcda4c1ed562' WHERE id = 30;  -- Phase -> Phase Shifters
UPDATE ccg_inventory_categories SET reverb_category_uuid = '38f7f86b-5d7a-499a-9bdc-c3198395dfa6' WHERE id = 68;  -- Tremolo
UPDATE ccg_inventory_categories SET reverb_category_uuid = 'a92165b2-2281-4dc2-850f-2789f513ec10' WHERE id = 29;  -- Wah -> Wahs and Filters
UPDATE ccg_inventory_categories SET reverb_category_uuid = '6bd92034-d59c-4d78-a6c1-1e8a3c31b31e' WHERE id IN (97, 48); -- Volume, Switcher -> Controllers, Volume and Expression
UPDATE ccg_inventory_categories SET reverb_category_uuid = '8745626e-3273-4f9d-b7a1-ca5b202a8e6e' WHERE id = 47;  -- Noise Gate -> Noise Reduction and Gates
UPDATE ccg_inventory_categories SET reverb_category_uuid = '66fd5c3b-3227-4182-9337-d0e4893be9a2' WHERE id = 49;  -- Power -> Pedalboards and Power Supplies
UPDATE ccg_inventory_categories SET reverb_category_uuid = '2d6093b4-6b33-474e-b07c-25f6657d7956' WHERE id = 33;  -- Multi -> Multi-Effect Unit
UPDATE ccg_inventory_categories SET reverb_category_uuid = '4d45f512-4dd5-4dae-95b7-7eb400ce406b' WHERE id = 96;  -- Acoustic -> Preamps
UPDATE ccg_inventory_categories SET reverb_category_uuid = '8dab3e10-a7f8-444b-aa9d-ccdab4fe66c6' WHERE id = 32;  -- Octave -> Octave and Pitch
UPDATE ccg_inventory_categories SET reverb_category_uuid = '69a7e38f-0ce8-42ea-a0f6-8a30b7f6886e' WHERE id = 26;  -- Tuner -> Tuning Pedals
