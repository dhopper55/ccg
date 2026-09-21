# CCG – Facebook Marketplace Sync Tool – Architecture & Design Handoff

**Prepared:** 2026-09-13
**Owner:** David, Coal Creek Guitars
**Purpose of this doc:** Full context handoff so a fresh Claude Code / VS Code session can pick up development with no prior conversation history. Everything below reflects decisions actually made; anything not yet decided is called out explicitly in "Open Questions."

---

## 1. What this tool is

A local, developer-run tool that reconciles inventory in **CCG** (David's internal system of record for Coal Creek Guitars inventory) against **Facebook Marketplace (FBM)** listings, so David can keep both in sync without manually cross-checking every item. It surfaces discrepancies in categorized buckets, asks for a decision on each one, and writes approved changes back to CCG.

It is explicitly **not** a fully automated sync — every write is human-approved, one item at a time. It is also explicitly **stateless** — see Section 3.

### Background / related research (for context, not part of this tool's scope)
Earlier research in this project looked at two other resale platforms:
- **Gear Exchange (Sweetwater)**: no public API. Has a CSV **Bulk Imports** tool (max 200 items/import) that creates *draft* listings only — publishing is still manual. The CSV template includes `product_image_1` through `product_image_25` columns, each taking a direct URL to a hosted image (no file upload support — images must already be hosted somewhere public).
- **OfferUp**: no public API for general sellers. Has a Shopify-sync integration under their paid "Storefronts" plan, and a separate Verified Dealer Program (auto-dealer-only, not applicable here). Unofficial/reverse-engineered APIs exist on GitHub/RapidAPI/Apify but are not sanctioned and carry ToS risk.

Neither is part of the current build — this doc is scoped to the **CCG ↔ FBM** tool only.

---

## 2. Core design principles

1. **CCG is the single system of record (SOR).** No other platform's data is ever trusted over CCG's. All durable state — item data, FB listing IDs, the personal-item ignore list, sync exclusions — lives in CCG. Nothing is persisted anywhere else.
2. **The local tool is stateless.** Every run is a fresh run. It has no local database, no cache file, no memory of previous runs. On each execution it pulls live data from CCG and from FBM, does all comparison in memory, and discards everything on exit. If you run it twice in a row, the second run rebuilds its full picture from scratch — it doesn't "remember" what the first run found.
3. **Every write requires explicit human approval.** The tool never silently changes CCG data. For every actionable discrepancy it finds, it presents the situation and a set of choices, and only acts on what David picks.
4. **Cross-platform by default.** Must run on David's MacBook Pro today, with no architectural blockers to running on Windows later.

---

## 3. Recommended tech stack

**Python**, run as a local script — not a persistent service, not an installed app.

Rationale:
- Identical behavior on macOS and Windows; no OS-specific frameworks involved.
- Naturally fits the stateless design: a script that runs top-to-bottom, holds everything in memory, and exits, with zero local disk footprint by default.
- Lightweight enough for a single-person internal tool — no need for a database, server process, or packaging/installer.

**Suggested structure:**
- `ccg_client.py` — thin HTTP client wrapping CCG's API (reads items, writes fb_listing_id, reads/writes the ignore list, marks items sold, etc.)
- `fbm_client.py` — gets current FBM active/available listings (see Section 6 on *how*)
- `reconcile.py` — pure functions implementing the bucket logic (Section 5). Deliberately has no I/O, so it's trivially unit-testable.
- `approve.py` — the interactive CLI loop that presents each bucket item and captures David's decision (entry point for normal runs)
- `match_mode.py` — **temporary, throwaway** one-time bootstrap script (Section 7). Delete after use.
- `tests/` — unit tests for `reconcile.py`'s bucket logic, since that's the part most worth protecting from regressions

For the approval UX, use a library like `questionary` or `rich` for clean multiple-choice prompts instead of raw `input()`. If a nicer point-and-click UI is wanted later, wrap the same `reconcile.py` logic in a tiny local FastAPI server + one HTML page — still stateless (in-memory only, per run), still cross-platform, no changes needed to the core logic layer.

Portability note: avoid hardcoded Mac-style paths anywhere; use `pathlib` if the script ever touches the filesystem (it mostly shouldn't, per the statelessness requirement). Everything else — HTTP calls, comparison logic, CLI prompts — is identical on Windows.

---

## 4. CCG data model additions needed

**Decided (2026-09-13), based on inspecting the actual Worker/D1 schema:**

| Field | On | Purpose |
|---|---|---|
| `fb_listing_id` | `inventory` row | The linked Facebook Marketplace listing ID. Null = not yet linked. **Mirrors the existing `reverb_listing_id` column** (same table, same pattern — Reverb is already tracked this way for the same reason). Add via a `d1-add-*.sql` migration at repo root, matching existing convention (e.g. `d1-add-inventory-tag-reprint.sql`). |
| `fb_sync_state` | `inventory` row | Optional flag, e.g. `"excluded"` — marks an item as intentionally CCG-only, so the tool stops asking about it every run. No existing equivalent; net-new column. |
| Ignore list (new table, e.g. `fb_ignore_list`) | CCG D1 | Stores FB listing IDs that are **not** CCG inventory at all (personal items David lists on FB only). Keyed by `fb_listing_id`, with an optional note and timestamp. Lives in CCG because CCG is the SOR — FB has no way to represent "this will never be inventory." |

**`marked_for_fbm` is NOT needed** — the inventory table already has a `sales_channel_fbm` boolean tracking "this item is on Facebook Marketplace," which is exactly what Match Mode's precondition (Section 7) needs. Confirmed reliably maintained today, so Match Mode reads `sales_channel_fbm = 1` directly instead of adding then dropping a temporary column. This removes one migration and one cleanup step from Section 7's plan.

Other existing, relevant `inventory` fields worth knowing before writing `ccg_client.py`: `ccg_number`, `title`, `brand`, `model`, `for_sale`, `is_sold`, `sold_date`, `sold_amount`, `regular_price`/`sale_price`, `quantity`, plus the other `sales_channel_*` booleans (cl, reverb, gear_exchange, offerup, ebay, nextdoor, other). Booleans are stored as 0/1, not real booleans.

### CCG API endpoints — built and deployed (2026-09-13, revised same day)

- `GET /api/inventory` — existing endpoint (`handleInventoryList`). No server-side filter for `for_sale`/"`fb_listing_id` is null" — `ccg_client.py` pages through everything (`active=all`) and filters client-side. Response: `{records, page, limit, total, totalPages, availableBrands}`.
- `POST /api/inventory/:id/fb-add` — mirrors the existing `reverb-add` pattern but simpler: Facebook has no public API to create a listing, so this just validates + persists the caller-supplied id (body: `{fbListingId: string}`), and 400s if the item is already linked. Handler: `handleInventoryFbAdd` in `workers/listing-evaluator/src/inventory/crud2.ts`.
- `POST /api/inventory/:id/fb-remove` — mirrors `reverb-remove`, no body needed, clears `fb_listing_id`. Handler: `handleInventoryFbRemove`, same file.
- `POST /api/inventory/:id/fb-mark-sold` — added later the same day for the ongoing sync tool's `stale_fb_id` bucket (Section 5). Body: `{sellNotes?: string}`. Sets `is_sold = 1`, `sold_channel = 'Facebook Marketplace'`, `for_sale = 0`, `queue = 'Sold'`, zeroes all `sales_channel_*` flags, clears `fb_listing_id`. Handler: `handleInventoryFbMarkSold`; DB layer: `dbMarkInventorySoldFromFbm` (mirrors `dbMarkInventorySoldFromReverb`'s exact pattern, including clearing the channel-specific listing id on sale).
- `fb-add`/`fb-remove` call `dbSetInventoryFbListingId` (`workers/listing-evaluator/src/inventory/db-write.ts`) — a single `UPDATE ccg_inventory_items SET fb_listing_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?` (originally also toggled `sales_channel_fbm`; that stopped once the column was dropped, see below).
- The general item-update endpoint (`handleInventoryUpdate` / `POST /api/inventory/:id/update`, the one the admin edit form's Save button calls) now also reads and persists `fbListingId` as a plain field — added specifically so the admin UI's "FBM Listing ID" textbox works (see below), not just the sync tool's dedicated endpoints.
- Routes wired in `workers/listing-evaluator/src/index.ts` next to the `reverb-add`/`reverb-remove` blocks. Deployed via `npx wrangler deploy` from `workers/listing-evaluator/`.
- `fb_ignore_list` table + its CRUD endpoints — still net new, not yet built. Deliberately deferred (see Section 9), needed for the ongoing tool's `unknown_fbm` bucket to stop re-asking about the same personal FB listings every run.

**Revision later the same day (2026-09-13) — `sales_channel_fbm` removed entirely.** David decided the boolean flag was redundant now that `fb_listing_id` exists — presence/absence of the id is the sole source of truth for "is this on FBM." Changes:
- D1: `ALTER TABLE ccg_inventory_items DROP COLUMN sales_channel_fbm` (confirmed live; table went from 100 → 99 columns, freeing back the headroom the original `fb_listing_id` addition had used up).
- Worker: removed from every SELECT, row mapper, create/update/reverb-split/mark-sold path across `crud.ts`, `crud2.ts`, `db-write.ts`, `db-core.ts`, `reverb-sync.ts`, `types/inventory.ts`.
- Admin UI (`admin-v2-app`): removed the "FBM" checkbox from the item edit form's "Active sales channels" section, replaced with a "FBM Listing ID" text field bound directly to `fbListingId`; the two list-view FB badges (`InventoryManager.tsx`) now key off `record.fbListingId` truthiness instead of the old boolean. Production build (`npm run build:ccg`) succeeded clean.
- `ccg_client.py`: removed the now-dead `get_items_for_match_mode()` method, which referenced the deleted field (`match_mode.py` itself was already gone by this point).

None of these need to be fancy — this is an internal tool talking to David's own system.

### Auth (decided 2026-09-13)

CCG's Worker has no API-key/service-token mechanism — the only auth path is `POST /api/login` (username/password → HMAC-signed session cookie via `requireAuth()` in `workers/listing-evaluator/src/auth/middleware.ts`), used today by the browser admin app.

**Decision: the CLI logs in fresh at the start of every run.** `ccg_client.py` calls `POST /api/login` with credentials read from a local, gitignored `.env` (never committed — see `ccg-fbm-sync/.gitignore`), holds the returned session cookie in memory for that run only, and discards it on exit. No changes to the Worker's auth code. This matches the tool's stateless design principle directly, rather than fighting it with a new persistent-credential scheme.

---

## 5. Reconciliation logic (the "normal run" tool)

**Built and confirmed working end-to-end against production, 2026-09-13** (`reconcile.py` + `approve.py`) — but scoped down from the original 7-bucket design below. Buckets 2 and 4 (below) depended on `fb_sync_state` and the `fb_ignore_list`, and both were explicitly deferred (decided 2026-09-13, "not for now, will add later"). The actual shipped bucket set is:

1. **`to_post`** — CCG for-sale, no `fb_listing_id`, no plausible FB match either. (Merges old buckets 1+2 minus the exclusion mechanism — *every* such item is a candidate every run, there's no way yet to say "stop asking about this one.")
2. **`in_sync`** — CCG item's `fb_listing_id` matches a live FB listing. No action.
3. **`possible_link`** — an FB listing title-matches an unlinked `to_post` candidate. Asks before linking; a matched CCG item is removed from `to_post` for that run.
4. **`unknown_fbm`** — an FB listing with no CCG match and no plausible link. (Old bucket 6, minus the ignore-list — reported in the summary every run, no persistent "personal item" marking yet.)
5. **`stale_fb_id`** — a CCG item's `fb_listing_id` isn't among FB's current live listings. Asks: sold on FB (marks sold via the new `/fb-mark-sold` endpoint) / removed (clears the link via `/fb-remove`) / leave as-is.

Confirmed live run: 526 CCG items, 154 live FB listings, 119 in sync, 9 correctly flagged as `unknown_fbm` (all genuinely non-inventory: a "we buy guitars" business-page listing, a neon sign, amp/monitor items not tracked in CCG, etc. — no false positives). `to_post`/`possible_link`/`stale_fb_id` were all empty on that run (everything already reconciled by Match Mode), so those paths are unit-tested (`tests/test_reconcile.py`, 8 passing) but not yet exercised against a real discrepancy live — worth a closer look the first time one actually shows up.

The original 7-bucket pseudocode below is kept for historical context (and in case `fb_sync_state`/`fb_ignore_list` get built later, restoring buckets 2 and 4) — it does not reflect what's actually running.

### Pseudocode — reconciliation pass (pure, no writes) — historical, see above for what's actually implemented

```python
def reconcile():
    ccg_items = CCG.get_items(status="for_sale", checkbox=True)
    ignored_fb_ids = CCG.get_ignored_fb_listing_ids()

    bucket1_to_post = []
    bucket2_excluded = []
    fb_id_lookup = {}  # fb_listing_id -> ccg_item

    for item in ccg_items:
        if item.fb_listing_id:
            fb_id_lookup[item.fb_listing_id] = item
        elif item.fb_sync_state == "excluded":
            bucket2_excluded.append(item)
        else:
            bucket1_to_post.append(item)

    fb_listings = FBM.get_active_available_listings()

    bucket3_in_sync = []
    bucket4_ignored = []
    bucket5_possible = []
    bucket6_unknown = []

    for listing in fb_listings:
        if listing.id in fb_id_lookup:
            ccg_item = fb_id_lookup.pop(listing.id)
            bucket3_in_sync.append((ccg_item, listing))
        elif listing.id in ignored_fb_ids:
            bucket4_ignored.append(listing)
        else:
            candidate = fuzzy_match(listing, bucket1_to_post)  # title/price similarity
            if candidate:
                bucket5_possible.append((candidate, listing))
            else:
                bucket6_unknown.append(listing)

    bucket7_stale_fb_id = list(fb_id_lookup.values())  # leftover = unconfirmed on FB

    return locals()
```

### Pseudocode — approval pass (every write requires a yes)

```python
def run_sync():
    b = reconcile()

    for item in b.bucket1_to_post:
        choice = ask(item, options=["Post to FB", "Mark CCG-only (stop asking)", "Skip for now"])
        if choice == "Post to FB":
            queue_fb_listing_draft(item)  # prepares title/price/photos; David still publishes manually
        if choice == "Mark CCG-only":
            CCG.set_fb_sync_state(item, "excluded")

    for (candidate, listing) in b.bucket5_possible:
        choice = ask(listing, candidate, options=["Link to this CCG item", "Not the same — it's personal", "Skip"])
        if choice == "Link to this CCG item":
            CCG.set_fb_listing_id(candidate, listing.id)
        if choice == "Not the same — it's personal":
            CCG.add_ignored_fb_listing(listing.id)

    for listing in b.bucket6_unknown:
        choice = ask(listing, options=["Personal item — ignore going forward", "Add as new CCG item", "Skip"])
        if choice == "Personal item":
            CCG.add_ignored_fb_listing(listing.id, note="personal")
        if choice == "Add as new CCG item":
            new_item = CCG.create_item_from_fb_listing(listing)
            CCG.set_fb_listing_id(new_item, listing.id)

    for item in b.bucket7_stale_fb_id:
        choice = ask(item, options=["Sold on FB — mark sold in CCG", "Listing removed/expired — clear FB id", "Leave as-is"])
        if choice == "Sold on FB":
            CCG.mark_sold(item, via="Facebook Marketplace")
        if choice == "Listing removed":
            CCG.clear_fb_listing_id(item)

    show_summary(in_sync=b.bucket3_in_sync, ccg_only=b.bucket2_excluded, ignored=b.bucket4_ignored)
```

---

## 6. How the tool reads FBM data

Facebook does not offer a public API for an individual seller to read their own Marketplace listings. Two options were considered:

- **Manual paste**: the tool prompts David to paste in current FB listing IDs/titles at the start of each run. Zero ToS risk, but tedious past a handful of items — with 129 Match Mode candidates, retyping every id/title by hand isn't realistic.
- **Browser automation (Playwright)**: drives a real logged-in browser session to read David's own Marketplace listings page. Works identically on Mac and Windows.

**Decided 2026-09-13 (superseding the earlier manual-paste-first plan): Playwright automation.** The whole point of the tool is that David shouldn't have to manually interact with FBM at all — the tool itself connects and reads listings. This is a deliberate, informed choice, not an oversight, of two real risks:

1. **ToS risk** — this is against Facebook's automation/bot terms even for read-only access to your own account. Known and accepted, not a formality.
2. **Bot-detection / reliability risk** — separate from the ToS question: Facebook is known to challenge or block plain headless browser automation outright. `fbm_client.py` runs Chromium headed (a real visible window) on every run, not just for the first login, specifically to reduce this risk — but it may still get challenged, rate-limited, or blocked, and that's a live-usage risk to watch for, not something solved in code.

**Implementation notes (`fbm_client.py`) — verified working live, 2026-09-13, all 155 real listings retrieved:**
- First run only: opens a visible browser to `facebook.com/login` and waits for David to log in by hand (sidesteps 2FA/captcha entirely — the tool never sees his password). Session cookies are saved to `.fb_session.json` (gitignored — this file holds live Facebook auth and must be treated like a password, never committed).
- Every run: reuses that saved session, navigates to `facebook.com/marketplace/you/selling`, switches the page's own **"Grid view" toggle** (default is "List view"), then repeatedly scrolls + clicks the **"Load N more"** button (Facebook paginates ~25 at a time; the button's exact label includes the count, e.g. "Load 25 more", not literally "Load more"), harvesting `{id, title}` from `<a href="/marketplace/item/<id>/...">` anchors after every click.
- Two dead ends hit along the way, kept here so a future session doesn't repeat them: (1) "List view" (the default) renders row titles as non-link `role="button"` divs with no href, and only the *first* ~10 rows carry an embedded JSON preload blob usable as a data-extraction shortcut — anything loaded via "Load more" lives only in client-side JS state and never appears in the page's HTML, so a JSON-scraping approach silently caps out around 10 regardless of how many times "Load more" is clicked. (2) The exact-text regex for the load-more button required literally "load more", which never matched "Load 25 more".
- Delete `.fb_session.json` to force a fresh login (e.g. if Facebook logs the session out, or David wants to rotate it).

---

## 7. Match Mode — one-time bootstrap tool (THROWAWAY, delete after use)

### Purpose
Before the normal sync tool is useful, existing CCG items that are *already* live on FB need their `fb_listing_id` backfilled. Rather than doing this by hand for every item, Match Mode does it once, automatically, using exact title matching, then gets deleted.

### Precondition (revised 2026-09-13)

~~CCG gets a new boolean column `marked_for_fbm`~~ — **not needed.** The existing `sales_channel_fbm` boolean on the `inventory` row already means "this item is intended/known to be listed on FBM," confirmed reliably maintained today. Match Mode uses that column directly instead of adding a temporary one.

### Logic

1. Pull all current FBM active listings (title, id).
2. Pull all CCG items where `for_sale = 1`, `sales_channel_fbm = 1`, and `fb_listing_id` is still null.
3. Group both sets by exact title string.
4. For a given title: if there is **exactly one** CCG candidate and **exactly one** FBM listing sharing that title, it's a clean match — set `fb_listing_id` on that CCG item and save.
5. If a title has more than one CCG item, more than one FBM listing, or both, **do not guess** — flag it as ambiguous for manual review rather than risk a wrong link. (Two items with genuinely identical titles are plausible in a guitar shop — e.g. two of the same pedal — so silent auto-pick on ambiguity is a real risk, not a theoretical one.)
6. If a CCG candidate's title doesn't appear among current FBM listings at all, leave it unmatched for manual follow-up.
7. Print a report of what matched, what was ambiguous, and what was unmatched, so results can be spot-checked before trusting them.

### Pseudocode

```python
def run_match_mode():
    fbm_listings = FBM.get_active_listings()  # [{id, title}]
    ccg_candidates = CCG.get_items(for_sale=True, sales_channel_fbm=True, fb_listing_id=None)

    fbm_by_title = group_by(fbm_listings, key=lambda l: l.title)
    ccg_by_title = group_by(ccg_candidates, key=lambda i: i.title)

    matched, ambiguous, unmatched = [], [], []

    for title, ccg_group in ccg_by_title.items():
        fbm_group = fbm_by_title.get(title, [])
        if len(ccg_group) == 1 and len(fbm_group) == 1:
            CCG.set_fb_listing_id(ccg_group[0], fbm_group[0].id)
            matched.append((ccg_group[0], fbm_group[0]))
        elif len(fbm_group) == 0:
            unmatched.extend(ccg_group)
        else:
            ambiguous.append((title, ccg_group, fbm_group))

    print_report(matched, ambiguous, unmatched)
```

### Cleanup checklist (do this once Match Mode has served its purpose)
1. Run `match_mode.py`, review the printed report.
2. Spot-check a sample of the auto-matched items directly against the live FB listings to confirm correctness.
3. Manually resolve anything left in `ambiguous` or `unmatched`.
4. ~~Drop the `marked_for_fbm` boolean column~~ — n/a, no such column was added (see Section 7 Precondition).
5. Delete `match_mode.py` (and any tests referencing it) from the repo entirely — it is not part of the ongoing architecture.

---

## 8. Repo layout

This tool lives in its own top-level directory inside the `ccg` repo, `ccg-fbm-sync/`, deliberately isolated from the rest of the site:

```
ccg/
├── ccg-fbm-sync/
│   ├── README.md
│   ├── ARCHITECTURE.md      <- this document
│   ├── requirements.txt
│   ├── .env.example         <- copy to .env and fill in; .env itself is gitignored
│   ├── .gitignore           <- .env, venv/, __pycache__/, .pytest_cache/ — never committed, never deployed
│   ├── ccg_client.py
│   ├── fbm_client.py        <- Playwright browser automation (Section 6)
│   ├── reconcile.py         <- pure bucket logic, 8 passing tests (Section 5)
│   ├── approve.py           <- interactive CLI entry point — run this for the ongoing sync
│   ├── .fb_session.json     <- gitignored; live Facebook session cookies, created on first run
│   ├── (match_mode.py deleted 2026-09-13 — one-time backfill, done and verified, see Section 7)
│   └── tests/
│       └── test_reconcile.py
├── _redirects               <- has a rule blocking /ccg-fbm-sync/* from being served publicly
└── ... (rest of the site)
```

**Why isolated, and what that means concretely:** the `ccg` repo root is the Cloudflare Pages deploy source (index.html, _redirects, _headers, functions/ all live at top level with no separate build-output folder for the main static site). That means anything at repo root ships as part of the live site's static assets unless explicitly blocked. This tool is a local, developer-run Python CLI with no relationship to the site's runtime — it doesn't get built, doesn't get served, and must never expose its future CCG API credentials publicly. Two guardrails enforce that:
1. A `_redirects` rule (`/ccg-fbm-sync/* / 404`) blocks the path from ever resolving publicly, regardless of what's deployed underneath it.
2. Its own `.gitignore` keeps `.env` / credentials / venv out of git entirely, so nothing sensitive is ever committed, let alone deployed.

---

## 9. Decision status

**Resolved (2026-09-13):**
- ~~CCG auth mechanism~~ — decided: log in via `POST /api/login` fresh each run, hold the session cookie in memory only (Section 4).
- ~~`marked_for_fbm` column~~ — decided: not needed, reuse existing `sales_channel_fbm` (Sections 4 & 7).
- ~~Manual paste vs. Playwright for FBM reads~~ — decided (then revised 2026-09-13): Playwright browser automation, so David never manually interacts with FBM at all (Section 6). Reconcile/approve logic is unaffected either way — only `fbm_client.py` changes.

**Resolved (2026-09-13) — Match Mode ran, backfilled, and was removed:**
- `fb_listing_id` column live in production D1 (`ccg_inventory_items.fb_listing_id TEXT`, nullable).
- `fb-add`/`fb-remove` Worker endpoints built, typechecked, and deployed (see Section 4).
- `ccg_client.py`, `fbm_client.py` (Playwright browser automation — see Section 6), and `match_mode.py` were built and confirmed working end-to-end against production: all 155 live FB listings retrieved reliably. Match Mode grouped by `saleTitle` (falling back to `title`), mirroring what Reverb's own listing flow uses, since that's the text that would actually have been posted to FB.
- Final live `--apply` run: 120 items linked (verified directly in D1: `SELECT COUNT(*) FROM ccg_inventory_items WHERE fb_listing_id IS NOT NULL` returned 120), 4 left unmatched for manual follow-up, 0 ambiguous.
- `match_mode.py` and `tests/test_match_mode.py` deleted per this section's own cleanup checklist — it was explicitly one-time-use.

**Decided 2026-09-13, revising Section 4 — `sales_channel_fbm` is being removed entirely.** Reusing it (instead of the originally-proposed temporary `marked_for_fbm` column) was the right call for Match Mode's one-time precondition, but keeping it as an ongoing "is this on FBM" flag is now considered redundant and a source of drift: `fb_listing_id` presence/absence is the actual source of truth going forward — a boolean that can fall out of sync with the real linked-id field serves no purpose once the id field exists. This means:
- Drop the `sales_channel_fbm` column from `ccg_inventory_items` (D1 migration).
- Remove all Worker code reading/writing/mapping it (SELECTs, `dbSetInventoryFbListingId` no longer toggles it, any other reference).
- Admin UI: remove the FBM checkbox from the item edit form entirely; add a plain text input for "FBM Listing ID" bound directly to `fbListingId`, so it's manually editable in the general edit form too, not only through `fb-add`/`fb-remove`. This requires extending `handleInventoryUpdate` (the full-record save endpoint) to also persist `fbListingId`, since today it's only settable via the dedicated `fb-add`/`fb-remove` routes.

**Resolved (2026-09-13) — the ongoing sync tool is built, scoped down, and confirmed working:**
- `reconcile.py` (pure, 8 passing tests) + `approve.py` (interactive CLI) written and run successfully against production. See Section 5 for the actual (reduced) bucket set and live-run numbers.
- New Worker endpoint `POST /api/inventory/:id/fb-mark-sold` added (mirrors `dbMarkInventorySoldFromReverb`'s pattern via a new `dbMarkInventorySoldFromFbm`), for the `stale_fb_id` bucket's "sold on FB" choice — sets `is_sold`, `sold_channel = 'Facebook Marketplace'`, clears `fb_listing_id`, zeroes sales-channel flags. Deployed.

**Resolved, revising the two items above (2026-09-13, same day) — David asked for both after all:**
- `fb_sync_state` column: built (`ccg_inventory_items.fb_sync_state TEXT`, live in D1). Set via a new `POST /api/inventory/:id/fb-exclude` endpoint (`handleInventoryFbExclude` / `dbSetInventoryFbSyncState`) — deliberately **not** exposed in the admin UI; `approve.py`'s `to_post` prompt's "Skip permanently" choice is the only way to set it. `reconcile.py` filters it out of `to_post` entirely.
- `fb_ignore_list` table: built (`fb_listing_id TEXT PRIMARY KEY, note, created_at`), with `GET`/`POST /api/fb-ignore-list` (new file `workers/listing-evaluator/src/inventory/fb-ignore-list.ts`). `approve.py`'s `unknown_fbm` prompt's "Personal item — ignore" choice adds to it; `reconcile.py` filters ignored ids out before bucketing.
- What counts as a "title match" for the *ongoing* fuzzy-match in bucket 5 (possible-link) — likely looser than Match Mode's exact-match rule, since Match Mode intentionally uses strict exact-match-only to stay safe for a one-time bulk operation. Low-stakes; defer until there's real data to tune against.

**Resolved, `queue_fb_listing_draft()` (2026-09-13) — went well beyond a printed text block, and went through several real iterations to get right:**
- `fbm_client.create_draft_listing()` drives Facebook's actual "Item for sale" create form: photos downloaded from CCG and uploaded, title, price, category fixed at "Musical Instruments", condition mapped from CCG's condition text to FB's four fixed options, description, then the Delivery step's 3 meetup preferences (Public meetup / Door pickup / Door dropoff) all checked, then **FB's own "Save draft"** — confirmed via the "Draft saved successfully" toast and the draft appearing in Facebook's own Drafts list (Marketplace > Create new listing > Drafts). Never clicks Publish. This lets several drafts get queued in one run and finished/published later at David's own pace, independent of any browser tab staying open.
- **First version left the tab open on the final Publish screen instead of saving.** David closed the window to look at it more closely and the draft was gone — nothing had actually persisted anywhere. Switched to clicking FB's own "Save draft" instead, which is a real server-side save.
- **Meetup-preference checkboxes aren't real `<input type=checkbox>` elements** — only the unrelated "Set shipping & local pickup as default" toggle above them is. They're plain divs with no checkbox/ARIA role at all; clicking each row's own label text (`page.get_by_text(label, exact=True).click()`) is what actually toggles them (confirmed via the listing preview panel updating).
- **A debugging side effect corrupted the account's own delivery default**: an earlier broken attempt at "find any unlabeled checkbox" accidentally checked "Set shipping & local pickup as default" instead of the real meetup checkboxes. Facebook persisted that as an actual account-level preference — every subsequent new listing defaulted to "Shipping & local pickup" instead of "Local pickup," which *replaces* the whole Meetup preferences section with a "Shipping label" section. This looked exactly like Facebook's UI being randomly inconsistent between loads (echoes the two dead-end FBM-scraping approaches from Section 6) until the actual cause was found and fixed by explicitly unchecking that toggle again. Worth remembering: if a future session sees this section missing again, check this toggle before assuming Facebook changed something.
- **Save-confirmation false negative**: the "Draft saved successfully" toast is transient and a fixed ~2.5s wait wasn't always enough to catch it — with 8 real photos it reported "not saved" on a save that had actually worked (confirmed two duplicate drafts sitting in FB's Drafts from these runs, both deleted afterward). Fixed by polling the URL for up to 10s instead (a successful save redirects away from the create-item form back to the listing-type hub, `.../marketplace/create` with no `step=` param) — more durable than a disappearing toast.
- Notable implementation detail, still true: this create form's fields (Title, Price, Category, Condition, Description) have **no aria-labels at all** — unlike every other FB Marketplace page dealt with so far. They're matched purely by DOM position (`input[type=text]` 0/1 for Title/Price, `[role=combobox]` 1/2 for Category/Condition — position 0 is FB's global search box, easy to grab by mistake). If this ever breaks, suspect a form re-order before suspecting the matching logic.

**Resolved (2026-09-13) — draft photos looked "dull and pixelated" compared to David's own manual save-then-upload workflow.** Root cause confirmed, not guessed: every CCG inventory photo is stored as an iPhone **MPO** file (a multi-frame JPEG container from Portrait mode), not a plain JPEG — verified with Pillow on 3 different stored photos, all `format: MPO`, `n_frames: 2`. Frame 0 is the true full-resolution photo (e.g. 5281×3961 RGB); frame 1 is a much smaller **grayscale depth map** (e.g. 2640×1980, mode `"L"`) used for the bokeh effect — not a real photo at all. `/api/inventory-image` itself does no resizing (confirmed: serves the R2 object byte-for-byte, no `cf-polish`/resize headers), so the raw bytes handed to the upload pipeline were the unmodified MPO file — something downstream (very likely Facebook's own upload/preview handling, since it isn't built to expect a non-standard multi-frame container) was almost certainly reading the depth-map frame instead of the photo. Fixed in `_download_images` (`fbm_client.py`): decode with Pillow, explicitly `.seek(0)` to the primary frame, convert to RGB, and re-save as a clean single-frame JPEG (quality 95) before handing it to Facebook — removes the ambiguity entirely rather than hoping the receiving end picks the right frame. New dependency: `Pillow`.

---

## 10. Delete All / Add All — hard-reset bulk modes (built 2026-09-20)

David started actually shipping FBM sales and found enough CCG/FBM drift (stale links,
listings the ongoing tool never fully reconciled) to want a hard reset instead of continuing
to reconcile incrementally: wipe every FB listing and every CCG `fb_listing_id`, then
deliberately re-list every for-sale CCG item from scratch, reviewing/editing price and
shipping per item. Two new scripts, independent of `approve.py`/`reconcile.py`, which are
untouched and still the tool to run for ongoing (non-reset) sync.

**`delete_all.py`:**
- FB side: `fbm_client.get_active_listings()` (unchanged, reused as-is) enumerates every
  active listing — **all of them, including David's personal items** (his own call: he'll
  re-add those by hand rather than have the tool special-case an ignore list on a one-time
  reset). Prints the full list, requires typing `DELETE ALL` exactly, then calls the new
  `fbm_client.delete_rows_with_title()` per title — a **permanent delete**, not "mark as sold"
  (David's explicit choice — irreversible, no recovery). Continues past individual failures
  and reports them at the end rather than aborting the run.
- CCG side: loops every inventory item (`for_sale` or not, per spec) via
  `client.get_all_inventory()`; clears `fb_listing_id` (existing `fb-remove` endpoint,
  looped — no bulk endpoint needed, `dbSetInventoryFbListingId` already accepts null per-item
  fine) and resets `fb_sync_state` (new endpoint, see below) wherever it was `"excluded"`.

**`add_all.py`:**
- Walks `get_all_inventory()` filtered to `forSale` items with no `fbListingId` (defensive —
  safe to re-run if Delete All only partially succeeded on the FB side; David's call, given
  this costs nothing and prevents an accidental duplicate listing).
- Per item: prints unit cost / sale price / regular price / sales tax included / allow
  shipping / shipping price, asks whether to list at all, then (if yes) walks each editable
  field except unit cost — Sale Price, Regular Price, Sales Tax Included, Allow Shipping,
  Shipping Price (only asked if Allow Shipping ends up true) — with the current value
  pre-filled via `questionary.text(default=...)` (new dependency; `rich`'s prompt helpers
  don't support an editable pre-filled default, which is exactly the "Enter keeps it,
  backspace+retype changes it" UX David asked for).
- Saves the edited values to CCG via `POST /api/inventory/:id/update` (`client.update_item`)
  regardless of what happens next — **this is a full-record replace, not a patch** (confirmed
  by reading `handleInventoryUpdate`, `crud2.ts:35` — it reads ~50 body fields with hard
  defaults and 400s if title/categoryId/barcode/purchasedDate/images are missing), so
  `update_item` takes the full item dict already in hand from `get_all_inventory()` with only
  the changed fields overwritten, mirroring exactly how `admin-v2-app`'s own edit form saves.
  `fixedShippingAmount` rides along in the same call — `handleInventoryUpdate` already writes
  it to `ccg_inventory_items_addtl` internally (`crud2.ts:730`), no separate endpoint needed.
- Then asks whether to draft it on FB now; **only drafts, never publishes** (David's explicit
  choice — keeps the existing tool's safety model rather than auto-publishing hundreds of
  listings unattended). Reuses `create_draft_listing()` unchanged except for two new params.

**New Worker endpoint:** `POST /api/inventory/:id/fb-include` (`handleInventoryFbInclude`,
`crud2.ts`, registered `index.ts`) — exact mirror of `fb-exclude` but calls
`dbSetInventoryFbSyncState(recordId, null, env)`. No prior route could clear this field back
to null; `fb-exclude` only ever set `'excluded'`. Deployed via `npx wrangler deploy`, same as
every other `fb-*` endpoint.

**Two new, unverified FB-side automations — flagged, not resolved:**
- `fbm_client.delete_rows_with_title()` — **confirmed live 2026-09-20** on a single listing
  (probed read-only first). The listing page and Edit form have NO delete control; it lives on
  the selling page: per-row `More actions for <title>` button -> menuitem `Delete` -> dialog
  `Delete listing?` (Delete / Cancel). Rows carry no listing id, so title is the only handle.
  **Group copies:** David usually posts each item to 4 groups; each group post is a separate
  listing with its own id and the same title ("David Hopper listed this in <group>"), and a
  deleted copy reappeared under a new id. Hence delete-by-title, all copies, verified by row
  count dropping by one each time, followed by a full rescan and up to 5 passes. An earlier
  version stopped scrolling at the first title match and could have deleted the wrong twin.
  Multi-copy behavior still needs a live test on a group-posted item.
- Shipping fields in `create_draft_listing()`'s Delivery step (`SHIPPING_TOGGLE_LABEL`,
  `SHIPPING_PRICE_LABEL_CANDIDATES`) — same caveat, plus a deeper open question: **it isn't
  confirmed Facebook's create form even supports an arbitrary fixed shipping price**, as
  opposed to only calculated/weight-based shipping. Needs a live throwaway test listing
  before Add All is trusted for any item with Allow Shipping on.

Worth a look sometime, unrelated to this work: the Worker's `wrangler.toml` already defines
an `APIFY_FACEBOOK_ACTOR` env var (`"apify/facebook-marketplace-scraper"`) that doesn't
appear to be used anywhere in `ccg-fbm-sync` today — possibly a steadier way to read FB's own
listings than Playwright-scraping `you/selling`, if the Playwright approach ever becomes
unreliable. Not investigated as part of this work; noted here so a future session doesn't
have to rediscover it.
