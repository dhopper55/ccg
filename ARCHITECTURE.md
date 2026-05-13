# Coal Creek Guitars Site Architecture

## Overview
The repo now has three active surfaces plus one shared Cloudflare Worker backend:
1) Legacy static public site at the repo root
2) Admin V2 Aurora app served from `/admin`
3) Shop Aurora storefront served from `/guitars-and-gear-for-sale/`, plus Aurora decoder pages served from `/decoders/`
4) Cloudflare Worker backend that powers all `/api/*` routes

The Worker currently:
1) Accepts Craigslist/Facebook Marketplace URLs for evaluation
2) Starts Apify scraper runs and processes webhooks
3) Calls OpenAI to summarize listings and estimate pricing
4) Writes results to D1 (SQLite) and exposes them via listing/admin/shop APIs
5) Protects admin/private `/api/*` with a simple username/password login (HttpOnly cookie)
6) Receives serial decoder tracking events from public decoder pages and stores them in D1
7) Stores reusable serial-pattern metadata/content for decoder context rendering
8) Powers inventory, Admin V2, shop product/category/image/order endpoints, and dynamic sitemap/robots responses

## Root public site
The repo root contains the legacy static public site and shared public assets.

Important root files and directories:
- `index.html` — main homepage cards and intro content
- `styles.css` — shared legacy/root public styles, including decoder legacy styles and `/faq`
- `faq/index.html` — static public FAQ page served at `/faq`
- `about-us.html`, `contact-us.html`, `privacy-policy.html`, `terms-conditions.html`, and guide pages
- `images/` — shared public images used by root static pages and generated metadata
- `templates/` — text/listing templates used by listing workflows
- `_redirects` — Cloudflare Pages redirect/fallback rules for `/admin`, `/guitars-and-gear-for-sale`, and `/decoders`
- `_headers` — cache headers for SPA shells and hashed assets
- `functions/sitemap.xml.js` — Pages Function sitemap generator

Root URL conventions:
- Clean directory pages are used where practical, e.g. `/faq` and `/new-guitarist-practice-resources`.
- Some older root pages remain `.html`, e.g. `/about-us.html` and `/contact-us.html`.
- `/faq` is a static root page, not part of the shop app or admin app.
- `npm run build:legacy` compiles shared TypeScript and updates static cache-buster query strings.

Sitemap behavior:
- `/sitemap.xml` is implemented in both `functions/sitemap.xml.js` and the Worker fallback `handleSitemap(...)`.
- Keep static URL lists in both places in sync.
- Product URLs are appended dynamically from shop product rows.
- `/robots.txt` points crawlers to `https://www.coalcreekguitars.com/sitemap.xml`.

Important decoder/deploy distinction:
- Public serial decoder pages are Aurora React pages built from `shop-app/` and emitted as static route entries under `decoders/`.
- The actual decode decision for live users is server-side at `POST /api/decode`.
- That endpoint is implemented in the Cloudflare Worker at `workers/listing-evaluator/src/index.ts`.
- The worker imports and runs `src/serial-decode-service.ts`, which calls the brand decoders in `src/decoders/*.ts`.
- Because of that, a change to a decoder file can require a worker deploy even if the decoder page UI itself did not change.
- Pages deploys update static HTML/JS/CSS. Worker deploys update live `/api/*` behavior.

## Admin
Admin is served from `/admin` and built from the Aurora-based app.

Layout:
- Source app: `admin-v2-app/`
- Deployed static output: `admin/`
- Build command: `npm run build:admin-v2`

### Aurora
Admin V2 is based on the Aurora admin template.

Aurora is not just a skin:
- It provides the page structure, card hierarchy, dashboard composition, tables, charts, and layout patterns V2 should follow.
- New V2 pages should start from Aurora’s existing pages, sections, and layout infrastructure wherever possible.
- The goal is to replace demo data with Coal Creek data while preserving Aurora’s composition and visual grammar.

