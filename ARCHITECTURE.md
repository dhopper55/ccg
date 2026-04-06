# Listing Evaluator Architecture

## Overview
The repo now has three active surfaces plus one shared Cloudflare Worker backend:
1) Legacy static public site at the repo root
2) Admin V2 Aurora app served from `/admin`
3) Shop preview Aurora storefront served from `/shop-preview`
4) Cloudflare Worker backend that powers all `/api/*` routes

The Worker currently:
1) Accepts Craigslist/Facebook Marketplace URLs for evaluation
2) Starts Apify scraper runs and processes webhooks
3) Calls OpenAI to summarize listings and estimate pricing
4) Writes results to D1 (SQLite) and exposes them via listing/admin/shop APIs
5) Protects admin/private `/api/*` with a simple username/password login (HttpOnly cookie)
6) Receives serial decoder tracking events from public decoder pages and stores them in D1
7) Stores reusable serial-pattern metadata/content for decoder context rendering
8) Powers inventory, Admin V2, and shop preview product/category/image endpoints

Important decoder/deploy distinction:
- Public serial decoder pages are static frontend pages.
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
- Build command: `npm --prefix admin-v2-app run build:ccg`

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

## Shop Preview
There is now a separate Aurora-based storefront app that is intentionally isolated from the main public site navigation and sitemap.

Layout:
- Source app: `shop/`
- Deployed static preview output: `shop-preview/`
- Preview route: `/shop-preview`
- Build command: `npm --prefix shop run build`

Implementation notes:
- This is a standalone Aurora app, not a route inside Admin V2.
- It is public and not gated by admin auth.
- It currently uses public Worker endpoints under `/api/shop/*`.
- The current default route is Aurora’s customer products page adapted to Coal Creek inventory data.
- The shop UI should treat the Worker as the source of truth for category tree + product feed data.
- Current Worker contracts used by the shopping view:
  - `GET /api/shop/categories`
  - `GET /api/shop/products`
- Do not wire it into the main site nav/sitemap until explicitly requested.
- Keep storefront-specific Worker contracts under `/api/shop/*` so they stay clearly separated from Admin V2 and legacy admin contracts.

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
- `/shop-preview` is public.

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
- `/api/shop/*` (public shop preview endpoints)
- `/api/inventory-image` (public inventory image streaming for non-private inventory images)

## Cloudflare Worker
- Location: `workers/listing-evaluator/src/index.ts`
- Wrangler config: `workers/listing-evaluator/wrangler.toml`
- Route: `https://www.coalcreekguitars.com/api/*`

### Serial decoding flow
The serial decoder feature spans both the static site and the worker:

1. Decoder page UI
   - Static page JS in `src/main.ts`
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
- If you change decoder page markup, styling, or browser-side UX in `src/main.ts` / templates, deploy Pages.
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
  - Public product feed for shop preview
  - Supports categories, text search, sold toggle, price range, and condition filters
  - Category query params accepted by the Worker:
    - `categoryId`
    - `categoryIds`
    - `categories` (CSV)
  - Category filtering expands selected parent categories to include descendants
  - Category filtering matches when either the primary category (`category_id`) or secondary category (`secondary_category_id`) is in the expanded category set
  - Returns storefront-ready fields such as main image, title, listing URL, category labels, and prices

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
  - Primary category: `category_id` (`NOT NULL`)
  - Secondary category: `secondary_category_id` (`NULLABLE`)
  - Sale/detail fields include:
    - `video_url`
    - `sale_title`
    - `regular_price`
    - `sale_price`
    - `"condition"`
    - `sale_description`
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

The live D1 database is the source of truth for schema.

Inventory model notes:
- Primary inventory category is required.
- Secondary inventory category is optional.
- Package creation finds the first top-level category whose name matches `%package%`; if none exists, package creation fails.
- Shop/public category navigation comes from `ccg_inventory_categories`, not hardcoded demo categories.
- Public shop images should resolve from non-private rows in `ccg_inventory_item_images`.

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

## Decoder Page Templates (Nunjucks)
All 26 brand decoder HTML pages are generated from Nunjucks templates at build time.

Layout:
- Shared layout: `templates/layout.njk` — contains all boilerplate (head/meta/structured data, nav, input section, result section, FAQ section, footer, scripts)
- Brand templates: `templates/decoders/{brand}.njk` — each extends `layout.njk` and provides brand-specific variables and block content
- Build script: `scripts/build-templates.mjs` — compiles `.njk` → `.html` into `decoders/`
- Output map in build script maps template filenames to decoder HTML filenames (e.g. `gibson.njk` → `gibson-guitar-serial-number-decoder.html`)

Template variables (set per brand):
- `brand`, `brandName`, `brandLogo`, `brandLogoClass`, `decoderDate`
- `pageTitle`, `decoderTitle`, `metaDescription`, `ogDescription`, `pageSlug`
- `serialPlaceholder`, `faqTitle`, `h1Title` (optional override)
- `brandShortName`, `brandAltName` (optional, for structured data `alternateName`)
- `faqs` array with `question`, `answer`, optional `answerPlain` (for structured data when HTML answer has tags)

Template blocks (override per brand as needed):
- `brandDescription` — brand description paragraph
- `howtoModal` — how-to-decode modal dialog
- `beforeResult` — custom content between input and result (used by Ovation, B.C. Rich)
- `afterResult` — custom content between error section and FAQ
- `decoderNote` — decoder note with default "contact us" text (overridden by Charvel, Godin, Rickenbacker, Ovation)
- `afterContent` — related brand decoders, popular models sections
- `customScripts` — inline JS injected before footer year script (used by Ibanez for dynamic date)

Build pipeline: `tsc` → `build-templates.mjs` → `update-cache-busters.mjs`

The generated HTML files in `decoders/` are build output (like `dist/`). Edit the `.njk` source templates, not the HTML files directly.

## Deployment
From `workers/listing-evaluator/`:
- `npx wrangler deploy`

From repo root:
- `npm run build`
  - Builds the legacy site only

Admin build:
- `npm --prefix admin-v2-app run build:ccg`

Shop preview build:
- `npm --prefix shop run build`
