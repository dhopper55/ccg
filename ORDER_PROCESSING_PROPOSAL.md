# Order Processing Proposal

## Goal
Add first-class checkout/order tracking for direct purchase inventory sales.

Phase 1 scope:

- Stripe-hosted checkout from the existing cart
- Online and in-store assisted checkout using the same customer cart flow
- Pickup-only fulfillment
- Order records created only when checkout starts
- Reliable sold-state transitions driven by Stripe payment success

Out of scope for Phase 1:

- Rent-to-own / rental flows
- Cash, Venmo, Zelle, CashApp, PayPal manual checkout
- Payment links sent to customer phones
- Shipping and local delivery
- Stripe Terminal

## Confirmed Checkout Flow

### Cart ownership
- Online: the customer builds the cart.
- In store: staff uses associate mode, builds the cart from the public shop, and can include in-store-only items.
- At payment time, the customer uses the same cart checkout flow, even in store.
- Staff does not create orders manually for the Stripe flow.

### Order creation timing
- No order row exists while the cart is being built.
- Clicking the cart `Checkout` button creates the order and Stripe Checkout Session.
- The cart `Checkout` button starts the Stripe-hosted checkout flow.
- A separate `Checkout cash` button is shown but disabled for now.

### Payment method split
- `Checkout`: Stripe-hosted checkout for cards and Stripe-enabled financing.
- `Checkout cash`: future manual/offline payment flow for cash, Venmo, Zelle, CashApp, PayPal, etc.

## Recommended Architecture

### System of record
- Inventory data remains in `ccg_inventory_items`.
- Sale attempts and payment lifecycle state live in `orders`.
- Purchased inventory snapshots live in `order_items`.
- Stripe is the payment processor, not the catalog or inventory source of truth.
- Stripe webhooks are authoritative for payment success.

### Core principle
Use a Stripe Checkout Session per cart checkout attempt rather than creating durable Stripe product records for every inventory item.

Why:
- Inventory items are unique and often one-off.
- Associate mode can include in-store-only inventory in the same cart flow.
- Prices and terms can change at the moment of sale.
- Avoids catalog drift between D1 and Stripe.
- Avoids cleanup burden for sold or removed items.

## Availability States

Recommended `ccg_inventory_items.availability_status` values:

- `available`: item can be added to cart and checked out.
- `checkout_open`: item is reserved by an active Stripe Checkout Session.
- `sold`: payment succeeded and the item is no longer available.
- `unavailable`: item should not be offered for checkout, but is not sold.

Existing flags still matter:

- `is_active = 1`
- `is_sold = 0`
- `for_sale = 1`
- `is_rented = 0`
- `only_in_store = 1` requires associate mode.

## Proposed D1 Schema

### `orders`
```sql
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,

  status TEXT NOT NULL,
  channel TEXT NOT NULL,
  checkout_provider TEXT NOT NULL DEFAULT 'stripe',
  checkout_mode TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL DEFAULT 'pickup',

  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,

  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',

  reserve_expires_at TEXT,
  checkout_started_at TEXT,
  paid_at TEXT,
  cancelled_at TEXT,

  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  stripe_payment_status TEXT,

  success_url TEXT,
  cancel_url TEXT,

  created_by_admin_username TEXT,
  notes TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### `order_items`
```sql
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,

  item_title_snapshot TEXT NOT NULL,
  item_brand_snapshot TEXT,
  item_model_snapshot TEXT,
  item_condition_snapshot TEXT,
  item_image_url_snapshot TEXT,

  unit_price_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### `order_events`
```sql
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### Additions to `ccg_inventory_items`
```sql
ALTER TABLE ccg_inventory_items ADD COLUMN availability_status TEXT DEFAULT 'available';
ALTER TABLE ccg_inventory_items ADD COLUMN active_order_id TEXT;
ALTER TABLE ccg_inventory_items ADD COLUMN reserved_until TEXT;
```

## D1 Scripts

Run from `workers/listing-evaluator/`.

### Create order tables
```bash
npx wrangler d1 execute listing_evaluator --remote --command="
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  channel TEXT NOT NULL,
  checkout_provider TEXT NOT NULL DEFAULT 'stripe',
  checkout_mode TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL DEFAULT 'pickup',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  reserve_expires_at TEXT,
  checkout_started_at TEXT,
  paid_at TEXT,
  cancelled_at TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  stripe_payment_status TEXT,
  success_url TEXT,
  cancel_url TEXT,
  created_by_admin_username TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  item_title_snapshot TEXT NOT NULL,
  item_brand_snapshot TEXT,
  item_model_snapshot TEXT,
  item_condition_snapshot TEXT,
  item_image_url_snapshot TEXT,
  unit_price_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