### Important implementation note
An early V2 mistake was trying to build pages by hand while only loosely borrowing Aurora styling. That produced pages that were functionally correct but visually worse than the template baseline.

Going forward, the rule is:
- Build admin pages using Aurora infrastructure first.
- Prefer adapting the closest Aurora page in `admin-v2-app/src/pages/` or section in `admin-v2-app/src/components/sections/`.
- Do not hand-compose admin UI.
- Do not hand-compose new dashboards, forms, cards, grids, or page layouts.
- In admin, always use Aurora patterns, Aurora page structure, Aurora spacing, and Aurora composition primitives first.
- If a screen needs a new arrangement, find the closest Aurora example and adapt it instead of inventing a custom layout.
- If admin needs different backend payloads, add endpoints under `/api/admin-v2/*` rather than changing legacy endpoint contracts.

## Shop
There is a separate Aurora-based storefront app deployed at `/guitars-and-gear-for-sale/`. The same app also owns the modern public decoder page UI at `/decoders/`.

Layout:
- Source app: `shop-app/`
- Deployed static output: `guitars-and-gear-for-sale/` for the app shell/assets, plus generated decoder route entries under `decoders/<slug>/index.html`
- Public URLs: `https://www.coalcreekguitars.com/guitars-and-gear-for-sale/` and `https://www.coalcreekguitars.com/decoders/<decoder-slug>`
- Build command: `npm run build:shop`
- Base path: `VITE_BASENAME=/guitars-and-gear-for-sale/` (used by Vite asset output and by React Router only for shop URLs)

Routing:
- Uses `createBrowserRouter` with basename `/guitars-and-gear-for-sale` for shop URLs and `/` for `/decoders/*` URLs.
- Product grid at `/` (inside the basename).
- Product detail at `/:category/:slug` — e.g. `/guitars-and-gear-for-sale/packages/ovation-guitar-crate-amp-package`.
- Cart and checkout pages live inside the shop app. Customer checkout always uses web Stripe Checkout. Associate checkout can use cash, web Stripe, Stripe Terminal, or card + cash split tender.
- SPA fallback is handled by the `_redirects` rule `/guitars-and-gear-for-sale/* /guitars-and-gear-for-sale/index.html 200` so deep-link URLs resolve correctly.
- Decoder pages are generated from the same shop build by `scripts/sync-shop-decoder-routes.mjs`, which copies the built app shell to `decoders/<slug>/index.html` and injects per-decoder SEO metadata.
- Old `/new/decoders/*` URLs redirect to canonical `/decoders/*` URLs.

Clean URL convention:
- First path segment = primary category name, slugified via `slugifyCategory()` in `shop-app/src/lib/utils.ts` (lowercase, `&` → `and`, non-alphanumerics → `-`, trimmed dashes).
- Second path segment = the inventory item's `sale_url` column (manually entered in admin; treated as a slug; required when `for_sale=1`; expected to be globally unique).
- Primary category is assumed to always be a top-level category (enforced upstream; never a sub-category).
- On product detail load, if the slugified canonical category doesn't match the URL's category segment, the client replaces the URL with the canonical form.

Implementation notes:
- Standalone Aurora app, not a route inside Admin V2.
- Public; not gated by admin auth.
- Uses public Worker endpoints under `/api/shop/*`.
- Product grid/search can perform an exact barcode match. If the search query exactly matches `ccg_inventory_items.barcode`, the UI redirects to that product detail route. Partial barcode matches are intentionally ignored.
- Product/listing images are delivered through public image URLs and Cloudflare image transformations (`/cdn-cgi/image/...`) for thumbnail/card/detail presets to avoid loading full-size originals in grids.
- Sales tax is currently 8.05% for shop checkout calculations and receipts.
- Associate mode is controlled by the `ccg_associate` cookie/token flow. It enables in-store-only products and associate checkout actions.
- Current Worker contracts used by the shopping view:
  - `GET /api/shop/categories`
  - `GET /api/shop/products`
  - `GET /api/shop/products/by-slug/:slug`
  - `GET /api/shop/products/:id` (legacy numeric lookup; still available)
  - `POST /api/shop/orders/create-checkout-session`
  - `POST /api/shop/orders/create-terminal-payment`
  - `GET /api/shop/orders/:id/terminal-payment`
  - `POST /api/shop/orders/:id/terminal-payment/cancel`
  - `POST /api/shop/orders/create-cash-order`
  - `GET /api/shop/orders/:id/receipt`
  - `GET /api/shop/receipt-templates/:name`
