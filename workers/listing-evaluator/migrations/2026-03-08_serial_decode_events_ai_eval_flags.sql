-- Adds serial decode flags for AI-assisted flow and listing-evaluator provenance.
ALTER TABLE serial_decode_events
ADD COLUMN used_ai INTEGER NOT NULL DEFAULT 0;

ALTER TABLE serial_decode_events
ADD COLUMN is_listing_eval INTEGER NOT NULL DEFAULT 0;
