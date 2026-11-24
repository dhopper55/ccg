-- CCG Agent: the always-on local tool (home PC / MacBook) that pulls jobs from the Worker.
-- See ccg-agent/README.md. Run once:
--   cd workers/listing-evaluator && npx wrangler d1 execute listing_evaluator --remote --file=../../d1-add-ccg-agent.sql
-- Safe to re-run (IF NOT EXISTS everywhere).

-- One row per machine/instance. The key itself is shown once at creation; only its SHA-256 is
-- stored. At most one row has active = 1 (enforced by the partial unique index below), and only
-- the active instance may claim jobs. Inactive instances still heartbeat so Admin can see them.
CREATE TABLE IF NOT EXISTS agent_instances (
  id               TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  key_hash         TEXT NOT NULL UNIQUE,
  key_hint         TEXT NOT NULL,          -- last 4 chars of the key, for recognizing it
  active           INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,       -- unix epoch ms
  last_seen_at     INTEGER,
  hostname         TEXT,
  platform         TEXT,
  version          TEXT,
  managed          INTEGER NOT NULL DEFAULT 0,  -- 1 = started by the launcher (self-updates)
  status           TEXT,                   -- idle | working | error | fb_login_needed | ... (agent-reported)
  status_detail    TEXT,
  current_job_id   TEXT,
  modules_json     TEXT                    -- ["system","reverb",...] job modules this instance can run
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_instances_one_active
  ON agent_instances (active) WHERE active = 1;

--   status: 'queued'     waiting for the active instance
--           'claimed'    an instance is working on it (lease_expires_at keeps it alive)
--           'done'       finished OK (result_json)
--           'failed'     finished with an error, or ran out of attempts
--           'cancelled'  cancelled in Admin before it finished
CREATE TABLE IF NOT EXISTS agent_jobs (
  id                TEXT PRIMARY KEY,
  module            TEXT NOT NULL,          -- 'system', 'fbm', 'reverb', ...
  type              TEXT NOT NULL,          -- 'ping', 'add', 'update', ...
  payload_json      TEXT,
  status            TEXT NOT NULL,
  dedupe_key        TEXT,                   -- optional: at most one queued/claimed job per key
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 1,
  created_at        INTEGER NOT NULL,
  created_by        TEXT,
  claimed_by        TEXT,                   -- agent_instances.id
  claimed_at        INTEGER,
  lease_expires_at  INTEGER,
  finished_at       INTEGER,
  result_json       TEXT,
  error             TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_created ON agent_jobs (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_jobs_dedupe
  ON agent_jobs (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'claimed');

-- Log lines the agent ships to the Worker (it keeps no local log files). Pruned to 14 days.
CREATE TABLE IF NOT EXISTS agent_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id  TEXT NOT NULL,
  job_id       TEXT,
  ts           INTEGER NOT NULL,
  level        TEXT NOT NULL,
  message      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_logs_ts ON agent_logs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_job ON agent_logs (job_id, ts);

-- Agent-wide settings (key/value). Known keys:
--   desired_ref  git branch, tag or commit that launcher-managed instances run (default 'main')
CREATE TABLE IF NOT EXISTS agent_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
