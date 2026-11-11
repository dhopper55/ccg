-- CCG Eval queue: items the owner taps "Queue for Claude" on. Claude works through it
-- oldest-first when the owner says "eval" (get_next_queued_item -> evaluate -> save -> next).
-- Run once after d1-add-eval-connector.sql:
--   wrangler d1 execute listing_evaluator --remote --file=../../d1-add-eval-queue.sql
-- Safe to re-run (IF NOT EXISTS everywhere).
--
--   status: 'queued'       waiting for Claude
--           'in_progress'  claimed by Claude (back to 'queued' if not finished within 15 minutes)
--           'done'         evaluated and saved (evaluation_id points at the evaluations row)
--           'failed'       Claude skipped it (error says why)
--           'removed'      the owner took it off the queue
CREATE TABLE IF NOT EXISTS eval_queue (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('listing', 'inventory')),
  record_id      TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  options_json   TEXT,                 -- { "build_listing": true, "deep": false }
  status         TEXT NOT NULL,
  added_at       INTEGER NOT NULL,     -- unix epoch ms
  started_at     INTEGER,
  finished_at    INTEGER,
  evaluation_id  TEXT,
  error          TEXT
);
CREATE INDEX IF NOT EXISTS idx_eval_queue_status ON eval_queue (status, added_at);
CREATE INDEX IF NOT EXISTS idx_eval_queue_record ON eval_queue (kind, record_id, added_at DESC);
-- One waiting or running entry per item.
CREATE UNIQUE INDEX IF NOT EXISTS idx_eval_queue_active
  ON eval_queue (kind, record_id) WHERE status IN ('queued', 'in_progress');
