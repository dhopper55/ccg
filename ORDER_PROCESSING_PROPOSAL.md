# Order Processing Proposal

## Goal
Add a first-class order model to support:

- In-store staff-assisted checkout
- Future online product-page checkout
- Stripe-hosted checkout for card and financing flows
- Inventory reservations for one-of-a-kind items
- Reliable sold-state transitions driven by payment success

This proposal keeps `ccg_inventory_items` as the inventory source of truth and introduces `orders` as the sale-attempt source of truth.

## Recommended Architecture

### System of record
- Inventory data remains in `ccg_inventory_items`
- Sale attempts and payment lifecycle state live in `orders`
- Stripe is the payment processor, not the source of truth for catalog/inventory state
- Stripe webhooks are authoritative for payment success

### Core principle
Use a Stripe Checkout Session per purchase attempt rather than creating durable Stripe product records for every inventory item.

Why:
- Inventory items are unique and often one-off
- Prices and terms can change at the moment of sale
- Avoids catalog drift between D1 and Stripe
- Avoids cleanup burden for sold or removed items

## Proposed D1 Schema

### `orders`
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY, -- UUID
  order_number TEXT NOT NULL UNIQUE,

  inventory_item_id INTEGER NOT NULL,
  status TEXT NOT NULL, -- draft, reserved, checkout_open, payment_processing, paid, expired, cancelled, payment_failed, refunded, partially_refunded

  channel TEXT NOT NULL, -- online, in_store, admin_remote, phone
  checkout_provider TEXT NOT NULL DEFAULT 'stripe',
  checkout_mode TEXT NOT NULL, -- hosted_checkout, payment_link, terminal, manual
  fulfillment_type TEXT NOT NULL DEFAULT 'pickup', -- pickup, shipping, local_delivery

  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,

  item_title_snapshot TEXT NOT NULL,
  item_brand_snapshot TEXT,
  item_model_snapshot TEXT,
  item_condition_snapshot TEXT,
  item_image_url_snapshot TEXT,

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

