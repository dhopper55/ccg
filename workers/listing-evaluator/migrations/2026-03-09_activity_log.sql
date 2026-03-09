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

INSERT OR IGNORE INTO activity_event_type (event_key, template_text, icon_key) VALUES
  ('decode_success', 'User decoded serial #{{serial}} in the {{brand}} decoder', 'check-circle'),
  ('decode_failure', 'User attempted to decode serial #{{serial}} in {{brand}} decoder', 'x-circle'),
  ('listing_eval_completed', 'Listing Eval completed for {{title}}', 'sale'),
  ('inventory_marked_sold', 'Inventory item {{title}} marked sold', 'inventory'),
  ('inventory_updated', 'Inventory item {{title}} updated', 'inventory'),
  ('inventory_added', 'Inventory item {{title}} added to system.', 'inventory'),
  ('failed_serial_evaluated', 'Failed {{brand}} Serial Number {{serial}} evaluated by an admin.', 'check-circle');