- Keep storefront-specific Worker contracts under `/api/shop/*` so they stay clearly separated from Admin V2 and legacy admin contracts.

### Checkout, payment, receipts, and mPOP
- Normal customer checkout uses hosted Stripe Checkout only. It does not attempt mPOP/WebPRNT interaction.
- Associate checkout exposes in-store payment choices: cash only, web Stripe, Stripe Terminal, and card + cash split tender.
- Card + cash asks for the card amount first, then lets the associate choose Web or Terminal for the card portion.
- Stripe Terminal currently targets BBPOS WisePOS E readers. Reader selection comes from `sys_info` when available, then `STRIPE_TERMINAL_READER_ID` / `STRIPE_TERMINAL_READER_ID_SANDBOX`, then online reader discovery.
- Cash-only and card+cash orders should kick the cash drawer through the shop app’s WebPRNT/mPOP flow.
- Checkout success fetches receipt data from `/api/shop/orders/:id/receipt` and prints when the in-store browser supports it.
- Refunds from Admin V2 Order Manager use `/api/admin-v2/orders/:id/refund`; Stripe orders get a Stripe refund, cash orders are marked refunded locally. Orders involving cash should kick the drawer and print a refund receipt from the admin UI.
- Receipt templates live in D1 table `receipt_templates` and are exposed by `/api/shop/receipt-templates/:name`.

### Auth and backend
- Admin uses the same worker auth model:
  - `POST /api/login`
  - `GET /api/session`
  - `POST /api/logout`
- Admin-specific endpoints live under `/api/admin-v2/*`.
- Serial Decodes admin page behavior:
  - Top chart: Brand response counts (descending), clickable bars set page-level Brand filter.
  - Grid: pagination, timestamp sort, page-level Brand filter, `Only errors`, conditional `Unevaluated`.
  - Grid row action: for failed decodes, `Evaluated?` checkbox updates DB via `/api/admin-v2/serial-decodes/:id/evaluated`.
- Serial Pattern Text admin page behavior:
  - Grid lists `brand + pattern` rows from `serial_decode_pattern_lookup`
  - Default view shows rows where rich text is empty; `Show All` reveals all rows
  - Edit dialog shows Brand/Pattern/Regex and rich-text editor
  - Save path (`POST /api/admin-v2/serial-pattern-text`) sanitizes HTML before persistence
  - Add mode behavior: if row had empty rich text, server runs AI paraphrase into standardized Coal Creek structure before save
  - Update mode behavior: if row already had content, server saves edited HTML directly (sanitized)

## Auth
The public site and the admin surfaces do not use the same access model.

- Public-facing pages on the main site are not gated by the admin login flow.
- `/admin` is the protected admin application.
- `/guitars-and-gear-for-sale/` is public.

Shared admin login flow:
- `POST /api/login` with `{ username, password }`
- `GET /api/session` for session check
- `POST /api/logout` to clear the admin session

Implementation notes:
- `/admin` enforces auth in the app shell and route guards using worker-backed session endpoints.
- Worker issues an HttpOnly cookie (`auth`) on successful login.

All `/api/*` endpoints require auth except:
- `/api/login`
- `/api/session`
- `/api/listings/webhook` (Apify webhook)
- `/api/serial-decodes` (public decoder tracking ingest)
- `/api/decode` (public server-side serial decoder endpoint)
- `/api/shop/*` (public shop preview endpoints)
- `/api/stripe/webhook` (Stripe webhook)
- `/api/inventory-image` (public inventory image streaming for non-private inventory images)
- `/api/image` (public image proxy/transform helper where used)

