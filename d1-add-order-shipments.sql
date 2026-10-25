-- Shipping phase 1 (quote + manual tracking). Replaces the earlier draft of this file.
--
-- EasyPost API keys are Worker secrets (EASYPOST_API_KEY_TEST / EASYPOST_API_KEY_PROD),
-- never stored here. sys_info only holds the test/prod toggle and the ship-from address.

ALTER TABLE sys_info ADD COLUMN use_easypost_test INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sys_info ADD COLUMN ship_from_name TEXT;
ALTER TABLE sys_info ADD COLUMN ship_from_company TEXT;
ALTER TABLE sys_info ADD COLUMN ship_from_street1 TEXT;
ALTER TABLE sys_info ADD COLUMN ship_from_street2 TEXT;
ALTER TABLE sys_info ADD COLUMN ship_from_city TEXT;
ALTER TABLE sys_info ADD COLUMN ship_from_state TEXT;
ALTER TABLE sys_info ADD COLUMN ship_from_zip TEXT;
ALTER TABLE sys_info ADD COLUMN ship_from_phone TEXT;

UPDATE sys_info SET
  ship_from_name = 'Coal Creek Guitars',
  ship_from_company = 'Coal Creek Guitars',
  ship_from_street1 = '4109 S Sherman St',
  ship_from_street2 = 'Suite B',
  ship_from_city = 'Englewood',
  ship_from_state = 'CO',
  ship_from_zip = '80113',
  ship_from_phone = '3033769214'
WHERE id = 1;

-- One row per shipment attempt on an order.
--   quoted    = EasyPost shipment created, rates returned (nothing bought)
--   purchased = label bought through EasyPost (next phase)
--   manual    = tracking entered by hand for a label bought elsewhere
-- An order counts as shipped when it has a purchased/manual shipment with a tracking code.
CREATE TABLE order_shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,                        -- 'quoted' | 'purchased' | 'manual' | 'voided'
  is_test INTEGER NOT NULL DEFAULT 0,          -- created with the EasyPost test key

  -- Package
  template_id INTEGER REFERENCES shipping_package_templates(id) ON DELETE SET NULL,
  length_in REAL,
  width_in REAL,
  height_in REAL,
  weight_oz REAL,
  signature_confirmation INTEGER NOT NULL DEFAULT 0,
  ship_date TEXT,                              -- YYYY-MM-DD the label is for

  -- EasyPost
  easypost_shipment_id TEXT,
  to_address_verified INTEGER,                 -- 1 / 0 / NULL (not checked)
  to_address_residential INTEGER,
  verification_message TEXT,
  rates_json TEXT,                             -- rates returned at quote time

  -- Label / tracking
  carrier TEXT,                                -- 'USPS' | 'UPS' | 'FedEx' | other
  service TEXT,
  tracking_code TEXT,
  label_cost_cents INTEGER,                    -- comes off the order's net payout
  label_url TEXT,
  notes TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  shipped_at TEXT
);
CREATE INDEX idx_order_shipments_order ON order_shipments(order_id);
CREATE INDEX idx_order_shipments_tracking ON order_shipments(tracking_code);

-- Saved package presets, e.g. "Guitar box 45x18x6, 15 lb".
CREATE TABLE shipping_package_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  length_in REAL NOT NULL,
  width_in REAL NOT NULL,
  height_in REAL NOT NULL,
  weight_oz REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
