# Listing Evaluator Architecture

## Overview
The Listing Evaluator is a static site + Cloudflare Worker backend that:
1) Accepts Craigslist/Facebook Marketplace URLs for evaluation
2) Starts Apify scraper runs and processes webhooks
3) Calls OpenAI to summarize listings and estimate pricing
4) Writes results to D1 (SQLite) and exposes them via a listing results UI
5) Protects `/api/*` with a simple username/password login (HttpOnly cookie)

## Admin
Admin is served from `/admin` and built from the Aurora-based app.

Layout:
- Source app: `admin-v2-app/`
- Deployed static output: `admin/`
- Build command from repo root: `npm run build:admin-v2`

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
- Do not hand-compose new dashboards or page layouts unless there is a clear reason.
- If admin needs different backend payloads, add endpoints under `/api/admin-v2/*` rather than changing legacy endpoint contracts.

### Auth and backend
- Admin uses the same worker auth model:
  - `POST /api/login`
  - `GET /api/session`
  - `POST /api/logout`
- Admin-specific endpoints live under `/api/admin-v2/*`.

## Auth
The public site and the admin surfaces do not use the same access model.

- Public-facing pages on the main site are not gated by the admin login flow.
- `/admin` is the protected admin application.

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

## Cloudflare Worker
- Location: `workers/listing-evaluator/src/index.ts`
- Wrangler config: `workers/listing-evaluator/wrangler.toml`

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

- `POST /api/listings/webhook`
  - Receives Apify webhook
  - Fetches dataset item
  - Normalizes fields
  - Calls OpenAI
  - Updates D1 record

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
- `GET /api/inventory/summary`
  - Legacy inventory summary totals

- `GET /api/admin-v2/dashboard/summary`
  - Dashboard KPI totals for Admin V2 home page
- `GET /api/admin-v2/dashboard/profit-trend`
  - Profit trend series for Admin V2 home page
- `GET /api/admin-v2/dashboard/inventory-aging`
  - Aging buckets for active unsold inventory
- `GET /api/admin-v2/dashboard/recent-sales`
  - Recent sold inventory rows for Admin V2
- `GET /api/admin-v2/dashboard/oldest-inventory`
  - Oldest active unsold inventory rows for Admin V2

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
Schema lives in `workers/listing-evaluator/schema.sql`.
Tables:
- `listings`
- `search_results`
- `ccg_inventory_items`
- `ccg_marketplace_listings`

## OpenAI
- Models: `gpt-4o` and `gpt-4o-mini` (see worker for task-specific usage)
- Up to `MAX_IMAGES` images (default 10)
- AI prompt includes:
  - "Asking price (from listing text): $X"
  - "Typical private‑party value: $X–$Y"
- Score computed in code (not from AI)

## KV
- KV namespace: `LISTING_JOBS`
- Maps `runId → D1 recordId`

## Secrets / Config (Cloudflare)
- `OPENAI_API_KEY`
- `APIFY_TOKEN`
- `WEBHOOK_SECRET`
- `AUTH_USER`
- `AUTH_PASS`
- `AUTH_SECRET`
Optional:
- `TELNYX_API_KEY`
- `TELNYX_FROM_NUMBER`
- `TELNYX_TO_NUMBER`

## Deployment
From `workers/listing-evaluator/`:
- `npx wrangler deploy`

From repo root:
- `npm run build`