## Cloudflare Worker
- Location: `workers/listing-evaluator/src/index.ts`
- Wrangler config: `workers/listing-evaluator/wrangler.toml`
- Routes include `https://www.coalcreekguitars.com/api/*`, `https://www.coalcreekguitars.com/sitemap.xml`, `https://www.coalcreekguitars.com/robots.txt`, and shop route handling for dynamic SEO fallbacks.

### Serial decoding flow
The serial decoder feature spans both the static site and the worker:

1. Decoder page UI
   - React UI in `shop-app/src/pages/decoders/`
   - Collects `brand`, `serial`, `pagePath`, `userAgent`, and `clientTimestamp`
   - Sends them to `POST /api/decode`

2. Server-side decode
   - Worker handler: `handleDecodeRequest(...)` in `workers/listing-evaluator/src/index.ts`
   - Calls `decodeSerialForBackend(...)` from `src/serial-decode-service.ts`
   - `decodeSerialForBackend(...)` selects the brand decoder from `src/decoders/*.ts`
   - Backend can still reject a brand-decoder match if the result is too ambiguous for server acceptance
   - Worker may optionally try AI fallback if rule-based decoding fails

3. Persistence/context
   - Worker logs decode attempts to `serial_decode_events`
   - On successful decodes, worker derives pattern keys and upserts `serial_decode_pattern_lookup`
   - Rich text from `serial_decode_pattern_lookup` can be returned as additional decoder context

Practical rule:
- If you change `src/decoders/*.ts` or `src/serial-decode-service.ts`, assume `/api/decode` behavior changed and deploy the worker.
- If you change decoder page markup, styling, or browser-side UX in `shop-app/src/pages/decoders/`, deploy Pages.
- Some changes touch both and require both deploy paths.

### Endpoints
- `POST /api/login`
  - Verifies credentials and sets auth cookie
- `GET /api/session`
  - Returns session status

- `POST /api/listings/submit`
  - Validates URLs (Craigslist/Facebook)
  - Starts Apify actor run
  - Writes queued record to D1
  - Stores runId → D1 recordId in KV

- `POST /api/listings/custom`
  - Admin-only custom eval path for in-person items
  - Accepts 1-10 uploaded photos plus optional `brand`, `model`, `condition`, and `notes`
  - Stores images in R2, creates a queued listing row in D1, and processes it through the same single-item AI analysis pipeline

- `GET /api/listings/custom-image`
  - Streams custom eval images from R2 for admin results/detail views

- `POST /api/listings/webhook`
  - Receives Apify webhook
  - Fetches dataset item
  - Normalizes fields
  - Calls OpenAI
  - Updates D1 record

- `POST /api/serial-decodes`
  - Public ingest endpoint used by all serial decoder pages
  - Accepts decoder event payload (`brand`, `serial`, `success`, optional `year/factory/country/error`)
  - Adds request metadata (`page_path`, `user_agent`, `CF-Connecting-IP`, `cf_country`, `cf_colo`)
  - Writes one row per decode attempt to D1 table `serial_decode_events`

- `POST /api/decode`
  - Public decoder endpoint used by brand decoder pages
  - Runs `decodeSerialForBackend(...)` (brand decoder + normalization/retry rules)
  - Logs decode event rows to `serial_decode_events`
  - On successful decode, derives pattern metadata and upserts pattern rows into `serial_decode_pattern_lookup`
  - Returns `additionalContextRichText` when the matched pattern row has populated rich text

- `GET /api/listings`
  - Paged listing results for results UI
- `GET /api/listings/:id`
  - Single listing detail
- `POST /api/listings/:id/archive`
  - Archive listing record
- `GET /api/listings/:id/debug`
  - Debug payload for a listing
