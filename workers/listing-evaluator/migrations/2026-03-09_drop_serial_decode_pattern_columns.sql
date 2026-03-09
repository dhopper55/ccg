DROP INDEX IF EXISTS serial_decode_events_pattern_idx;
DROP INDEX IF EXISTS serial_decode_events_pattern_only_idx;
DROP INDEX IF EXISTS serial_decode_events_needs_context_idx;

ALTER TABLE serial_decode_events DROP COLUMN pattern;
ALTER TABLE serial_decode_events DROP COLUMN pattern_key;
ALTER TABLE serial_decode_events DROP COLUMN pattern_label;
ALTER TABLE serial_decode_events DROP COLUMN needs_context;
