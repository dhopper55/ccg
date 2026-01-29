# Listing Evaluator Setup

## 1) Create the Google Sheet
1. Create a new Google Sheet named `Listing Evaluator`.
2. In row 1, add these headers (A1:N1):
   - submitted_at
   - source
   - url
   - status
   - run_id
   - title
   - price
   - location
   - condition
   - description
   - photos
   - ai_summary
   - notes
   - last_updated
3. Copy the Sheet ID from the URL (between `/d/` and `/edit`).

## 2) Create a Google Service Account
1. Go to Google Cloud Console and create a new project (or use an existing one).
2. Enable the **Google Sheets API**.
3. Create a **Service Account**.
4. Create a JSON key for the service account and download it.
5. Share your Sheet with the service account email (Editor access).

## 3) Cloudflare Worker setup
Create a KV namespace for run tracking (LISTING_JOBS).

Example commands (run from `workers/listing-evaluator/`):

```bash
npx wrangler kv:namespace create LISTING_JOBS
npx wrangler kv:namespace create LISTING_JOBS --preview
```

Update `wrangler.toml` with the returned KV IDs and your Cloudflare `account_id` + `route`.

## 4) Add secrets
From `workers/listing-evaluator/`:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put APIFY_TOKEN
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put GOOGLE_SHEET_ID
```

Optional (recommended):

```bash
npx wrangler secret put WEBHOOK_SECRET
```

## 5) Deploy

```bash
npx wrangler deploy
```

## Notes
- The worker expects these env vars in `wrangler.toml`:
  - `APIFY_FACEBOOK_ACTOR = "apify/facebook-marketplace-scraper"`
  - `APIFY_CRAIGSLIST_ACTOR = "ivanvs/craigslist-scraper"`
  - `SITE_BASE_URL = "https://www.coalcreekguitars.com"`
  - `GOOGLE_SHEET_RANGE = "Listings!A1"`
  - `MAX_IMAGES = "3"`

- The Listing Evaluator page uses `/api/listings/submit` and expects the worker to be routed on the same domain.
