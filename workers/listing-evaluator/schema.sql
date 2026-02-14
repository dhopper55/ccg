-- Listing Evaluator D1 schema

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT,
  source TEXT,
  url TEXT NOT NULL,
  status TEXT,
  title TEXT,
  price_asking REAL,
  location TEXT,
  description TEXT,
  photos TEXT,
  ai_summary TEXT,
  ai_summary2 TEXT,
  ai_summary3 TEXT,
  ai_summary4 TEXT,
  ai_summary5 TEXT,
  ai_summary6 TEXT,
  ai_summary7 TEXT,
  ai_summary8 TEXT,
  ai_summary9 TEXT,
  ai_summary10 TEXT,
  price_private_party TEXT,
  price_ideal REAL,
  score REAL,
  archived INTEGER DEFAULT 0,
  saved INTEGER DEFAULT 0,
  is_multi INTEGER DEFAULT 0,
  category TEXT,
  brand TEXT,
  model TEXT,
  finish TEXT,
  year TEXT,
  condition TEXT,
  serial TEXT,
  serial_brand TEXT,
  serial_year TEXT,
  serial_model TEXT,
  value_private_party_low REAL,
  value_private_party_low_notes TEXT,
  value_private_party_medium REAL,
  value_private_party_medium_notes TEXT,
  value_private_party_high REAL,
  value_private_party_high_notes TEXT,
  value_pawn_shop_notes TEXT,
  value_online_notes TEXT,
  known_weak_points TEXT,
  typical_repair_needs TEXT,
  buyers_worry TEXT,
  og_specs_pickups TEXT,
  og_specs_tuners TEXT,
  og_specs_common_mods TEXT,
  buyer_what_to_check TEXT,
  buyer_common_misrepresent TEXT,
  seller_how_to_price_realistic TEXT,
  seller_fixes_add_value_or_waste TEXT,
  seller_as_is_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS listings_url_idx ON listings(url);
CREATE INDEX IF NOT EXISTS listings_submitted_idx ON listings(submitted_at);
CREATE INDEX IF NOT EXISTS listings_archived_idx ON listings(archived);
CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status);

CREATE TABLE IF NOT EXISTS search_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  run_started_at TEXT,
  source TEXT,
  keyword TEXT,
  url TEXT,
  title TEXT,
  price REAL,
  image_url TEXT,
  is_guitar TEXT,
  is_sponsored INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  ai_reason TEXT,
  seen_at TEXT,
  ai_checked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS search_results_url_idx ON search_results(url);
CREATE INDEX IF NOT EXISTS search_results_run_idx ON search_results(run_id);
CREATE INDEX IF NOT EXISTS search_results_archived_idx ON search_results(archived);

CREATE TABLE IF NOT EXISTS ccg_marketplace_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'facebook',
  title TEXT NOT NULL,
  price_dollars INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  image_url TEXT,
  listing_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ccg_marketplace_listings_url_idx
  ON ccg_marketplace_listings(listing_url);
CREATE INDEX IF NOT EXISTS ccg_marketplace_listings_status_idx
  ON ccg_marketplace_listings(status);
CREATE INDEX IF NOT EXISTS ccg_marketplace_listings_price_idx
  ON ccg_marketplace_listings(price_dollars);
