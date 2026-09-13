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

## Status

- Match Mode: done and removed.
- Normal-run tool (`reconcile.py`, `approve.py`): not yet built — depends on a `fb_sync_state` column and a new `fb_ignore_list` table/endpoints that don't exist yet. See ARCHITECTURE.md Section 9.
