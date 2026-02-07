# Listing Evaluator Architecture

## Overview
The Listing Evaluator is a static site + Cloudflare Worker backend that:
1) Accepts Craigslist/Facebook Marketplace URLs for evaluation
2) Starts Apify scraper runs and processes webhooks
3) Calls OpenAI to summarize listings and estimate pricing
4) Writes results to Airtable and exposes them via a listing results UI
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

## Auth
- Login flow:
  - `POST /api/login` with `{ username, password }`
  - `GET /api/session` for session check
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
  - Writes queued record to Airtable
  - Stores runId → Airtable recordId in KV

- `POST /api/listings/webhook`
  - Receives Apify webhook
  - Fetches dataset item
  - Normalizes fields
  - Calls OpenAI
  - Updates Airtable record

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

## Airtable
### Listings table
Fields (exact names):
  - submitted_at
  - source
  - url
  - status
  - title
  - price_asking (currency)
  - location
  - description
  - ai_summary
  - price_private_party (text)
  - price_ideal (currency)
  - score (number)

- price_asking is derived from listing price or AI if edge case
- price_private_party parsed from AI summary
- price_ideal = 80% of low end of private‑party range
- score computed from asking vs private‑party range

### Search results table
Table name: `AIRTABLE_SEARCH_TABLE`
Stores radar results and archive state

## OpenAI
- Models: `gpt-4o` and `gpt-4o-mini` (see worker for task-specific usage)
- Up to `MAX_IMAGES` images (default 10)
- AI prompt includes:
  - "Asking price (from listing text): $X"
  - "Typical private‑party value: $X–$Y"
- Score computed in code (not from AI)

## KV
- KV namespace: `LISTING_JOBS`
- Maps `runId → Airtable recordId`
- Also stores radar scheduling metadata (last run, next run, summaries)

## Secrets / Config (Cloudflare)
- `OPENAI_API_KEY`
- `APIFY_TOKEN`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE`
- `AIRTABLE_SEARCH_TABLE`
- `WEBHOOK_SECRET`
- `AUTH_USER`
- `AUTH_PASS`
- `AUTH_SECRET`
Optional:
- `AIRTABLE_SYSINFO_TABLE`
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