- `POST /api/listings/reprocess`
  - Re-run AI processing for a listing
- `GET /api/inventory`
  - Legacy inventory admin list
- `POST /api/inventory`
  - Create inventory item(s)
- `GET /api/inventory/summary`
  - Legacy inventory summary totals
- `GET /api/inventory/:id`
  - Inventory detail payload used by Admin V2 inventory item page
- `POST /api/inventory/:id/update`
  - Update inventory item
- `POST /api/inventory/:id/delete`
  - Delete inventory item
- `POST /api/inventory/package-create`
  - Create a package inventory item from currently marked rows
- `GET /api/inventory-image`
  - Streams inventory images from R2
  - Public, but only returns non-private inventory images
- `POST /api/inventory/upload-image`
  - Upload inventory image to R2
- `POST /api/inventory/import-image`
  - Import external inventory image into R2

- `GET /api/shop/categories`
  - Public shop category tree ordered from `ccg_inventory_categories`
  - Returns both flat `records` and nested `tree`
- `GET /api/shop/products`
  - Public product feed for the shop
  - Supports categories, text search, sold toggle, price range, and condition filters
  - Returns `barcodeMatch` when the query exactly matches an inventory barcode
  - Category query params accepted by the Worker:
    - `categoryId`
    - `categoryIds`
    - `categories` (CSV)
  - Category filtering expands selected parent categories to include descendants
  - Category filtering matches when either the primary category (`category_id`) or secondary category (`secondary_category_id`) is in the expanded category set
  - Returns storefront-ready fields: main image, title, `saleUrlSlug` (from `sale_url`), `primaryCategoryName`, category labels, prices

- `GET /api/shop/products/by-slug/:slug`
  - Public product detail lookup by `sale_url` slug
  - Slug is matched case-insensitively against `ccg_inventory_items.sale_url`
  - Returns the same shape as `GET /api/shop/products/:id`, including `saleUrlSlug` and `primaryCategoryName` for canonical URL resolution

- `POST /api/shop/orders/create-checkout-session`
  - Creates a hosted Stripe Checkout Session for customer web checkout or associate web-card/card+cash checkout
  - Creates local `orders`, `order_items`, and `order_events` rows before redirect

- `POST /api/shop/orders/create-terminal-payment`
  - Associate-only Stripe Terminal checkout path
  - Creates a local order, PaymentIntent, and reader action for the configured WisePOS E

- `GET /api/shop/orders/:id/terminal-payment`
  - Polls Terminal PaymentIntent/order state and completes the order when paid

- `POST /api/shop/orders/:id/terminal-payment/cancel`
  - Cancels an active Terminal reader action and marks/cancels the local order where applicable

- `POST /api/shop/orders/create-cash-order`
  - Associate-only cash checkout path
  - Creates and immediately marks a cash order paid

- `GET /api/shop/orders/:id/receipt`
  - Public receipt payload for checkout success and printing

- `GET /api/shop/receipt-templates/:name`
  - Returns receipt template text by template name

- `GET /api/admin-v2/dashboard/summary`
  - Dashboard KPI totals for Admin V2 home page
- `GET /api/admin-v2/dashboard/profit-trend`
  - Profit trend series for Admin V2 home page
- `GET /api/admin-v2/dashboard/inventory-aging`
  - Aging buckets for active unsold inventory
- `GET /api/admin-v2/dashboard/inventory-by-category`
  - Inventory category distribution for Admin V2
- `GET /api/admin-v2/dashboard/recent-sales`
  - Recent sold inventory rows for Admin V2
- `GET /api/admin-v2/dashboard/oldest-inventory`
  - Oldest active unsold inventory rows for Admin V2
- `GET /api/admin-v2/payment-links`
  - Admin V2 Stripe Payment Links grid
  - Reads Stripe Payment Links and line items via Stripe API
- `GET /api/admin-v2/payment-links/marked-items`
  - Returns compact summary of currently marked inventory rows for Payment Link creation modal
