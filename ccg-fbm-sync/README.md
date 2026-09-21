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

Every run: logs into CCG and Facebook fresh, pulls current data from both, reconciles in memory, and walks you through each discrepancy one at a time — nothing writes, and nothing publishes, until you pick an option. Buckets:

- **To post** — CCG item is for sale, not linked to FB yet → drafts it for real on Facebook (photos, title, price, category = Musical Instruments, condition, description, all 3 meetup preferences checked — filled in through FB's actual "Item for sale" form) and saves it via **FB's own "Save draft"** (Marketplace > Create new listing > Drafts) — never publishes. Queue up several in one run and finish/publish each at your own pace. Or skip it once, or permanently (sets `fb_sync_state`, not exposed in admin — this tool is the only way to set/unset it).
- **Possible link** — an FB listing looks title-similar to an unlinked CCG item → asks before linking, never auto-links.
- **Stale FB link** — a CCG item's linked FB listing isn't live anymore → "sold on FB" (marks sold in CCG) / "removed" (clears the link) / "leave as-is".
- **Unrecognized FB listing** — no CCG match → "personal item, ignore going forward" (adds to `fb_ignore_list`, e.g. a lawnmower you list on FB only) or skip for now.
- **In sync** — reported in the end-of-run summary only, no action.

## Delete All mode — hard reset, irreversible on Facebook

```
./venv/bin/python delete_all.py
```

Ignores CCG entirely on the FB side: walks **every** currently active FB Marketplace listing (personal items included) and **permanently deletes** it — not "mark as sold," an actual delete, no recovery. Shows a full preview list first and requires typing `DELETE ALL` to proceed. Then, on the CCG side, clears `fb_listing_id` on every inventory item that has one (for-sale or not) and resets `fb_sync_state` back to null everywhere it was `"excluded"` — a true fresh start for `add_all.py` and the regular ongoing sync tool afterward.

Built 2026-09-20. Deletes by **title**, all copies at once, then rescans and repeats (up to 5 passes) until nothing is left — an item posted to Marketplace plus groups exists as several same-titled listings with different ids, and a deleted copy can reappear under a new id. Confirmed live on a single listing; the multi-copy/multi-pass version still needs a test on a group-posted item. Use `--listing-id <fb_id>` to scope a run to that listing's title (group copies included) and only the CCG item(s) linked to any of them.

## Add All mode — bulk re-list every for-sale CCG item

```
./venv/bin/python add_all.py
```

Meant to run right after `delete_all.py`. Assumes no listings currently exist on FBM (defensively skips any item that already has an `fb_listing_id`, so it's still safe to re-run). Walks every for-sale, unlinked CCG item one at a time: prints its unit cost, sale price, regular price, sales tax included, allow shipping, and shipping price; asks whether to list it; if yes, walks each editable field (unit cost excluded) with the current value pre-filled so Enter keeps it; saves the CCG record regardless of what happens next; then asks whether to draft it on Facebook now. Only **drafts** — same "never auto-publish" safety model as `approve.py`.

Built 2026-09-20. The shipping-cost fields in `fbm_client.create_draft_listing()`'s Delivery step are **not yet verified against a live listing** — it isn't confirmed Facebook's own form even supports an arbitrary fixed shipping price. Test before a real bulk run (see ARCHITECTURE.md). Use `--ccg-id <id or CCG-XXXXXX number>` to scope a run to exactly one CCG item for this kind of test.

## Status

- Match Mode: done and removed.
- Ongoing sync tool: built and confirmed working end-to-end against production, including drafting real listings on Facebook and saving them via FB's own Drafts feature (verified with a real CCG item — 8 photos, all fields, all 3 meetup checkboxes — landing correctly in FB's Drafts list, not published). `reconcile.py`'s bucket logic has 11 passing unit tests.
- Delete All / Add All: built 2026-09-20, CCG-side logic and Worker endpoints in place and typechecked/bundled clean; the new FB-side browser automations still need live test passes (delete: single-listing confirmed, multi-copy pending; shipping fields: untested) before a real bulk run.
