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

### CCG API endpoints — built and deployed (2026-09-13)

- `GET /api/inventory` — existing endpoint (`handleInventoryList`). No server-side filter for `for_sale`/`sales_channel_fbm`/"`fb_listing_id` is null" — `ccg_client.py` pages through everything (`active=all`) and filters client-side. Response: `{records, page, limit, total, totalPages, availableBrands}`.
- `POST /api/inventory/:id/fb-add` — new endpoint, mirrors the existing `reverb-add` pattern but simpler: Facebook has no public API to create a listing, so this just validates + persists the caller-supplied id (body: `{fbListingId: string}`), sets `sales_channel_fbm = 1`, and 400s if the item is already linked. Handler: `handleInventoryFbAdd` in `workers/listing-evaluator/src/inventory/crud2.ts`.
- `POST /api/inventory/:id/fb-remove` — mirrors `reverb-remove`, no body needed, clears `fb_listing_id` and `sales_channel_fbm`. Handler: `handleInventoryFbRemove`, same file.
- Both call `dbSetInventoryFbListingId` (`workers/listing-evaluator/src/inventory/db-write.ts`), which is the exact analog of `dbSetInventoryReverbListingId` — single `UPDATE ccg_inventory_items SET fb_listing_id = ?, sales_channel_fbm = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`.
- Routes wired in `workers/listing-evaluator/src/index.ts` next to the `reverb-add`/`reverb-remove` blocks. `fb_listing_id` also added to both inventory SELECTs and both row-mapping functions in `db-core.ts` so it comes back on every inventory read. Deployed via `npx wrangler deploy` from `workers/listing-evaluator/`.
- `fb_ignore_list` table + its CRUD endpoints — still net new, not yet built. Needed for the "normal run" tool (Section 5), not for Match Mode.

None of these need to be fancy — this is an internal tool talking to David's own system.

### Auth (decided 2026-09-13)

CCG's Worker has no API-key/service-token mechanism — the only auth path is `POST /api/login` (username/password → HMAC-signed session cookie via `requireAuth()` in `workers/listing-evaluator/src/auth/middleware.ts`), used today by the browser admin app.

**Decision: the CLI logs in fresh at the start of every run.** `ccg_client.py` calls `POST /api/login` with credentials read from a local, gitignored `.env` (never committed — see `ccg-fbm-sync/.gitignore`), holds the returned session cookie in memory for that run only, and discards it on exit. No changes to the Worker's auth code. This matches the tool's stateless design principle directly, rather than fighting it with a new persistent-credential scheme.

---

## 5. Reconciliation logic (the "normal run" tool)

### The buckets

1. **CCG for-sale, no FB id, not excluded** — candidate to post to FB
2. **CCG for-sale, no FB id, excluded** (`fb_sync_state = excluded`) — intentionally CCG-only, skip silently
3. **CCG for-sale, has FB id, matched to a live FB listing** — in sync, no action needed
4. **FB listing, no CCG id match, id is on the ignore-list** — known personal item, skip silently
5. **FB listing, no CCG id match, not ignored, but title/price looks like it could be an unlinked bucket-1 item** — "possible link" — ask before assuming it's unrelated
6. **FB listing, no CCG id match, not ignored, no plausible match** — truly unknown, needs a decision
7. **CCG for-sale, has FB id, but that id is NOT in FB's current active/available results** — discrepancy (sold on FB / listing removed or expired / stale or wrong id) — needs a decision

### Pseudocode — reconciliation pass (pure, no writes)

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

## 6. Open question: how does the tool read FBM data?

Facebook does not offer a public API for an individual seller to read their own Marketplace listings. Two options, not yet decided:

- **Manual paste**: the tool prompts David to paste in current FB listing IDs/titles/status at the start of each run. Zero ToS risk, fully portable, slightly more manual effort each run.
- **Browser automation (Playwright)**: drives a real logged-in browser session to read David's own Marketplace listings page. Works identically on Mac and Windows. Technically against Facebook's automation terms even when only touching your own account — a real risk to be aware of, not just a formality.

**Recommendation:** start with manual paste to get the reconciliation logic and approval flow working end-to-end, since that's the part with lasting value. Automating the FBM read can be swapped in later without touching `reconcile.py` or `approve.py` at all — it only replaces what feeds `fbm_client.py`.

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
│   ├── fbm_client.py
│   ├── reconcile.py         <- not yet written, needed for the normal-run tool only
│   ├── approve.py           <- not yet written, needed for the normal-run tool only
│   ├── match_mode.py        <- ONE-TIME USE, built and ready to run — delete after backfill is verified
│   └── tests/
│       └── test_match_mode.py
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
- ~~Manual paste vs. Playwright for FBM reads~~ — decided: manual paste to start (Section 6). Swappable later without touching `reconcile.py`/`approve.py`.

**Resolved (2026-09-13, continued) — Match Mode is built and ready to run:**
- `fb_listing_id` column live in production D1 (`ccg_inventory_items.fb_listing_id TEXT`, nullable).
- `fb-add`/`fb-remove` Worker endpoints built, typechecked, and deployed (see Section 4).
- `ccg_client.py`, `fbm_client.py` (manual paste), and `match_mode.py` written; matching logic is a pure function (`compute_matches`) with passing unit tests in `tests/test_match_mode.py`.
- Match Mode groups by `saleTitle` (falling back to `title`), not a generic "title" field — mirrors what Reverb's own listing flow validates/uses, since that's the text that would actually have been posted to FB.
- To run: copy `.env.example` to `.env`, fill in `CCG_USERNAME`/`CCG_PASSWORD`, `pip install -r requirements.txt`, then `python match_mode.py` (dry run — prints the report only) or `python match_mode.py --apply` (writes after an explicit y/N confirmation).

**Still open — needed for the "normal run" tool (Section 5), not for Match Mode:**
- `reconcile.py` / `approve.py` not yet written. They depend on `fb_sync_state` (new column, not yet added) and the `fb_ignore_list` table + CRUD endpoints (not yet built) — deferred until after Match Mode has run and been verified, matching the doc's own sequencing (the normal tool isn't useful until the backfill is done).
- What counts as a "title match" for the *ongoing* fuzzy-match in bucket 5 (possible-link) — likely looser than Match Mode's exact-match rule, since Match Mode intentionally uses strict exact-match-only to stay safe for a one-time bulk operation. Low-stakes; defer until there's real data to tune against.
- Whether `queue_fb_listing_draft()` should produce anything more than a printed/copyable block of text (title, price, description, image links) given there's no publish API to call. Low-stakes implementation detail.
