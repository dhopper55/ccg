# CCG ↔ Facebook Marketplace Sync

Local, developer-run Python tool that reconciles Coal Creek Guitars inventory (CCG) against Facebook Marketplace listings. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design context.

Stateless — every run pulls fresh data from CCG and FBM, does all comparison in memory, and writes nothing back without explicit approval. Not deployed anywhere; runs only on a developer's machine. Blocked from public access via the site's `_redirects` rule.

## Setup

```
cp .env.example .env   # fill in CCG_USERNAME / CCG_PASSWORD
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

## Match Mode (run this first)

One-time backfill of `fb_listing_id` on CCG items already live on Facebook Marketplace. See ARCHITECTURE.md Section 7.

```
./venv/bin/python match_mode.py            # dry run, prints the report only
./venv/bin/python match_mode.py --apply    # writes matches after a y/N confirmation
```

Delete `match_mode.py` (and `tests/test_match_mode.py`) once the backfill has run and been spot-checked against the live FB listings.

## Status

- Match Mode: built and ready to run (`ccg_client.py`, `fbm_client.py`, `match_mode.py`, tests passing).
- Normal-run tool (`reconcile.py`, `approve.py`): not yet built — depends on a `fb_sync_state` column and a new `fb_ignore_list` table/endpoints that don't exist yet. See ARCHITECTURE.md Section 9.
