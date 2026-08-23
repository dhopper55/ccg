CREATE TABLE dnc_budget_sync_lock (
  id INTEGER PRIMARY KEY,
  locked_at TEXT
);
INSERT INTO dnc_budget_sync_lock (id, locked_at) VALUES (1, NULL);
