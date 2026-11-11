-- CCG Eval connector (Claude custom connector at mcp.coalcreekguitars.com).
-- Run once against the listing_evaluator D1 database:
--   wrangler d1 execute listing_evaluator --remote --file=d1-add-eval-connector.sql
-- Safe to re-run (IF NOT EXISTS everywhere).

-- What the owner has open in the admin right now: one row per user. Written by the listing
-- evaluator item page and the inventory item page; read by the connector's get_current_item.
-- A new, unsaved inventory item has no record_id: it is identified by draft_key, and
-- draft_json holds its title, uploaded photo keys and AI Analysis so far.
CREATE TABLE IF NOT EXISTS eval_focus (
  user_id     TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('listing', 'inventory')),
  record_id   TEXT,
  draft_key   TEXT,
  draft_json  TEXT,
  viewed_at   INTEGER NOT NULL            -- unix epoch ms
);

-- Every evaluation saved by the connector (and listing evaluations saved by paste).
-- Rows are only inserted or have status / applied_at / undone_at / record_id changed.
--   status: 'saved'     listing evaluation written to the listing
--           'pending'   inventory evaluation waiting for the item page to fill the form
--           'applied'   inventory evaluation filled into the form
--           'dismissed' inventory evaluation the owner chose not to apply
--           'undone'    listing evaluation reverted with Undo
CREATE TABLE IF NOT EXISTS evaluations (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL CHECK (kind IN ('listing', 'inventory')),
  record_id             TEXT,
  draft_key             TEXT,
  user_id               TEXT,
  analysis_md           TEXT NOT NULL DEFAULT '',
  analysis_html         TEXT NOT NULL DEFAULT '',
  fields_json           TEXT,
  listing_json          TEXT,
  options_json          TEXT,
  previous_values_json  TEXT,
  fields_written_json   TEXT,
  status                TEXT NOT NULL,
  content_hash          TEXT,
  source                TEXT NOT NULL,      -- 'claude-connector' | 'paste'
  created_at            INTEGER NOT NULL,
  applied_at            INTEGER,
  undone_at             INTEGER
);
CREATE INDEX IF NOT EXISTS idx_evaluations_record ON evaluations (kind, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_draft ON evaluations (draft_key, created_at DESC);

-- Audit log of connector tool calls and sign-in attempts. Also used for rate limiting.
CREATE TABLE IF NOT EXISTS eval_tool_log (
  id          TEXT PRIMARY KEY,
  tool        TEXT NOT NULL,
  kind        TEXT,
  record_id   TEXT,
  user_id     TEXT,
  token_id    TEXT,
  ok          INTEGER NOT NULL,
  error       TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eval_tool_log_token_time ON eval_tool_log (token_id, created_at);
CREATE INDEX IF NOT EXISTS idx_eval_tool_log_tool_time ON eval_tool_log (tool, created_at);

-- OAuth 2.1 for the connector (dynamic client registration, PKCE, refresh rotation).
-- Codes and tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id            TEXT PRIMARY KEY,
  client_secret_hash   TEXT,               -- NULL for public clients
  client_name          TEXT,
  redirect_uris_json   TEXT NOT NULL,
  created_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash       TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  redirect_uri    TEXT NOT NULL,
  code_challenge  TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  scope           TEXT,
  resource        TEXT,
  expires_at      INTEGER NOT NULL,
  used            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  token_hash  TEXT PRIMARY KEY,
  token_type  TEXT NOT NULL CHECK (token_type IN ('access', 'refresh')),
  client_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  scope       TEXT,
  family_id   TEXT NOT NULL,               -- access + refresh tokens from one sign-in
  expires_at  INTEGER NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_family ON mcp_oauth_tokens (family_id);
