-- Optional EasyPost shipment insurance, bought with the label.
--   insured_value_cents:  declared value insured (NULL = not insured)
--   insurance_cost_cents: what EasyPost charged for it (already included in label_cost_cents)
ALTER TABLE order_shipments ADD COLUMN insured_value_cents INTEGER;
ALTER TABLE order_shipments ADD COLUMN insurance_cost_cents INTEGER;
