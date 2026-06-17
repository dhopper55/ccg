# Architecture Refactor Handoff

Four items ranked by AI-friction impact. Each is independent — do them in any order.

---

## 1 — Split `InventoryItem.tsx` (3,986 lines) — HIGHEST PRIORITY

**File:** `admin-v2-app/src/pages/inventory-manager/InventoryItem.tsx`

This is the most-edited admin page and currently a 4,000-line God component. Every
inventory change requires an AI to load the entire file. It handles at least:
image gallery, pricing fields, item metadata (make/model/year/finish/condition),
listing links, barcode, archive/delete, and label generation.

**Target structure:**

```
admin-v2-app/src/pages/inventory-manager/
  InventoryItem.tsx              ← thin orchestrator: load/save/delete state, ~200 lines
  sections/
    InventoryItemImages.tsx      ← image gallery, upload, reorder, private flag
    InventoryItemDetails.tsx     ← make/model/year/finish/condition/notes/barcode
    InventoryItemPricing.tsx     ← cost basis, private party value, sale price, for-sale toggle
    InventoryItemListings.tsx    ← Reverb listing links, listing status, sale URL
```

**Approach:**
1. Read the full file once to identify the section boundaries (look for the big JSX
   blocks and the state/handlers each section uses).
2. Extract one section at a time into its own file. Pass shared state (item record,
   save handler, loading flag) as props.
3. The orchestrator (`InventoryItem.tsx`) owns the `useEffect` data fetch, the top-level
   `useState` for the item, and the save/delete/archive actions. Each section gets
   only the slice of state it needs.
4. Keep each new file under 500 lines per the project convention in `ARCHITECTURE.md`.

**Risk:** Low. Pure extraction — no logic changes. Run the dev server and test the
full inventory edit flow (load item, edit each section, save, upload image, delete)
before considering it done.

---

## 2 — Annotate `ARCHITECTURE.md` with template dead-code map

**Files:**
- `admin-v2-app/src/` — large swaths of `docs/`, `pages/dashboards/`, `pages/apps/`,
  `pages/landing/`, `data/crm/`, `data/calendar`, etc. are template demo code never
  used in production.
- `shop-app/src/` — same pattern.

The template code is too cross-linked to delete safely without a full dependency
audit (see `TEMPLATE-CLEANUP.md` for that plan). The quick win is to annotate
`ARCHITECTURE.md` so any AI working on the codebase knows to skip these trees.

**Add this section to `ARCHITECTURE.md`:**

```markdown
## Template dead code

Both `admin-v2-app` and `shop-app` were built on a purchased React template.
The following directories contain template demo code that is never imported by
production routes and should be ignored:

**admin-v2-app/src/**
- `docs/` — component documentation pages
- `pages/dashboards/` — CRM, HRM, ECommerce, Hiring, TimeTracker, Analytics demos
- `pages/apps/` — calendar, chat, email, file-manager, kanban demos
- `pages/landing/`, `pages/changelog/`, `pages/events/`, `pages/misc/`, `pages/pricing/`
- `data/crm/`, `data/calendar`, `data/chat`, `data/email`, `data/events`,
  `data/file-manager`, `data/hiring/`, `data/hrm/`, `data/kanban/`, `data/landing/`,
  `data/project/`, `data/social`, `data/time-tracker/`, `data/users`
- `components/sections/` subdirectories mirroring the above (dashboards/, calendar/,
  chat/, crm/, email/, events/, file-manager/, hiring/, hrm/, kanban/, landing/,
  time-tracker/)

**Production code lives in:**
- `pages/inventory-manager/`, `pages/listing-evaluator/`, `pages/order-manager/`
- `pages/serial-decodes/`, `pages/serial-pattern-text/`, `pages/value-reports/`
- `pages/shop-statistics/`, `pages/system-settings/`, `pages/mfr-orders/`
- `pages/payment-links/`, `pages/others/Starter.tsx`, `pages/authentication/`
- `components/base/`, `components/common/`, `components/guard/`
- `layouts/main-layout/`, `layouts/auth-layout/`
- `providers/`, `routes/`, `lib/`
```

**Risk:** Zero. Text-only change.

---

## 3 — Reorganize Worker `db.ts` / `db2.ts` overflow pattern

**Files affected:**
```
workers/listing-evaluator/src/orders/db.ts    (904 lines)
workers/listing-evaluator/src/orders/db2.ts   (505 lines)
workers/listing-evaluator/src/listings/db.ts
workers/listing-evaluator/src/listings/db2.ts
workers/listing-evaluator/src/serial/db.ts
workers/listing-evaluator/src/serial/db2.ts
```

`db2.ts` files exist only because `db.ts` hit the size limit. The split is
mechanical, not semantic — an AI has to check both files to understand any domain's
full DB layer.

**Proposed renames for `orders/` (largest, highest-traffic domain):**

| Current | Proposed | Contents |
|---------|----------|----------|
| `orders/db.ts` | `orders/db-checkout.ts` | order creation, checkout state, status transitions |
| `orders/db2.ts` | `orders/db-reads.ts` | order list queries, detail fetch, receipt |

Apply the same pattern to `listings/` and `serial/` once you've established the
naming convention.

**Approach:**
1. Read both files to find the natural split (reads vs writes, or by subdomain).
2. Create the new files, move functions across.
3. Update all import sites — `grep -rn "from.*orders/db"` to find them all.
4. Run `wrangler deploy --dry-run` to confirm the Worker compiles.
5. Deploy and smoke-test affected endpoints.

**Risk:** Medium. Touching imports across many files. Do one domain at a time.
The `orders/` domain has the most callers so do it last; start with `serial/` which
is more self-contained.

---

## 4 — Split `ListingEvaluatorItem.tsx` and `SerialDecodes.tsx`

Lower priority than #1 since these pages are edited less frequently, but same
pattern as InventoryItem.

**`ListingEvaluatorItem.tsx` — 1,727 lines**
`admin-v2-app/src/pages/listing-evaluator/ListingEvaluatorItem.tsx`

Natural sections to extract:
- `ListingEvaluatorItemPhotos.tsx` — photo gallery, image management
- `ListingEvaluatorItemPricing.tsx` — pricing fields, reverb price comparison
- `ListingEvaluatorItemDetails.tsx` — listing metadata, description, condition

**`SerialDecodes.tsx` — 1,416 lines**
`admin-v2-app/src/pages/serial-decodes/SerialDecodes.tsx`

This is likely a combined list + detail view. Extract:
- `SerialDecodesList.tsx` — the table/list, filters, pagination
- `SerialDecodeDetail.tsx` — the selected-decode detail panel

**Approach:** Same as item #1. Extract one section at a time, pass state as props,
keep each file under 500 lines. Test the full flow (search, select, edit) before
done.

**Risk:** Low. Pure extraction.
