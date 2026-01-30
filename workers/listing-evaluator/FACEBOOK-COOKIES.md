# Listing Evaluator Worker

## Refreshing Facebook Marketplace Cookies (Apify)
Facebook session cookies expire periodically. When Marketplace runs start failing or return empty data, refresh the cookies and update the actor input.

### 1) Export cookies from Facebook
1. Open Facebook in Chrome and log in.
2. Open any Marketplace listing page.
3. Open DevTools: **Right‑click → Inspect** (or press **F12**).
4. Go to the **Application** tab.
5. In the left sidebar, select **Cookies → https://www.facebook.com**.
6. Copy at least these cookies (name + value):
   - `c_user`
   - `xs`
   - `fr` (often required)

You can also use a browser extension like **EditThisCookie** to export the cookies as JSON.

### 2) Update the Apify actor input
1. Open the Apify **Facebook Marketplace Scraper** actor.
2. Go to the **Input** tab → **JSON** view.
3. Add or replace the `cookies` field like this:

```json
"cookies": [
  { "name": "c_user", "value": "...", "domain": ".facebook.com" },
  { "name": "xs", "value": "...", "domain": ".facebook.com" },
  { "name": "fr", "value": "...", "domain": ".facebook.com" }
]
```

4. Save and run a test listing to verify it returns title, description, price, and photos.

### 3) If runs still fail
- Log out and back into Facebook, then re‑export cookies.
- Make sure the actor input still contains `includeListingDetails: true`.

## Worker deployment
From this folder:

```bash
npx wrangler deploy
```