### `order_events`
```sql
CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- created, reserved, checkout_created, checkout_opened, checkout_completed, payment_succeeded, payment_failed, expired, cancelled, refunded
  from_status TEXT,
  to_status TEXT,
  source TEXT NOT NULL, -- admin_ui, public_site, stripe_webhook, system
  source_id TEXT, -- webhook event id, checkout session id, etc.
  message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Suggested additions to `ccg_inventory_items`
```sql
ALTER TABLE ccg_inventory_items ADD COLUMN availability_status TEXT DEFAULT 'available';
ALTER TABLE ccg_inventory_items ADD COLUMN active_order_id TEXT;
ALTER TABLE ccg_inventory_items ADD COLUMN reserved_until TEXT;
```

### Suggested indexes
```sql
CREATE INDEX idx_orders_inventory_item_id ON orders(inventory_item_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_reserve_expires_at ON orders(reserve_expires_at);
CREATE INDEX idx_order_events_order_id ON order_events(order_id);
```

## Order Status Model

Recommended order statuses:

- `draft`
- `reserved`
- `checkout_open`
- `payment_processing`
- `paid`
- `payment_failed`
- `expired`
- `cancelled`
- `refunded`
- `partially_refunded`

### Status meanings
- `draft`: order row exists but checkout session not created yet
- `reserved`: item is held and should not be sold elsewhere
- `checkout_open`: Stripe Checkout Session exists and is active
- `payment_processing`: payment is still settling or awaiting async confirmation
- `paid`: webhook-confirmed success
- `payment_failed`: checkout attempt failed
- `expired`: checkout session or reservation timed out
- `cancelled`: manually cancelled by staff or released before payment
- `refunded`: order fully refunded after payment
- `partially_refunded`: order partially refunded after payment

## Business Rules

- Only one open order may exist per inventory item at a time
- Open means `draft`, `reserved`, `checkout_open`, or `payment_processing`
- Once an order becomes `paid`, the inventory item becomes sold
- Expired, cancelled, or failed orders release the inventory item back to available state
- Stripe webhook events are authoritative for payment success
- Redirect pages are for customer UX only and must not be treated as fulfillment success

## Repo-Specific Flow

### In-store admin checkout flow
1. Staff opens an inventory item in Admin V2
2. Staff clicks `Start Checkout`
3. Worker verifies the inventory item is available
4. Worker creates an `orders` row with item snapshots and `status = 'reserved'`
5. Worker sets inventory row fields:
   - `availability_status = 'reserved'`
   - `active_order_id = order.id`
   - `reserved_until = now + 30 minutes`
6. Worker creates a Stripe Checkout Session with metadata:
   - `order_id`
   - `inventory_item_id`
   - `channel = in_store`
7. Worker stores `stripe_checkout_session_id`, sets order status to `checkout_open`, and returns the Checkout URL
8. Admin opens Stripe Checkout in a new tab and hands the device to the customer
9. Stripe redirects to a thank-you page on the site
10. Stripe webhook confirms payment and marks the order `paid`
11. Worker marks the inventory row sold

### Future public product-page checkout flow
Use the same core order pipeline:

- product page requests a Checkout Session from the Worker
- Worker reserves the item and creates an order
- Stripe Checkout handles payment and financing options
- webhook marks the order paid and inventory sold

## Worker Endpoints

### Admin endpoints
- `POST /api/admin-v2/orders/create-checkout-session`
  - Input: `inventoryItemId`, optional `channel`, optional customer stub
  - Creates reservation, order, and Stripe Checkout Session
- `POST /api/admin-v2/orders/:id/cancel`
  - Releases reservation if order is not paid
- `GET /api/admin-v2/orders/:id`
  - Returns order detail for admin drilldown
- `GET /api/admin-v2/orders`
  - Returns paged admin order list

### Public endpoints
- `POST /api/shop/orders/create-checkout-session`
  - Creates order and Stripe Checkout Session for public site checkout
- `GET /api/shop/orders/:id/status`
  - Returns current backend order status for thank-you page and polling

### Stripe webhook endpoint
- `POST /api/stripe/webhook`
  - Verifies webhook signature
  - Processes payment and checkout lifecycle events idempotently

## Stripe Object Strategy

Do not create durable Stripe product records for each inventory item by default.

Instead:
- create one Checkout Session per sale attempt
- pass item title and pricing as the current sale snapshot
- attach internal metadata such as `order_id` and `inventory_item_id`

This fits one-off inventory better than maintaining a mirrored Stripe catalog.

## Webhook State Machine

Recommended Stripe events to handle:

- `checkout.session.completed`
  - If payment is complete, mark order `paid`
  - Mark inventory item sold
- `checkout.session.async_payment_succeeded`
  - Mark order `paid`
- `checkout.session.async_payment_failed`
  - Mark order `payment_failed`
  - Release inventory reservation
- `checkout.session.expired`
  - Mark order `expired`
  - Release inventory reservation
- refund-related Stripe events
  - Mark order `refunded` or `partially_refunded`

Webhook handling must be idempotent.

## Reservation Expiration

Recommended reservation behavior:

- reserve the item for 30 minutes when checkout begins
- if `reserve_expires_at < now` and the order is not paid, release the reservation
- run expiration checks:
  - when a new checkout starts for the same item
  - when admin loads item/order state
  - optionally in a scheduled cleanup later

This avoids blocked inventory caused by abandoned checkouts.

## Thank-You Page

Use a site page such as:

- `/checkout/success?order=UUID`

This page should call a backend endpoint such as:

- `GET /api/shop/orders/:id/status`

Possible backend statuses:

- `paid`
- `processing`
- `expired`
- `not_found`

If redirect lands before webhook processing finishes, the page should show a pending confirmation state instead of assuming payment is final.

## Admin UX Proposal

On the Admin V2 inventory item page, add:

- `Start Checkout`
- `Open Active Checkout`
- `Cancel Reservation`
- availability badge: `Available`, `Reserved`, `Sold`
- reservation countdown if the item is currently reserved

For sold items, show:

- order number
- Stripe payment reference
- paid timestamp

## Why This Fits The Current Repo

This proposal fits the existing architecture because:

- D1 is already the source of truth for application data
- the Cloudflare Worker already owns API and business logic
- Admin V2 already consumes Worker endpoints
- shop preview already treats the Worker as the source of truth
- inventory is primarily one-off and unique, which favors reservation-based checkout

## Recommended Implementation Phases

### Phase 1
- Add `orders` and `order_events`
- Add inventory availability fields
- Implement admin-only in-store checkout
- Implement Stripe Checkout Session creation
- Implement Stripe webhook processing
- Add thank-you page status endpoint

### Phase 2
- Reuse the same order flow for public product pages
- Add admin order list/reporting
- Add refund synchronization and admin visibility

## Summary

Recommended direction:

- Keep inventory in D1 as the source of truth
- Introduce `orders` as the source of truth for sale attempts
- Use Stripe Checkout Sessions per attempt
- Use webhooks, not redirects, as the authoritative payment-success signal
- Reserve one-of-a-kind inventory while checkout is open

This provides a clean path for both in-store and online checkout without forcing Stripe to become the catalog or inventory system of record.
