PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS serial_decode_pattern_lookup_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  pattern TEXT NOT NULL,
  rich_text TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand, pattern)
);

INSERT OR IGNORE INTO serial_decode_pattern_lookup_new (brand, pattern, rich_text, created_at, updated_at)
SELECT
  trim(COALESCE(brand, '')),
  trim(COALESCE(pattern, '')),
  COALESCE(rich_text, ''),
  COALESCE(created_at, CURRENT_TIMESTAMP),
  COALESCE(updated_at, COALESCE(created_at, CURRENT_TIMESTAMP))
FROM serial_decode_pattern_lookup
WHERE trim(COALESCE(brand, '')) <> ''
  AND trim(COALESCE(pattern, '')) <> '';

DROP TABLE serial_decode_pattern_lookup;
ALTER TABLE serial_decode_pattern_lookup_new RENAME TO serial_decode_pattern_lookup;

CREATE INDEX IF NOT EXISTS serial_decode_pattern_lookup_brand_pattern_idx
  ON serial_decode_pattern_lookup(brand, pattern);

ALTER TABLE serial_decode_events
  ADD COLUMN pattern_lookup_id INTEGER REFERENCES serial_decode_pattern_lookup(id);

CREATE INDEX IF NOT EXISTS serial_decode_events_pattern_lookup_id_idx
  ON serial_decode_events(pattern_lookup_id);

PRAGMA foreign_keys = ON;