"
```

### Add inventory reservation columns
Run each command separately. SQLite/D1 will fail an `ADD COLUMN` if the column already exists.

```bash
npx wrangler d1 execute listing_evaluator --remote --command="ALTER TABLE ccg_inventory_items ADD COLUMN availability_status TEXT DEFAULT 'available';"
npx wrangler d1 execute listing_evaluator --remote --command="ALTER TABLE ccg_inventory_items ADD COLUMN active_order_id TEXT;"
npx wrangler d1 execute listing_evaluator --remote --command="ALTER TABLE ccg_inventory_items ADD COLUMN reserved_until TEXT;"
```

### Backfill availability
```bash
npx wrangler d1 execute listing_evaluator --remote --command="
UPDATE ccg_inventory_items
SET availability_status = CASE
  WHEN COALESCE(is_sold, 0) = 1 THEN 'sold'
  WHEN COALESCE(is_active, 0) = 1
   AND COALESCE(is_sold, 0) = 0
   AND COALESCE(for_sale, 0) = 1
   AND COALESCE(is_rented, 0) = 0 THEN 'available'
  ELSE 'unavailable'
END
WHERE availability_status IS NULL
   OR availability_status = '';
"
```

### Add indexes
```bash
npx wrangler d1 execute listing_evaluator --remote --command="
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_reserve_expires_at ON orders(reserve_expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id ON orders(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_inventory_item_id ON order_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_active_order_id ON ccg_inventory_items(active_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_availability_status ON ccg_inventory_items(availability_status);
"
```

## Order Status Model

Phase 1 statuses:

- `checkout_open`
- `paid`
- `payment_failed`
- `expired`
- `cancelled`
- `refunded`
- `partially_refunded`

Status meanings:

- `checkout_open`: order row exists, Stripe Checkout Session exists or is being created, and item reservations are active.
- `paid`: webhook-confirmed payment success.
- `payment_failed`: Stripe asynchronous payment failed.
- `expired`: Stripe Checkout Session or reservation timed out.
- `cancelled`: checkout attempt was cancelled or released before payment.
- `refunded`: order fully refunded after payment.
- `partially_refunded`: order partially refunded after payment.

## Business Rules

- Only one active checkout order may reserve an inventory item at a time.
- Active checkout means `checkout_open` and `reserve_expires_at` is in the future.
- Once an order becomes `paid`, every `order_items.inventory_item_id` becomes sold.
- Expired, cancelled, or failed orders release their inventory items back to available state.
- Stripe webhook events are authoritative for payment success.
- Redirect pages are customer UX only and must not be treated as fulfillment success.
- Public online users cannot checkout `only_in_store` items.
- Associate mode can include `only_in_store` items in the same Stripe checkout flow.

## Public Endpoints

- `POST /api/shop/orders/create-checkout-session`
  - Accepts selected cart item IDs and quantities.
  - Loads item/pricing details from D1.
  - Creates `orders` and `order_items`.
  - Reserves each inventory item.
  - Creates a Stripe Checkout Session.
  - Returns the Stripe Checkout URL.

- `GET /api/shop/orders/:id/status`
  - Future thank-you page endpoint.
  - Returns current backend order status for polling.

## Stripe Webhook Endpoint

- `POST /api/stripe/webhook`
  - Verifies webhook signature.
  - Processes payment and checkout lifecycle events idempotently.

Recommended Stripe events:

- `checkout.session.completed`
  - If payment is complete, mark order `paid`.
  - Mark each inventory item in `order_items` sold.
- `checkout.session.async_payment_succeeded`
  - Mark order `paid`.
- `checkout.session.async_payment_failed`
  - Mark order `payment_failed`.
  - Release inventory reservations.
- `checkout.session.expired`
  - Mark order `expired`.
  - Release inventory reservations.
- refund-related Stripe events
  - Mark order `refunded` or `partially_refunded`.

Webhook handling must be idempotent.

## Reservation Expiration

Recommended behavior:

- Reserve cart items for 30 minutes when Stripe checkout starts.
- If `reserved_until < now` and the order is not paid, release the reservation.
- Run expiration checks:
  - when a new checkout starts for the same item
  - when admin loads item/order state
  - optionally in a scheduled cleanup later

## Thank-You Page

Use:

- `/guitars-and-gear-for-sale/checkout/success?order=UUID`

The page should call:

- `GET /api/shop/orders/:id/status`

Possible backend statuses:

- `paid`
- `processing`
- `expired`
- `not_found`

If the redirect lands before webhook processing finishes, show a pending confirmation state instead of assuming payment is final.

## Implementation Phases

### Phase 1A
- Enable existing cart `Checkout` button.
- Add disabled `Checkout cash` button.
- Add `POST /api/shop/orders/create-checkout-session`.
- Add `orders`, `order_items`, and `order_events`.
- Add inventory reservation fields.
- Create Stripe Checkout Session from cart.

### Phase 1B
- Implement Stripe webhook processing.
- Mark paid orders sold.
- Release failed/expired reservations.
- Add thank-you page status endpoint.

### Later
- Cash/manual checkout.
- Admin order management.
- Refund handling UI.
- Rentals/rent-to-own.
- Shipping/local delivery.
