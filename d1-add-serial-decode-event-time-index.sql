-- Admin serial-decode charts filter by event_time_utc (lookup volume window, daily volume).
CREATE INDEX IF NOT EXISTS serial_decode_events_event_time_idx
  ON serial_decode_events(event_time_utc);
