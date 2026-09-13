# CCG ↔ Facebook Marketplace Sync

Local, developer-run Python tool that reconciles Coal Creek Guitars inventory (CCG) against Facebook Marketplace listings. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design context.

Stateless — every run pulls fresh data from CCG and FBM, does all comparison in memory, and writes nothing back without explicit approval. Not deployed anywhere; runs only on a developer's machine. Blocked from public access via the site's `_redirects` rule.

## Setup

```
cp .env.example .env   # fill in CCG_USERNAME / CCG_PASSWORD
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python -m playwright install chromium   # one-time browser binary download
```

FBM reads drive a real Chromium browser (Playwright) — no FBM API exists, and the whole point is that you shouldn't have to manually copy/paste anything from Facebook. See ARCHITECTURE.md Section 6 for the ToS/bot-detection tradeoffs this accepts.

**First run only:** a visible browser window opens to `facebook.com/login` — log in there yourself, then press Enter in the terminal. The session is saved to `.fb_session.json` (gitignored — holds live Facebook auth, treat it like a password) and reused on every later run. Delete that file to force a fresh login.

## Match Mode — complete, removed 2026-09-13

One-time backfill of `fb_listing_id` on CCG items already live on Facebook Marketplace ran successfully: 120 items linked (verified directly in production D1), 4 left unmatched for manual follow-up, 0 ambiguous. `match_mode.py` and its test have been deleted per ARCHITECTURE.md Section 7's own cleanup checklist — it was explicitly one-time-use. See ARCHITECTURE.md Section 7 for the full history if this ever needs revisiting (e.g. re-backfilling after a data import).

## Ongoing sync — run this

```
./venv/bin/python approve.py
```

Every run: logs into CCG and Facebook fresh, pulls current data from both, reconciles in memory, and walks you through each discrepancy one at a time — nothing writes until you pick an option. Buckets:

- **To post** — CCG item is for sale, not linked to FB yet → shows a copy/paste-able draft (title, price, description, image URLs), since there's no FB publish API.
- **Possible link** — an FB listing looks title-similar to an unlinked CCG item → asks before linking, never auto-links.
- **Stale FB link** — a CCG item's linked FB listing isn't live anymore → "sold on FB" (marks sold in CCG) / "removed" (clears the link) / "leave as-is".
- **In sync** / **unrecognized FB listings** — reported in the end-of-run summary only, no action.

**Known limitation, decided 2026-09-13, not a bug:** there's no `fb_sync_state` ("mark CCG-only, stop asking") or `fb_ignore_list` (personal FB items) yet — both deferred to later. In practice this means anything you skip will be asked about again next run. See `reconcile.py`'s docstring.

## Status

- Match Mode: done and removed.
- Ongoing sync tool: built and confirmed working end-to-end against production, 2026-09-13 (526 CCG items, 154 live FB listings, 119 in sync, 9 unrecognized listings correctly flagged as non-inventory). `reconcile.py`'s bucket logic has 8 passing unit tests.
