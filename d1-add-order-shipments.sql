-- PROPOSAL (not yet applied): EasyPost shipping labels from CCG admin.
--
-- A shipment hangs off an order when one exists (CCG site / POS / terminal sales).
-- Reverb / FBM / other-channel sales never create an orders row, so those shipments
-- hang off the inventory item instead. At least one of the two must be set.
-- Money is in cents to match orders / order_items.

-- One row per label attempt. Voided labels stay as history; a re-ship is a new row.
CREATE TABLE order_shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  inventory_item_id INTEGER REFERENCES ccg_inventory_items(id) ON DELETE SET NULL,
  sales_channel TEXT NOT NULL,                 -- 'ccg' | 'reverb' | 'fbm' | 'ebay' | 'other'
  channel_order_ref TEXT,                      -- e.g. Reverb order number, used to mark shipped
  status TEXT NOT NULL DEFAULT 'draft',        -- draft | rated | purchased | in_transit | delivered | voided | refund_pending | error
  is_test INTEGER NOT NULL DEFAULT 0,          -- 1 = created with the EasyPost test key

  -- Destination
  to_name TEXT NOT NULL,
  to_company TEXT,
  to_street1 TEXT NOT NULL,
  to_street2 TEXT,
  to_city TEXT NOT NULL,
  to_state TEXT NOT NULL,
  to_zip TEXT NOT NULL,
  to_country TEXT NOT NULL DEFAULT 'US',
  to_phone TEXT,
  to_email TEXT,
  to_residential INTEGER,                      -- set by EasyPost address verification
  to_verified INTEGER NOT NULL DEFAULT 0,
  easypost_to_address_id TEXT,

  -- Origin (snapshot of ship_from_addresses at quote time)
  from_address_id INTEGER REFERENCES ship_from_addresses(id),

  -- Parcel
  package_preset_id INTEGER REFERENCES shipping_package_presets(id) ON DELETE SET NULL,
  length_in REAL,
  width_in REAL,
  height_in REAL,
  weight_oz REAL NOT NULL,

  -- Options
  signature_confirmation TEXT,                 -- NULL | 'SIGNATURE' | 'ADULT_SIGNATURE'
  insured_value_cents INTEGER,                 -- NULL = carrier default coverage only

  -- EasyPost shipment + chosen rate
  easypost_shipment_id TEXT,
  easypost_rate_id TEXT,
  carrier TEXT,                                -- 'USPS' | 'UPS' | 'FedEx'
  service TEXT,                                -- 'GroundAdvantage' | 'Ground' | ...
  rate_cents INTEGER,                          -- label cost
  insurance_cents INTEGER,
  delivery_days INTEGER,

  -- Label + tracking
  tracking_code TEXT,
  tracking_url TEXT,
  label_url TEXT,                              -- EasyPost-hosted label file
  label_format TEXT,                           -- 'PDF' | 'PNG' | 'ZPL'
  label_size TEXT,                             -- '4x6' | '8.5x11'
  easypost_tracker_id TEXT,
  tracking_status TEXT,                        -- latest EasyPost tracker status
  estimated_delivery_at TIMESTAMP,
  delivered_at TIMESTAMP,

  -- Post-purchase
  channel_marked_shipped_at TIMESTAMP,         -- when tracking was pushed to Reverb / CCG order
  refund_status TEXT,                          -- NULL | 'submitted' | 'refunded' | 'rejected'
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  purchased_at TIMESTAMP,

  CHECK (order_id IS NOT NULL OR inventory_item_id IS NOT NULL)
);
CREATE INDEX idx_order_shipments_order ON order_shipments(order_id);
CREATE INDEX idx_order_shipments_item ON order_shipments(inventory_item_id);
CREATE INDEX idx_order_shipments_tracking ON order_shipments(tracking_code);
CREATE INDEX idx_order_shipments_ep_shipment ON order_shipments(easypost_shipment_id);

-- Tracking webhook history + our own actions (rated, purchased, voided, marked shipped).
CREATE TABLE order_shipment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                    -- 'rated' | 'purchased' | 'tracker.updated' | 'voided' | 'channel_marked_shipped' | 'error'
  status TEXT,
  message TEXT,
  source TEXT NOT NULL,                        -- 'admin_v2' | 'easypost_webhook'
  payload_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_order_shipment_events_shipment ON order_shipment_events(shipment_id);

-- Box presets so a quote is usually "pick a preset". category_id lets a category
-- (e.g. Electric Guitars) default to its usual box.
CREATE TABLE shipping_package_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                          -- 'Electric guitar box'
  length_in REAL NOT NULL,
  width_in REAL NOT NULL,
  height_in REAL NOT NULL,
  weight_oz REAL NOT NULL,                     -- typical packed weight; editable per shipment
  category_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ship-from address(es). Normally one row with is_default = 1.
CREATE TABLE ship_from_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  street1 TEXT NOT NULL,
  street2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT NOT NULL,
  email TEXT,
  easypost_address_id TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
