-- Stores serial decoder tracking events (replaces Google Forms tracking).
CREATE TABLE IF NOT EXISTS serial_decode_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time_utc TEXT NOT NULL,
  brand TEXT NOT NULL,
  serial TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  evaluated INTEGER NOT NULL DEFAULT 0,
  used_ai INTEGER NOT NULL DEFAULT 0,
  is_listing_eval INTEGER NOT NULL DEFAULT 0,
  year TEXT,
  factory TEXT,
  country TEXT,
  error TEXT,
  page_path TEXT,
  user_agent TEXT,
  client_timestamp TEXT,
  ip_address TEXT,
  cf_country TEXT,
  cf_colo TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS serial_decode_events_created_idx
  ON serial_decode_events(created_at);

CREATE INDEX IF NOT EXISTS serial_decode_events_brand_idx
  ON serial_decode_events(brand);

CREATE INDEX IF NOT EXISTS serial_decode_events_success_idx
  ON serial_decode_events(success);

CREATE INDEX IF NOT EXISTS serial_decode_events_brand_serial_idx
  ON serial_decode_events(brand, serial);
