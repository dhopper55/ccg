# Listing Evaluator Setup

## 1) Create the Airtable base + table
Create a base and a table (e.g., `Listings`) with these field names:

- submitted_at (date/time)
- source (single line text)
- url (single line text)
- status (single line text)
- title (single line text)
- price_asking (currency)
- location (single line text)
- description (long text)
- ai_summary (long text)
- price_private_party (single line text)
- price_ideal (currency)
- score (number)

Create a second table for radar search results (e.g., `SearchResults`) with these field names:

- run_id (single line text)
- run_started_at (date/time)
- source (single line text)
- keyword (single line text)
- url (single line text)
- title (single line text)
- price (currency)
- image_url (single line text)
- is_guitar (checkbox)
- is_sponsored (checkbox)
- archived (checkbox)
- ai_reason (long text)
- seen_at (date/time)
- ai_checked_at (date/time)

## 2) Get Airtable API values
- **Personal Access Token** (PAT)
- **Base ID**
- **Table name** (exact)
- **Search Results table name** (exact)

## 3) Add secrets
From `workers/listing-evaluator/`:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put APIFY_TOKEN
npx wrangler secret put AIRTABLE_API_KEY
npx wrangler secret put AIRTABLE_BASE_ID
npx wrangler secret put AIRTABLE_TABLE
npx wrangler secret put WEBHOOK_SECRET
```

`AIRTABLE_SEARCH_TABLE` can live in `wrangler.toml` under `[vars]` since it is not secret.

## 4) Deploy

```bash
npx wrangler deploy
```

## 5) Lock down the Listing Evaluator page (Cloudflare Access)
In Cloudflare Zero Trust, create a self-hosted Access application to protect the page:

- **App name:** Listing Evaluator
- **Session duration:** 24 hours
- **Public hostname:**
  - Subdomain: `www`
  - Domain: `coalcreekguitars.com`
  - Path: `/listing-evaluator*`
- **Policy (Allow):** include your email (or email domain)

Test in an incognito window at:
`https://www.coalcreekguitars.com/listing-evaluator`

## Notes
- The worker expects these env vars in `wrangler.toml`:
  - `APIFY_FACEBOOK_ACTOR = "apify/facebook-marketplace-scraper"`
  - `APIFY_CRAIGSLIST_ACTOR = "ivanvs/craigslist-scraper"`
  - `SITE_BASE_URL = "https://www.coalcreekguitars.com"`
  - `MAX_IMAGES = "10"`

- The Listing Evaluator page uses `/api/listings/submit` and expects the worker to be routed on the same domain.
