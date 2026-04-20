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
  checkout_type TEXT NOT NULL DEFAULT 'stripe',
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
```

`active_order_id` and `reserved_until` may exist from earlier checkout testing, but they are no longer part of the checkout model.

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
  checkout_type TEXT NOT NULL DEFAULT 'stripe',
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

### Patch an existing `orders` table
If `orders` already existed, `CREATE TABLE IF NOT EXISTS orders (...)` does not add missing columns.
Check the existing columns first:

```sql
PRAGMA table_info(orders);
```

Then run only the missing columns one at a time. If a command reports `duplicate column name`, that column already exists and you can skip it.

```sql
ALTER TABLE orders ADD COLUMN checkout_provider TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE orders ADD COLUMN checkout_type TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE orders ADD COLUMN checkout_mode TEXT NOT NULL DEFAULT 'hosted_checkout';
ALTER TABLE orders ADD COLUMN fulfillment_type TEXT NOT NULL DEFAULT 'pickup';
ALTER TABLE orders ADD COLUMN customer_name TEXT;
ALTER TABLE orders ADD COLUMN customer_email TEXT;
ALTER TABLE orders ADD COLUMN customer_phone TEXT;
ALTER TABLE orders ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE orders ADD COLUMN reserve_expires_at TEXT;
ALTER TABLE orders ADD COLUMN checkout_started_at TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE orders ADD COLUMN stripe_payment_status TEXT;
ALTER TABLE orders ADD COLUMN success_url TEXT;
ALTER TABLE orders ADD COLUMN cancel_url TEXT;
ALTER TABLE orders ADD COLUMN created_by_admin_username TEXT;
ALTER TABLE orders ADD COLUMN notes TEXT;
ALTER TABLE orders ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

After patching, create the Stripe Checkout Session uniqueness index if it does not already exist:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id_unique
ON orders(stripe_checkout_session_id)
WHERE stripe_checkout_session_id IS NOT NULL;
```

### Add inventory availability column
SQLite/D1 will fail an `ADD COLUMN` if the column already exists.
If Cloudflare Studio reports `duplicate column name`, that specific column is already done; remove that line and continue with the remaining columns.

To check which columns already exist:

```sql
PRAGMA table_info(ccg_inventory_items);
```

```bash
npx wrangler d1 execute listing_evaluator --remote --command="ALTER TABLE ccg_inventory_items ADD COLUMN availability_status TEXT DEFAULT 'available';"
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
CREATE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id ON orders(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_inventory_item_id ON order_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
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

- `checkout_open`: order row exists and Stripe Checkout Session exists or is being created.
- `paid`: webhook-confirmed payment success.
- `payment_failed`: Stripe asynchronous payment failed.
- `expired`: Stripe Checkout Session timed out.
- `cancelled`: checkout attempt was cancelled or released before payment.
- `refunded`: order fully refunded after payment.
- `partially_refunded`: order partially refunded after payment.

## Business Rules

- Checkout does not reserve inventory. Multiple customers can start checkout for the same item.
- Once an order becomes `paid`, inventory quantity is adjusted from `order_items.quantity`.
- If a purchase partially sells a multi-quantity item, the original inventory row remains available with the remaining quantity.
- Partial sales create a new sold `ccg_inventory_items` row cloned from the original row, with the sold quantity, copied images, and sold metadata.
- If a purchase exhausts the original quantity, the original row is set to quantity `0` and marked sold; no clone is created.
- Expired, cancelled, or failed orders update order status only; inventory is unchanged.
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

### Stripe Dashboard setup

Create a webhook endpoint in Stripe test mode:

- Endpoint URL: `https://www.coalcreekguitars.com/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`

Set the webhook signing secret on the Worker:

```bash
cd workers/listing-evaluator
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler deploy
```

Use the `whsec_...` signing secret from the Stripe webhook endpoint details.

Recommended Stripe events:

- `checkout.session.completed`
  - If payment is complete, mark order `paid`.
  - Mark each inventory item in `order_items` sold.
- `checkout.session.async_payment_succeeded`
  - Mark order `paid`.
- `checkout.session.async_payment_failed`
  - Mark order `payment_failed`.
- `checkout.session.expired`
  - Mark order `expired`.
- refund-related Stripe events
  - Mark order `refunded` or `partially_refunded`.

Webhook handling must be idempotent.

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
