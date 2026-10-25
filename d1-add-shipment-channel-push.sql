-- Result of telling the sales channel (Reverb) that a shipment went out.
--   channel_push_status: NULL (not applicable) | 'pushed' | 'failed'
ALTER TABLE order_shipments ADD COLUMN channel_push_status TEXT;
ALTER TABLE order_shipments ADD COLUMN channel_push_message TEXT;
ALTER TABLE order_shipments ADD COLUMN channel_pushed_at TEXT;
