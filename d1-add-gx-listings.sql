-- Sweetwater Gear Exchange (GX) channel.
--
-- One row per CCG inventory item that's listed on GX (1:1, like ccg_inventory_items_addtl —
-- ccg_inventory_items is at D1's 100-column limit). The row is deleted when the item comes off
-- GX; sales_channel_gear_exchange on the item mirrors whether a row exists.
CREATE TABLE ccg_inventory_gx_listings (
  inventory_item_id INTEGER PRIMARY KEY REFERENCES ccg_inventory_items(id) ON DELETE CASCADE,
  gx_listing_id INTEGER NOT NULL UNIQUE,
  gx_status TEXT,                 -- last known GX status: draft | pending_admin_review | published | sold
  gx_category_id INTEGER,
  gx_condition_id INTEGER,
  payout_method TEXT,             -- 'hyperwallet' (cash, fee-based) | 'store_credit'
  options_json TEXT,              -- listing answers sent on create (offers, sale opt-in, shipping, ...)
  images_pending INTEGER NOT NULL DEFAULT 1,  -- GX is still fetching our image URLs; edits are blocked
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default GX category for every item in a CCG category (set when listing, reused next time).
ALTER TABLE ccg_inventory_categories ADD COLUMN gx_category_id INTEGER;

-- Every webhook GX sends, as received, with what we did about it.
CREATE TABLE gx_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT,                -- ListingStatusChange | OrderStatusChange
  status TEXT,                    -- data.status, e.g. Published, Sold, Awaiting Shipping
  gx_listing_id INTEGER,
  gx_order_id INTEGER,
  product_id TEXT,
  payload_json TEXT NOT NULL,
  result TEXT,                    -- processed | ignored | failed
  result_message TEXT,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gx_webhook_events_received_at ON gx_webhook_events(received_at);
