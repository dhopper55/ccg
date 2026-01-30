# Listing Evaluator Architecture

## Overview
The Listing Evaluator is a static page + Cloudflare Worker pipeline that:
1) Accepts Craigslist/Facebook Marketplace URLs
2) Starts an Apify scraper run
3) Calls OpenAI to produce a valuation + score
4) Writes the results to Airtable

## Front‑end
- Page: `listing-evaluator.html`
- Script: `src/listing-evaluator.ts` → builds to `dist/listing-evaluator.js`
- POST endpoint: `/api/listings/submit`

## Cloudflare Worker
- Location: `workers/listing-evaluator/src/index.ts`
- Wrangler config: `workers/listing-evaluator/wrangler.toml`

### Endpoints
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
- Fields (exact names):
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

## OpenAI
- Model: `gpt-4o`
- Up to 10 images
- AI prompt includes:
  - "Asking price (from listing text): $X"
  - "Typical private‑party value: $X–$Y"
- Score computed in code (not from AI)

## KV
- KV namespace: `LISTING_JOBS`
- Maps `runId → Airtable recordId`

## Secrets (Cloudflare)
- `OPENAI_API_KEY`
- `APIFY_TOKEN`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE`
- `WEBHOOK_SECRET`

## Deployment
From `workers/listing-evaluator/`:
- `npx wrangler deploy`

From repo root:
- `npm run build`

