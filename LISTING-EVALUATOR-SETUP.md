# Listing Evaluator Setup

## 1) Create the D1 database (primary storage)
From `workers/listing-evaluator/`:

```bash
npx wrangler d1 create listing_evaluator
```

Copy the `database_id` into `workers/listing-evaluator/wrangler.toml` under `[[d1_databases]]`.

Apply schema:

```bash
npx wrangler d1 execute listing_evaluator --file workers/listing-evaluator/schema.sql
```

## 2) Add secrets
From `workers/listing-evaluator/`:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put APIFY_TOKEN
npx wrangler secret put WEBHOOK_SECRET
```

## 3) Deploy

```bash
npx wrangler deploy
```

## 4) Lock down the Listing Evaluator page (Cloudflare Access)
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
