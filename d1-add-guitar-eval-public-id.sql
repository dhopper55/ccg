-- Random public ID for guitar evaluations (security audit, 2026-11).
-- The public evaluation pages and /api/guitar-evaluation/* use this instead of the sequential
-- row id, so nobody can read or change another customer's evaluation by guessing numbers.
--   npx wrangler d1 execute listing_evaluator --remote --file=d1-add-guitar-eval-public-id.sql
ALTER TABLE guitar_evaluations ADD COLUMN public_id TEXT;

UPDATE guitar_evaluations
SET public_id = lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
)
WHERE public_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guitar_evaluations_public_id ON guitar_evaluations(public_id);
