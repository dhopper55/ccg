# Listing Evaluator Architecture

## Overview
The Listing Evaluator is a static site + Cloudflare Worker backend that:
1) Accepts Craigslist/Facebook Marketplace URLs for evaluation
2) Starts Apify scraper runs and processes webhooks
3) Calls OpenAI to summarize listings and estimate pricing
4) Writes results to D1 (SQLite) and exposes them via a listing results UI
5) Runs a “radar” job on a cron to queue new listings automatically
6) Protects `/api/*` with a simple username/password login (HttpOnly cookie)

## Front‑end
Pages:
- `listing-evaluator.html`
- `listing-evaluator-results.html`
- `listing-evaluator-item.html`
- `listing-radar.html`

Scripts:
- `src/listing-evaluator.ts` → `dist/listing-evaluator.js`
- `src/listing-evaluator-results.ts` → `dist/listing-evaluator-results.js`
- `src/listing-evaluator-item.ts` → `dist/listing-evaluator-item.js`
- `src/listing-radar.ts` → `dist/listing-radar.js`
- `src/listing-auth.ts` → shared login overlay for all listing pages

## Admin
The legacy admin lives under `/admin` and is independent from `/admin-v2`.

How it was built:
- Static multi-page HTML under `admin/`
- DOM-driven TypeScript in `src/` compiled into browser assets in `dist/`
- Shared styling primarily through `styles.css`
- Utility-first page-by-page tooling rather than a React/component-template app

This means the two admin surfaces are separate front-end applications:
- `/admin` is the original static admin
- `/admin-v2` is the newer Aurora-based admin app
- They can evolve independently
- New `/admin-v2` work should not require reshaping legacy `/admin`

## Admin V2
`/admin-v2` is a separate admin application and should be treated differently from the legacy `/admin` pages.

Layout:
- Source app: `admin-v2-app/`
- Deployed static output: `admin-v2/`
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
- Build new V2 pages using Aurora infrastructure first.
- Prefer adapting the closest Aurora page in `admin-v2-app/src/pages/` or section in `admin-v2-app/src/components/sections/`.
- Do not hand-compose new V2 dashboards or page layouts unless there is a clear reason.
- Keep legacy `/admin` intact. If V2 needs different backend payloads, add new endpoints for `/admin-v2` instead of changing the old `/admin` data model.

### Auth and backend
- Admin V2 uses the same worker auth model as legacy admin:
  - `POST /api/login`
  - `GET /api/session`
  - `POST /api/logout`
- Admin V2 can add its own endpoints under `/api/admin-v2/*` without changing legacy `/admin` behavior.

## Auth
The public site and the admin surfaces do not use the same access model.

- Public-facing pages on the main site are not gated by the admin login flow.
- `/admin` and `/admin-v2` are protected admin applications.
- Both admin applications use the same worker-backed admin session.

Shared admin login flow:
- `POST /api/login` with `{ username, password }`
- `GET /api/session` for session check
- `POST /api/logout` to clear the admin session

Implementation notes:
- Legacy `/admin` enforces auth through `src/listing-auth.ts` before allowing access to its admin pages.
- `/admin-v2` enforces auth inside its own app shell and route guards, but still uses the same worker-backed session endpoints.
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

- `GET /api/search-results`
  - Paged radar results
- `POST /api/search-results/:id/archive`
  - Archive a radar result
- `POST /api/search-results/:id/queue`
  - Queue a radar result for evaluation

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

- `POST /api/radar/run`
  - Manual radar run
- `POST /api/radar/classify`
  - Manual classify batch
- `POST /api/radar/sms-test`
  - Sends a Telnyx test SMS (if configured)

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
- Also stores radar scheduling metadata (last run, next run, summaries)

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
- `RADAR_FB_SEARCH_URL`
- `RADAR_CL_SEARCH_URL`
- `RADAR_KEYWORDS`
- `RADAR_AI_ENABLED`

## Deployment
From `workers/listing-evaluator/`:
- `npx wrangler deploy`

From repo root:
- `npm run build`