- `POST /api/admin-v2/payment-links`
  - Creates a Stripe Payment Link from all currently marked inventory rows
  - Accepts per-item quantities; quantity `0` omits a marked item from the link
  - Validates requested quantities against current available inventory before creating Stripe objects
  - Creates fresh Stripe Product and Price objects for each marked inventory row on every run
  - Optionally attaches configured Colorado sales tax rate via `line_items.tax_rates`
- `POST /api/stripe/webhook`
  - Handles Stripe Checkout webhooks for normal shop checkout orders
  - For Admin V2 Payment Links, creates a local order on successful payment and reuses the normal paid-order inventory adjustment flow
- `GET /api/admin-v2/stripe-config`
  - Reads Stripe sandbox/production mode from `sys_info`
- `POST /api/admin-v2/stripe-config`
  - Toggles `sys_info.use_stripe_sandbox` live from Admin V2 Payment Links
- `POST /api/admin-v2/order-confirmation-email/test`
  - Sends a Brevo transactional order confirmation test email using static sample payload values
  - Reads Brevo API key, sender, and template config from `sys_info`
- `GET /api/admin-v2/serial-decodes`
  - Admin V2 serial decode grid data
  - Supports query params: `page`, `limit`, `brand`, `onlyErrors`, `unevaluated`, `sortDir`
  - Returns rows sorted by decode timestamp with pagination and available brand list
- `GET /api/admin-v2/serial-decodes/brand-responses`
  - Admin V2 chart payload for response counts by brand (descending)
- `POST /api/admin-v2/serial-decodes/:id/evaluated`
  - Toggle one serial decode row `evaluated` state (`true/false`)
- `GET /api/admin-v2/serial-pattern-text`
  - Admin V2 serial pattern text grid data (paged/sorted, optional show-all)
- `POST /api/admin-v2/serial-pattern-text`
  - Upsert rich text content for one `brand + pattern` row
  - Derives/stores regex for pattern key (`regex_pattern`) where column exists
  - Sanitizes HTML input before storing
  - Add mode (existing row empty) triggers AI paraphrase to standardized HTML structure
- `POST /api/admin-v2/serial-contexts/generate`
  - Screenshot-to-context flow for generating reusable pattern context (AI + sanitization)
- `GET /api/admin-v2/listings/:id`
  - Listing detail payload used by Admin V2 listing drilldown
- `POST /api/admin-v2/inventory/:id/mark`
  - Toggle inventory `Marked` state from Inventory Manager grid
- `POST /api/admin-v2/inventory/unmark-all`
  - Unmark all inventory rows in DB
- `GET /api/admin-v2/inventory/labels.pdf`
  - Generate labels PDF from currently marked inventory and then clear marked state
- `GET /api/admin-v2/inventory/categories`
  - Admin V2 category tree endpoint for inventory forms and filters
- `POST /api/admin-v2/inventory/merge-marked`
  - Merge marked inventory rows into one new inventory item
- `GET /api/admin-v2/orders`
  - Admin V2 Order Manager order list
- `GET /api/admin-v2/orders/:id`
  - Admin V2 order detail, including items and timeline/events
- `POST /api/admin-v2/orders/:id/refund`
  - Full-order refund path
  - Creates Stripe refund for Stripe-backed orders; cash orders are marked refunded locally
  - Restores inventory and records order events

## Apify
- Craigslist actor: `ivanvs/craigslist-scraper`
  - Needs input with `urls: [{ url }]`
  - Detail fields are in `post` and `pics`

- Facebook actor: `apify/facebook-marketplace-scraper`
  - Requires cookies for reliable access
  - Output fields used: `listingTitle`, `description.text`, `listingPrice.*`, `locationText.text`, `listingPhotos[].image.uri`

Cookies refresh instructions live in:
- `workers/listing-evaluator/FACEBOOK-COOKIES.md`

