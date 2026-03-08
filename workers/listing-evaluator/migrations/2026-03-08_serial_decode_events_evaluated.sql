-- Adds decoder-evaluation flag for future workflows.
ALTER TABLE serial_decode_events
ADD COLUMN evaluated INTEGER NOT NULL DEFAULT 0;
