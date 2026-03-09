ALTER TABLE serial_decode_events
  ADD COLUMN pattern_key TEXT;

ALTER TABLE serial_decode_events
  ADD COLUMN pattern_label TEXT;

ALTER TABLE serial_decode_events
  ADD COLUMN needs_context INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS serial_decode_events_pattern_idx
  ON serial_decode_events(normalized_brand, pattern_key, created_at);

CREATE INDEX IF NOT EXISTS serial_decode_events_needs_context_idx
  ON serial_decode_events(needs_context, success, created_at);

CREATE TABLE IF NOT EXISTS serial_pattern_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  normalized_brand TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  pattern_label TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  highlights_json TEXT NOT NULL DEFAULT '[]',
  caveats_json TEXT NOT NULL DEFAULT '[]',
  verification_json TEXT NOT NULL DEFAULT '[]',
  source_serial TEXT,
  ai_model TEXT,
  ai_response_json TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS serial_pattern_contexts_brand_pattern_idx
  ON serial_pattern_contexts(normalized_brand, pattern_key);

CREATE INDEX IF NOT EXISTS serial_pattern_contexts_published_idx
  ON serial_pattern_contexts(published, normalized_brand, pattern_key);
