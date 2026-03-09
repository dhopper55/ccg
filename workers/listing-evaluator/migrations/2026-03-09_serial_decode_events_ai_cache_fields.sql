-- Adds normalized keys, richer decode payload fields, and AI fallback cache metadata.
ALTER TABLE serial_decode_events
ADD COLUMN normalized_brand TEXT;

ALTER TABLE serial_decode_events
ADD COLUMN normalized_serial TEXT;

ALTER TABLE serial_decode_events
ADD COLUMN month TEXT;

ALTER TABLE serial_decode_events
ADD COLUMN model TEXT;

ALTER TABLE serial_decode_events
ADD COLUMN notes TEXT;

ALTER TABLE serial_decode_events
ADD COLUMN ai_cache_hit INTEGER NOT NULL DEFAULT 0;

ALTER TABLE serial_decode_events
ADD COLUMN ai_model TEXT;

ALTER TABLE serial_decode_events
ADD COLUMN ai_response_json TEXT;

ALTER TABLE serial_decode_events
ADD COLUMN ai_attempted_at TEXT;

CREATE INDEX IF NOT EXISTS serial_decode_events_norm_ai_cache_idx
  ON serial_decode_events(normalized_brand, normalized_serial, used_ai, is_listing_eval, created_at);
