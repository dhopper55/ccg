-- Applied 2026-10-23: manual orders for items marked sold in admin, plus
-- per-order payments so one order can be paid several ways (e.g. guitar paid on FBM,
-- case paid by Stripe link) and show a net payout.
--
-- orders / order_items / order_events are reused as-is. Manual orders use:
--   status = 'paid', checkout_type = checkout_provider = checkout_mode = 'manual',
--   channel = 'fbm' | 'reverb' | 'ebay' | 'in_store' | 'online' | 'other',
--   listings_updated = 1 (marking sold already handled the listings).
-- No new columns on ccg_inventory_items (it is at D1's 100-column limit); an item's
-- order is found through order_items.inventory_item_id.

-- An earlier, never-used Stripe-era order_payments table (0 rows, no code reads it) holds
-- the name. Keep it, renamed, rather than dropping it.
ALTER TABLE order_payments RENAME TO order_payments_legacy_unused;

-- Marketplace's own order number (Reverb order #, eBay order #); used later to mark shipped.
ALTER TABLE orders ADD COLUMN channel_order_ref TEXT;

-- One row per payment received toward an order. Order net payout =
-- SUM(net_cents) of non-refunded payments (later: minus shipping label costs).
CREATE TABLE order_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  inventory_item_id INTEGER REFERENCES ccg_inventory_items(id) ON DELETE SET NULL, -- item this payment was for, if one
  method TEXT NOT NULL,                        -- 'fbm' | 'reverb' | 'ebay' | 'stripe_link' | 'stripe_checkout' | 'stripe_terminal' | 'cash' | 'venmo' | 'zelle' | 'other'
  status TEXT NOT NULL DEFAULT 'received',     -- 'received' | 'refund_needed' | 'refunded'
  gross_cents INTEGER NOT NULL,                -- what the buyer paid for this payment, incl. shipping they paid
  shipping_charged_cents INTEGER NOT NULL DEFAULT 0, -- portion of gross that was buyer-paid shipping
  tax_cents INTEGER NOT NULL DEFAULT 0,        -- tax WE collected (0 for Reverb/FBM: marketplace remits)
  fee_cents INTEGER NOT NULL DEFAULT 0,        -- platform + processing fees
  fee_is_estimate INTEGER NOT NULL DEFAULT 1,  -- 1 = pre-filled from method rate, 0 = confirmed actual
  net_cents INTEGER NOT NULL,                  -- gross - tax - fees = what lands in the bank
  external_ref TEXT,                           -- Stripe session/payment intent id, Reverb order #, ...
  paid_at TEXT NOT NULL,
  payout_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'received' (cash/in-store = 'received')
  payout_received_at TEXT,
  notes TEXT,
  created_by_admin_username TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_order_payments_order ON order_payments(order_id);
CREATE INDEX idx_order_payments_item ON order_payments(inventory_item_id);

-- Item -> order lookup (inventory edit "Order #" link, "Sold, no order" filter).
CREATE INDEX IF NOT EXISTS idx_order_items_inventory_item ON order_items(inventory_item_id);
