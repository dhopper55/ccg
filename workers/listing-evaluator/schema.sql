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
  pricing_source TEXT,
  pricing_confidence TEXT,
  pricing_comp_count REAL,
  pricing_notes TEXT,
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

CREATE TABLE IF NOT EXISTS ccg_inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_listing_id INTEGER,
  ccg_number TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_urls TEXT,
  title TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  year_range TEXT,
  model TEXT,
  finish TEXT,
  original_listing_desc TEXT,
  purchased_date TEXT NOT NULL DEFAULT (DATE('now')),
  purchase_price REAL,
  private_party_value REAL NOT NULL DEFAULT 0,
  purchase_notes TEXT,
  serial_number TEXT,
  is_active INTEGER DEFAULT 1,
  is_marked INTEGER NOT NULL DEFAULT 0,
  is_personal INTEGER NOT NULL DEFAULT 0,
  for_sale INTEGER DEFAULT 0,
  for_sale_date TEXT,
  fbm_listing INTEGER NOT NULL DEFAULT 0,
  fbm_title TEXT,
  fbm_url TEXT,
  fbm_image_url TEXT,
  fbm_listing_price REAL,
  is_sold INTEGER DEFAULT 0,
  sold_date TEXT,
  sold_amount REAL,
  sell_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ccg_inventory_items_ccg_number_idx
  ON ccg_inventory_items(ccg_number);
CREATE UNIQUE INDEX IF NOT EXISTS ccg_inventory_items_source_listing_idx
  ON ccg_inventory_items(source_listing_id)
  WHERE source_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ccg_inventory_items_active_idx
  ON ccg_inventory_items(is_active);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_marked_idx
  ON ccg_inventory_items(is_marked);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_for_sale_idx
  ON ccg_inventory_items(for_sale);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_fbm_listing_idx
  ON ccg_inventory_items(fbm_listing);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_sold_idx
  ON ccg_inventory_items(is_sold);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_filter_ccg_idx
  ON ccg_inventory_items(is_active, is_sold, category, ccg_number, id);
CREATE INDEX IF NOT EXISTS ccg_inventory_items_ccg_created_idx
  ON ccg_inventory_items(ccg_number, created_at, id);

CREATE TABLE IF NOT EXISTS serial_decode_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time_utc TEXT NOT NULL,
  brand TEXT NOT NULL,
  serial TEXT NOT NULL,
  pattern_lookup_id INTEGER,
  pattern TEXT,
  pattern_key TEXT,
  pattern_label TEXT,
  normalized_brand TEXT,
  normalized_serial TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  evaluated INTEGER NOT NULL DEFAULT 0,
  needs_context INTEGER NOT NULL DEFAULT 0,
  used_ai INTEGER NOT NULL DEFAULT 0,
  is_listing_eval INTEGER NOT NULL DEFAULT 0,
  year TEXT,
  month TEXT,
  factory TEXT,
  country TEXT,
  model TEXT,
  notes TEXT,
  error TEXT,
  ai_cache_hit INTEGER NOT NULL DEFAULT 0,
  ai_model TEXT,
  ai_response_json TEXT,
  ai_attempted_at TEXT,
  page_path TEXT,
  user_agent TEXT,
  client_timestamp TEXT,
  ip_address TEXT,
  cf_country TEXT,
  cf_colo TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pattern_lookup_id) REFERENCES serial_decode_pattern_lookup(id)
);

CREATE INDEX IF NOT EXISTS serial_decode_events_created_idx
  ON serial_decode_events(created_at);
CREATE INDEX IF NOT EXISTS serial_decode_events_brand_idx
  ON serial_decode_events(brand);
CREATE INDEX IF NOT EXISTS serial_decode_events_success_idx
  ON serial_decode_events(success);
CREATE INDEX IF NOT EXISTS serial_decode_events_brand_serial_idx
  ON serial_decode_events(brand, serial);
CREATE INDEX IF NOT EXISTS serial_decode_events_pattern_only_idx
  ON serial_decode_events(pattern, created_at);
CREATE INDEX IF NOT EXISTS serial_decode_events_norm_ai_cache_idx
  ON serial_decode_events(normalized_brand, normalized_serial, used_ai, is_listing_eval, created_at);
CREATE INDEX IF NOT EXISTS serial_decode_events_pattern_idx
  ON serial_decode_events(normalized_brand, pattern_key, created_at);
CREATE INDEX IF NOT EXISTS serial_decode_events_needs_context_idx
  ON serial_decode_events(needs_context, success, created_at);
CREATE INDEX IF NOT EXISTS serial_decode_events_pattern_lookup_id_idx
  ON serial_decode_events(pattern_lookup_id);

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

CREATE TABLE IF NOT EXISTS serial_decode_pattern_lookup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  pattern TEXT NOT NULL,
  rich_text TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand, pattern)
);
CREATE INDEX IF NOT EXISTS serial_decode_pattern_lookup_brand_pattern_idx
  ON serial_decode_pattern_lookup(brand, pattern);

CREATE TABLE IF NOT EXISTS activity_event_type (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT NOT NULL UNIQUE,
  template_text TEXT NOT NULL,
  icon_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time_utc TEXT NOT NULL,
  event_type_id INTEGER NOT NULL,
  event_url TEXT,
  event_text TEXT NOT NULL,
  image_url TEXT,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_type_id) REFERENCES activity_event_type(id)
);

CREATE INDEX IF NOT EXISTS activity_log_event_time_idx
  ON activity_log(event_time_utc DESC);
CREATE INDEX IF NOT EXISTS activity_log_event_type_idx
  ON activity_log(event_type_id);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx
  ON activity_log(entity_type, entity_id);
