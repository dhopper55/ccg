CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source TEXT,
  url TEXT,
  status TEXT,
  run_id TEXT UNIQUE,
  title TEXT,
  price TEXT,
  location TEXT,
  condition TEXT,
  description TEXT,
  photos TEXT,
  ai_summary TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_listings_run_id ON listings(run_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