## D1 (SQLite)
Tables:
- `listings`
- `ccg_inventory_items`
  - Inventory source-of-truth row table
  - Primary category: `category_id` (`NOT NULL`); assumed to be a top-level category (never a sub-category)
  - Secondary category: `secondary_category_id` (`NULLABLE`)
  - Sale/detail fields include:
    - `video_url`
    - `sale_title`
    - `sale_url` — slug used in the public shop URL path segment for the product (e.g. `ovation-guitar-crate-amp-package`); required when `for_sale=1`; expected to be globally unique; `VARCHAR(150)`
    - `regular_price`
    - `sale_price`
    - `"condition"`
    - `sale_description`
    - `barcode` — exact-match shop/admin search barcode field; `VARCHAR(50)`
    - sale bullet fields (`bullet1_text` through `bullet6_text`) plus danger/highlight flags
    - `sale_zip`
    - sold/rental/active/marked/personal flags used by admin and checkout flows
  - FBM fields are no longer part of the active model/contracts
- `ccg_inventory_categories`
  - Inventory/shop category lookup table
  - Fields:
    - `id`
    - `name`
    - `parent_id`
    - `"order"`
  - Supports nested categories up to 3 levels deep
  - `"order"` is sibling-local ordering and resets inside each parent group
- `ccg_inventory_item_images`
  - Child table for ordered inventory images
  - Fields:
    - `id`
    - `inventory_item_id`
    - `image_url`
    - `display_order`
    - `is_private`
  - `is_private` is `INTEGER NOT NULL DEFAULT 0`
  - This is now the authoritative ordered image model
  - Worker still keeps `ccg_inventory_items.image_url` and `image_urls` synchronized for compatibility
- `serial_decode_events`
  - Stores decoder tracking rows from `/api/serial-decodes`
  - Core fields: `brand`, `serial`, `success`, `year`, `factory`, `country`, `error`
  - Workflow field: `evaluated` (`INTEGER` 0/1, default `0`)
  - Metadata fields: `event_time_utc`, `page_path`, `user_agent`, `client_timestamp`, `ip_address`, `cf_country`, `cf_colo`, `created_at`
  - Pattern linkage fields:
    - `pattern_lookup_id` (FK-style linkage to pattern lookup row id when available)
    - stores matched pattern metadata in event stream for analytics/debug
- `serial_decode_pattern_lookup`
  - Reusable pattern-level content table used by decoder responses and Admin V2 editor
  - Primary identity: `brand + pattern` (composite uniqueness)
  - Content fields: `regex_pattern`, `rich_text`, timestamps
  - Populated automatically from successful decode traffic (upsert on pattern)
  - Edited from Admin V2 Serial Pattern Text page
- `sys_info`
  - One-row system configuration table
  - Stores Stripe production/sandbox secret keys and tax rate ids
  - `use_stripe_sandbox` controls which Stripe credentials the Worker uses
  - Stores Stripe Terminal reader ids for production/sandbox when present
  - Stores Brevo API key, order confirmation template id, and sender identity for transactional email
- `orders`
  - Local order header table for shop checkout, associate cash/terminal checkout, Stripe Payment Links, payment state, refunds, and receipt data
  - Important fields include `checkout_type`, `checkout_provider`, `checkout_mode`, Stripe ids, totals, tax/discount/card/cash cents, customer fields, status, paid/refunded timestamps, and success URL
- `order_items`
  - Order line items linked to inventory items
  - Tracks quantity, unit/subtotal/tax/total cents, sale URL/category snapshot fields, and image/title snapshots
- `order_events`
  - Timeline/audit trail for order lifecycle changes, checkout creation, payment/refund events, and admin actions
- `receipt_templates`
  - Text templates used by WebPRNT/mPOP receipt printing for sale and refund receipts

The live D1 database is the source of truth for schema.

