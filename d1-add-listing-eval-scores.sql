-- Listing evaluator scores: three traffic-light scores per listing, set by Claude through the
-- CCG Eval connector (save_listing_evaluation).
--   0 = None (not scored yet; grey dot)   1 = Green   2 = Yellow   3 = Red
-- New listings default to 0 (None). Every listing that exists when this runs is set to Yellow.
-- Run once (ADD COLUMN is not re-runnable):
--   wrangler d1 execute listing_evaluator --remote --file=../../d1-add-listing-eval-scores.sql
ALTER TABLE listings ADD COLUMN price_score INTEGER NOT NULL DEFAULT 0 CHECK (price_score BETWEEN 0 AND 3);
ALTER TABLE listings ADD COLUMN location_score INTEGER NOT NULL DEFAULT 0 CHECK (location_score BETWEEN 0 AND 3);
ALTER TABLE listings ADD COLUMN desire_score INTEGER NOT NULL DEFAULT 0 CHECK (desire_score BETWEEN 0 AND 3);

UPDATE listings SET price_score = 2, location_score = 2, desire_score = 2;
