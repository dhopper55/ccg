ALTER TABLE serial_decode_events
  ADD COLUMN pattern TEXT;

CREATE INDEX IF NOT EXISTS serial_decode_events_pattern_only_idx
  ON serial_decode_events(pattern, created_at);

CREATE TABLE IF NOT EXISTS serial_decode_pattern_lookup (
  pattern TEXT PRIMARY KEY,
  rich_text TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