Inventory model notes:
- Primary inventory category is required.
- Secondary inventory category is optional.
- Package creation finds the first top-level category whose name matches `%package%`; if none exists, package creation fails.
- Shop/public category navigation comes from `ccg_inventory_categories`, not hardcoded demo categories.
- Public shop images should resolve from non-private rows in `ccg_inventory_item_images`.
- Admin inventory add/edit locks an already-populated `sale_url` slug by default; users can explicitly unlock it with the edit icon.
- When sale title is populated from empty and the slug is blank, admin auto-generates a slug from the title on blur.
- Barcode is optional and is used for exact-match scanner/search behavior.

D1 workflow rules:
- Schema changes are forward-only.
- Assume all prior schema changes have already been run in the live database.
- Do not add or keep migration history files, schema snapshots, or old SQL change logs in the repo.
- When a schema change is needed, provide a one-off D1 command or SQL script for the user to run manually.
- Standard pattern: `npx wrangler d1 execute listing_evaluator --remote --command="..."` from `workers/listing-evaluator/`.

## OpenAI
- Models: `gpt-4o` and `gpt-4o-mini` (see worker for task-specific usage)
- Up to `MAX_IMAGES` images (default 20 for inventory/custom flows)
- AI prompt includes:
  - "Asking price (from listing text): $X"
  - "Typical private‑party value: $X–$Y"
- Score computed in code (not from AI)

## KV
- KV namespace: `LISTING_JOBS`
- Maps `runId → D1 recordId`
- Scheduled handler exists in worker but is intentionally a no-op (radar/scheduled scraping removed).

## Secrets / Config (Cloudflare)
- `OPENAI_API_KEY`
- `APIFY_TOKEN`
- `WEBHOOK_SECRET`
- `AUTH_USER`
- `AUTH_PASS`
- `AUTH_SECRET`
Optional:
- `REVERB_API_TOKEN`
- `STRIPE_CO_SALES_TAX_RATE_ID` fallback only; D1 `sys_info` is the Stripe tax id source of truth once populated
- `STRIPE_TERMINAL_READER_ID`
- `STRIPE_TERMINAL_READER_ID_SANDBOX`
- `GOOGLE_MAPS_API_KEY`

## Decoder Pages
All public decoder pages are owned by `shop-app/`.

Layout:
- Shared decoder layout: `shop-app/src/layouts/decoder-layout/DecoderPreviewLayout.tsx`
- Decoder routes and page content: `shop-app/src/pages/decoders/`
- Brand config/content: `shop-app/src/pages/decoders/decoder-configs.json`
- Build sync script: `scripts/sync-shop-decoder-routes.mjs`

Build behavior:
- `npm --prefix shop-app run build` runs the Vite shop build.
- The shop app shell and hashed assets are emitted to `guitars-and-gear-for-sale/`.
- `scripts/sync-shop-decoder-routes.mjs` copies that app shell into `decoders/guitar-serial-decoder-lookup/index.html` and each `decoders/<brand>-guitar-serial-number-decoder/index.html`.
- The sync script injects route-specific title, description, canonical, Open Graph, Twitter, structured data, and hidden SEO snapshot content into each decoder route entry.

Legacy Nunjucks decoder `.html` output is no longer deployed. `/decoders/*.html` redirects to extensionless `/decoders/*`, and `/new/decoders/*` redirects to `/decoders/*`.

## Deployment
From `workers/listing-evaluator/`:
- `npx wrangler deploy`

From repo root:
- `npm run build`
  - Builds the legacy site only
- `npm run build:all`
  - Builds legacy static files, Admin V2, and Shop/decoder static output

Admin build:
- `npm run build:admin-v2`
  - Runs `npm --prefix admin-v2-app install` and `npm --prefix admin-v2-app run build:ccg`

Shop build:
- `npm run build:shop`
  - Runs `npm --prefix shop-app run build`

Verification defaults:
- Serial decoder logic: `npm run test:regressions`
- Worker/API surface: `npx wrangler deploy --dry-run` from `workers/listing-evaluator/`
- Static/root changes: `npm run build:legacy`
