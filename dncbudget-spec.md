# DNC Budget — Coherent Spec (supersedes budget-tracker-handoff.md)

**Status:** In progress, launching 9/1 (tomorrow, as of this update on 8/31). Built so far: D1 schema (§4), Plaid connections (§2), admin data layer + grid UI (§9), Sunshine voice (§3.6), the sync/matching pipeline (§5 steps 1-6), and a minimal version of the public analysis page (§7) — currently a pre-launch preview (no real data, section explainers + the September income breakdown) rather than the full live version, sent via a one-off "Send Launch Announcement" button. Not yet built: instant alerts, status/pace recompute, digests (§5 steps 7-9), the Cron Trigger itself, and the full (non-preview) version of §7 once real data exists.

**§8 revised for the actual launch:** no synthetic-data test seed and no historical backfill — decided to learn/track for real starting 8/25 (a ~1 week head start to prime merchant-category memory and recurring-bill detection before 9/1) rather than simulate first. `SYNC_HISTORY_START_DATE` in `sync.ts` reflects this; the wider 7/1-onward batch used for earlier testing was wiped from D1 (transactions, transfer_pairs, recurring_bills, merchant_category_rules) and both Plaid Items' sync cursors reset so the next sync re-pulls clean from 8/25. September's `total_in` is set to $12,417.44 (Hopper Realty $5,000 + Coal Creek Guitars $500 + Sequoia/FurnishedFinder $6,417.44 + personal thrift sales $500).

**8/25–8/31 is a David-only learning window — never surfaced to recipients.** The 8/25 sync start date exists purely so David can review/categorize real transactions and prime merchant-rule + recurring-bill detection before 9/1; it must never leak into anything Chrissie or the public link sees. Concretely: any recipient-facing surface (the public analysis page, digest/alert SMS text once built) must scope strictly to September 1 onward, never to whatever the sync/learning window pulled. The current launch-preview page already satisfies this by construction — it shows no transaction list at all, and hardcodes the September month for its `total_in` lookup rather than deriving "current month" generically. This becomes load-bearing once the **real** §7 page and the digest job (§5 steps 7-9) get built: month-scoped queries (`posted_date LIKE '2026-09%'`, as budget-math.ts already does) naturally exclude August rows once "current month" resolves to September for real — but this needs to stay true when those are built, not just be true today by coincidence. The admin grid is the one exception, deliberately — David is expected to see and work the August learning-phase data there.
**Purpose:** Household forward-looking budget tracker for David + Chrissie, living on the Coal Creek Guitars domain/infra but functionally and visually unrelated to CCG. Goes live 9/1.

**Name: "Sunshine."** The app is voiced as a named persona, Sunshine, rather than an anonymous system — every text and the analysis page read as coming from her. This isn't just a label; it's the mission statement for the whole voice/tone approach in §3.6: **the point of this app is to make paying attention to money feel positive, not punitive.** The thesis, stated plainly: knowing where you stand makes the things you buy feel more earned and more enjoyed, not more restricted. Sunshine's job is to be the character that delivers that — encouraging by default, honest when it matters, never a scold.

**Voice rule: Sunshine never names either recipient, first person throughout.** No "David," no "Chrissie" — she speaks as "I," not about either of them by name (e.g. "I ran the August numbers," not "David ran the August numbers"). This applies to all Sunshine-voiced copy — texts and the analysis page — not the System panel's own dev-facing test-SMS message, which isn't Sunshine's voice and does address recipients by name for clarity during testing.

This doc replaces the original `budget-tracker-handoff.md` (Teller.io based) wherever they conflict. It exists because Teller.io shut down its API in July 2026 and several other decisions changed during planning.

---

## 1. Surfaces & Auth

- **New minimal app**, not a clone of `admin-v2-app`. Borrows only the working pieces (AuthGuard/GuestGuard pattern, login page, base layout/theme) rather than the full Aurora template tree.
- Deployed under `/dncbudget/*` on the same Cloudflare Pages/Worker infra as the rest of CCG.
- **Auth: reuses the existing shared session**, no new credential pair. The existing cookie (`auth.ts`) is `Path=/`, 90-day, HttpOnly/Secure/SameSite=Lax — it already covers `/dncbudget/*` for free. Logging into admin or dncbudget is the same login.
- `robots.txt` gets a new `Disallow: /dncbudget/` entry, same pattern as `/admin/`.
- **One deliberate exception:** a public, unauthenticated "analysis" page reachable only via a texted token URL (§7). Everything else under `/dncbudget/*` — the transaction review grid, category management, recurring-bill review — stays behind the normal login. Only David is expected to ever log in; Chrissie never does.

---

## 2. Data sources

- **Chase (checking + credit cards): Plaid**, Trial plan (free, real production data, 10-Item cap, no KYB). Validated working end-to-end — Link completes against real Chase credentials, `/transactions/sync` returns real line items.
- **Teller.io: dead.** Shut down its API entirely in July 2026. Not used.
- **SimpleFIN: dropped.** Was validated as a working fallback but is redundant now that Plaid's confirmed — being cancelled.
- **SMS: Textbelt**, pay-per-quota, no subscription. Key obtained, delivery confirmed to both phones.

**Recipients live in D1, not hardcoded secrets.** The original handoff's plan to store two numbers as `PHONE_NUMBER_1`/`PHONE_NUMBER_2` Worker secrets is superseded — recipients are rows in `dnc_budget_sms_recipients` (§4) instead: US phone number + first name, an `active` flag to pause someone without deleting them, and an `is_default` flag (see below). Starts with David and Chrissie; every "both numbers" / "both phones" reference elsewhere in this doc means **all active rows in that table**, not a fixed pair. This is what makes adding/removing a recipient later a data change, not a redeploy.

**No admin UI for this table, deliberately.** David manages it directly via `wrangler d1 execute` when needed — not worth building a management screen for something that changes this rarely.

**`is_default` — exactly one row, enforced at the DB level.** Exactly one recipient can be flagged default (a partial unique index on `is_default WHERE is_default = 1`, not just application-level convention, since there's no UI guarding against a mistake in manual SQL). This is what the System panel's (§9) test-SMS button targets — **a single click sends to the default recipient, not a blast to everyone** in the table. Real digests/alerts still go to all active recipients regardless of who's flagged default; that flag only matters for the test button.

**Multiple Plaid Items, not just one.** The personal Chase Link tested earlier is Item #1. **A second Item — Chrissie's real estate business Chase account — is planned**, its transactions folded into the exact same pipeline with zero special-casing (no personal/business distinction anywhere in the data model). Trial's 10-Item cap comfortably covers this (2 of 10 used).

**How the $5k real estate income actually flows — resolved.** The $5k/month baked into the manually-entered `total_in` figure (§3.1) moves *from* the business account *into* the already-linked personal checking account. That transfer is the same shape as the existing checking↔credit-card-payoff transfer pairs (§5 step 4) — internal movement between the household's own linked accounts, just spanning two different Plaid Items instead of one. Transfer-pair detection needs to consider **all linked accounts across both Items**, not just accounts within a single Item, so this $5k movement gets tagged `transfer` on both legs and doesn't get counted as new income on top of the manually-entered figure.

**The business account is not wholesale included — it's selectively curated, same as any account.** Most of its transactions (e.g. a monthly real-estate-org membership fee) are pure business overhead with no bearing on household personal finances — those get marked **Ignore** (§9), same generic action used everywhere else, removing them from budget math entirely. Nothing about this account gets special default treatment: every transaction from it lands in the grid needing evaluation exactly like any other account (§9's "never silently assume" posture), and David decides case by case whether it's personal-relevant (categorize normally), pure business (Ignore), or the recurring transfer (auto-tagged, see above). **Ignore works identically on any transaction from any account** — personal checking, personal credit, the business account, or a manual store-card entry — no restriction anywhere in the design.

**Store/retail credit cards (Kohl's, Best Buy, Ross, Target, etc.) — not Plaid-connectable, handled manually.** See §3.7.

**Storage of Plaid credentials:** `PLAID_CLIENT_ID` / `PLAID_SECRET` as Worker secrets (`wrangler secret put`), same pattern as existing Stripe keys. The per-account `access_token` from Link is a longer-lived credential tied to a specific enrollment, not a fixed app-level secret — store it in D1 (`dnc_budget_plaid_items`, see §4), same trust boundary the Worker already uses for Stripe secret keys in `sys_info`.

**Open item:** Plaid Trial's historical lookback window (how far back `/transactions/sync` will actually return data) hasn't been tested yet. Needs a live check before the backfill in §8 can be planned precisely — if it can't reach back to May, the seeding strategy shifts to "backfill whatever's available + treat the gap as manually-entered."

---

## 3. Business logic

### 3.1 Definitions (refined from the original handoff)

- **Total In** — fixed number, entered manually per month.
- **Committed recurring** — sum of all confirmed recurring bills for the month. For each bill: use the **actual posted amount** if it's matched and posted this month; otherwise use its **expected/estimated amount** as a placeholder. This means the budget math self-corrects the moment a real bill posts instead of staying off by the estimate error for the rest of the month.
- **Spent so far** — sum of discretionary transactions since the 1st, excluding `recurring`, `transfer`, `ignored`.
- **Safe to spend** — `Total In − Committed recurring − Spent so far`.

### 3.2 Recurring ("expected") bills — fixed vs. variable

Two flavors, both live in `recurring_bills`, distinguished by a new `is_variable` flag:

- **Fixed** (mortgage, car payment): `expected_amount` is exact, `amount_tolerance` stays tight (near 0%) for matching.
- **Variable** (utilities): `expected_amount` is a **trailing average** computed from recent months' actual postings, used as the estimate until the real charge lands. Matching tolerance is much wider for these (per-bill override, not the global 15% default) since the swing between an average and a real utility bill can be large. Once the real transaction posts and matches, it replaces the estimate in that month's committed-recurring calc (§3.1).

### 3.3 Category tracking + auto-categorization

Same overall/category-cap model as the original doc (§5.4), plus a new mechanism to reduce manual review over time:

- **`dnc_budget_merchant_category_rules`** (new table): maps a merchant string (or normalized substring) → category. Populated automatically the first time David manually categorizes a transaction from that merchant. Every future transaction from that merchant auto-applies the remembered category instead of landing in the review queue.
- Transactions that don't match a known recurring bill or a known merchant rule fall to `unclassified` and surface in the admin review grid for manual categorization (or creation of a new merchant rule / new category on the spot).

### 3.4 Credit detection — two separate triggers

Any transaction that's a credit (refund, unexplained deposit, anything money-in that isn't recurring income or a transfer) does two things, independently:

1. **Counts toward the budget the instant it posts**, regardless of whether it's categorized yet. An unlabeled $458.54 deposit immediately increases safe-to-spend — it doesn't wait on David explaining what it was.
2. **Fires an instant one-off "credit posted" text**, excited tone, to both numbers — outside the normal digest cadence entirely. E.g. *"Hey — saw a credit hit today, CREDIT POSTED!! 🎉"* or, when the merchant's recognizable, *"Hey I saw an Amazon/TEMU credit today - GREAT JOB!!"*. (See caveat on "instant" in §5 — bounded by the hourly sync, not literally real-time.)

**A second, separate congrats fires later** when David categorizes/explains a previously-unknown credit (e.g. tags that $458.54 deposit as "sold furniture on Craigslist"). That categorization action is itself the trigger — a distinct message from the instant one above, since explaining a mystery deposit is its own small win worth acknowledging.

**Dry-spell nudge — confirmed, ~10 day default window.** If there's been no credit for ~10 days (tunable), fold a casual, light-touch nudge into the next scheduled evening digest rather than firing a standalone text — e.g. *"Been a bit since a credit landed — anything worth returning? Could help before month-end."* Keep it light, not naggy — this is copy that appears when the condition's true, not a hard detection feature. Needs real credit history at go-live to work correctly from day one — see §8 Phase 2, the backfill has to include historical refunds/credits, not just bills and discretionary spend, or the "days since last credit" counter starts blind on 9/1.

### 3.5 Large single-transaction alert

Separate from the two alert types above and from the pace-based warning/red alerts in §3.6: when a **single discretionary transaction** exceeds a threshold, fire an instant one-off text — respectful but blunt, not the routine pace alert. Default threshold: **$300** (tunable constant, same treatment as the red-alert buffer). Tone example, in the spirit of the Costco scenario: *"$750 at Costco just landed — that's going to hurt. Safe to spend's down to $X. Might be worth pulling back hard on discretionary spend the rest of the month to absorb it."* Blunt and factual, not cruel — states the number and the consequence, doesn't soften it, doesn't pile on.

### 3.6 Voice & persona — Sunshine

Casual and direct across all of this — texts should read like a person said them, not like a system generated them. Don't over-formalize the copy into templated corporate phrasing. Subtle accountability rather than scolding for overspending; genuine warmth (not performative) for wins. The examples above are the actual register to write in, not just illustrations of a "type" of message.

**Every text and the analysis page are voiced as Sunshine** — not a generic "the app" or an unsigned system notification. She's warm, a little upbeat, genuinely rooting for both of them, and confident without being a nag. The name itself is meant to set the emotional register before a single word of copy is read.

**Open design question, not yet decided — how present should the name be day to day?** Introducing herself in a one-time welcome text (see §6) is settled. What's *not* settled is whether every subsequent message re-signs as Sunshine (risks feeling gimmicky/repetitive at 3x/day plus instant alerts) or whether the name is established once and the *tone* alone carries the persona afterward, with the name resurfacing only occasionally (e.g. a sign-off emoji ☀️, or reintroducing herself if there's ever a long gap in contact). Leaning toward the latter — flagged here for David to weigh in on rather than deciding unilaterally.

**All copy is voiced at Chrissie by name, even though David gets the identical text on his phone too.** Not "Hey guys" or generic — always "Hey Chrissie..." This is the encouragement/validation dynamic David asked for explicitly: the texts exist partly to make her feel seen and rewarded for good spending behavior, and that only works if the copy is actually speaking to her, not addressing both of them generically. David reads the same message as an observer, not as its intended audience.

**Confirmed split — this tool is for both of them, not just a way to keep Chrissie in check.** David explicitly wants to be held accountable too. The reward/validation message types (credit-posted, categorization congrats, dry-spell nudge) keep the Chrissie-framing above. The **accountability-heavy types drop the name entirely and go flat/shared instead**: shock alert (§3.5) and the pace-based red alert. E.g. *"This is going to hurt — safe to spend's down to $190. Worth pulling back hard the rest of the month."* Nobody's singled out — it lands on whoever's reading it, which is the point.

### 3.7 Store/retail credit cards — manual entry, not Plaid

Cards like Kohl's, Best Buy, Ross, Target aren't Plaid-connectable. Handled as follows, so charges still count **the moment they happen**, not when the statement's paid:

- **"Log a charge" — a manual quick-add**, separate from the Plaid-sync pipeline: store, amount, date, category. Saves immediately as an ordinary `discretionary` transaction, hits safe-to-spend right away.
- **Store cards exist as manual "virtual" accounts** in `dnc_budget_accounts` — not tied to any Plaid Item, just a place for these transactions to attach and be visually distinguishable from bank-synced ones.
- **Avoiding double-counting:** the following month, the real bill payment posts on the actual Chase checking account via Plaid. Since the underlying spend was already logged at charge time, that bill-payment transaction gets marked **Ignore** (§9's existing action) — no new mechanism, just a monthly habit.
- **Not built (yet):** auto-detecting a checking-account payment as a specific store card's bill payoff via merchant-name pattern matching, same idea as transfer-pair detection, to make the Ignore step automatic. Starting manual; flag if this should be automated from the start instead.

---

## 4. Data model (D1)

Same physical database as the rest of CCG (`listing_evaluator`), **all new tables prefixed `dnc_budget_`**:

```
dnc_budget_accounts               -- Chase checking/credit accounts (via Plaid) + manual "virtual" accounts for store cards (§3.7)
dnc_budget_plaid_items            -- item_id + access_token per Plaid enrollment; multiple rows expected (personal + Chrissie's business, see §2)
dnc_budget_categories             -- Groceries / Dining / Gas / Shopping / Other (starter list, editable)
dnc_budget_recurring_bills        -- expected bills; is_variable flag; per-bill tolerance override
dnc_budget_merchant_category_rules -- learned merchant -> category mappings
dnc_budget_transactions           -- all pulled transactions, typed + categorized
dnc_budget_monthly_budget         -- one row per month, total_in
dnc_budget_transfer_pairs         -- detected internal transfers, spans all linked accounts across every Plaid Item (checking <-> credit card payoff, business <-> personal income move)
dnc_budget_alerts_log             -- sent SMS log, dedup for status-change alerts
dnc_budget_share_links            -- token, created_at, expires_at, send_context (new — see §7)
dnc_budget_sms_recipients         -- phone, first_name, active (new — see §2; replaces PHONE_NUMBER_1/2 secrets)
```

Structurally the same as the original handoff's schema (§6) for the tables that carry over — the deltas are: `recurring_bills.is_variable` + per-bill tolerance override, the new `merchant_category_rules` table, and the new `share_links` table replacing any notion of a login for Chrissie.

---

## 5. Jobs (Cloudflare Cron Triggers)

**Single hourly Cron Trigger drives everything** — not separate triggers for sync vs. digests. Reason: Cloudflare Cron Triggers are fixed UTC expressions with no built-in DST awareness, and the household is on **Denver, CO local time (`America/Denver`, DST-observing)**. Rather than hardcoding a UTC offset that drifts an hour wrong for ~8 months of the year, the hourly run computes local wall-clock time itself (timezone-aware, DST-correct) and decides what to do based on that — one mechanism, no seasonal cron-expression juggling.

### Every hourly run does, in order:

1. **Sync:** call Plaid's on-demand refresh, then pull transactions via `/transactions/sync`. (Hourly, not every 4 — Plaid itself only refreshes each institution 1–4x/day, so hourly is the point of diminishing returns; going faster gains nothing.)
2. Insert new transactions as `unclassified`.
3. Match against `recurring_bills` (merchant/amount/day-of-month within tolerance, wider for variable bills) → tag `recurring`.
4. Detect transfer pairs (checking → credit card payoff, **and now business account → personal checking for the monthly real estate income move, §2**) → tag both `transfer`. Matching spans all linked accounts across every Plaid Item, not just accounts within one Item.
5. Detect new repeating patterns not yet in `recurring_bills` → insert as unconfirmed for review.
6. Apply merchant-category memory (§3.3) to remaining unmatched transactions where a rule exists → tag `discretionary` + category. Everything else stays `unclassified` for manual review.
7. **Instant alert checks** (§3.4, §3.5) — any new credit → instant "credit posted" text; any single discretionary transaction over the shock threshold → instant shock alert. Both deduped via `alerts_log` so a transaction that's already been alerted on doesn't re-fire on the next hourly pass.
8. Recompute status (green/warning/red). If it just crossed into warning/red since the last logged status this month, fire an ad-hoc pace alert immediately (deduped, same as original spec).
9. **Digest check:** convert current time to local (America/Denver), compare against the three target slots below. If within the current hour of a slot and that slot hasn't already sent today, send it.

Everything under "instant" here (§3.4, §3.5, step 8) really means **"by the next hourly tick,"** not literally real-time — same ceiling Plaid itself imposes on data freshness generally.

### Digest slots (local Mountain Time)

- **~7:00am** — day-ahead view: what's expected to hit today/this week, a light forward-looking heads-up, not a full analysis.
- **~2:30pm** — midday pace check-in (exact time adjustable; you said "2–3pm," I picked the midpoint).
- **~8:00pm** — full daily wrap: pace status, categories, insight and red flags from what happened during the day, plus the dry-spell nudge (§3.4) when applicable. This is the one that should actually say something if something's wrong.

Each digest generates a **fresh share-link token** (§7) and texts the same link to both numbers — one shared link per send, not per-person, consistent with this being shared household data rather than personal accounts.

**Voice/tone for all texts and the analysis page:** see §3.6. Casual, direct, no fluff. Subtle accountability rather than scolding on overspend; genuine warmth on wins.

---

## 6. Sample SMS content (revised — Chrissie-voiced for reward/validation types, flat/shared for accountability types, per §3.6)

One-off — Sunshine's introduction (pre-launch hype text, §8 Phase 1 — DRAFT, not yet sent, pending David's review):
```
Hi Chrissie! ☀️ I'm Sunshine — your new budget sidekick for the house, and I am SO excited
to finally say hi! I've already connected to your accounts and I've been quietly digging
through the last couple months of spending, getting to know you both before the real fun
starts. Starting September 1st, you'll be hearing from me a few times a day with quick,
honest updates — and trust me, plenty of good news to celebrate along the way! My whole
job is to make paying attention to the budget feel like a win, not a chore, so every
purchase you make after checking in with me is going to feel that much more earned (and
enjoyed!). Can't wait to get started — talk soon!
```

7am (day-ahead):
```
Morning Chrissie — today: mortgage due (~$2,100), gym membership (~$45). Otherwise clear.
Full view: <link>
```

2:30pm (midday):
```
Chrissie, midday check: $340 safe to spend, on pace.
Full view: <link>
```

8pm (full daily, no issues):
```
Chrissie — Aug 14 wrap.
Safe to spend: $340. Pace: warning.
Dining's running $85 over what today should look like, mostly delivery.
Full view: <link>
```

8pm (full daily, dry-spell nudge):
```
Chrissie — Aug 14 wrap.
Safe to spend: $410. On pace.
Been a bit since a credit landed — anything worth returning? Could help before month-end.
Full view: <link>
```

Instant — credit posted (unlabeled deposit):
```
Chrissie — saw a credit hit today, CREDIT POSTED!! 🎉 Safe to spend's up to $798.54.
```

Instant — credit posted (recognizable merchant):
```
Chrissie, saw an Amazon credit today - GREAT JOB!!
```

Instant — categorization congrats (after David explains a mystery deposit):
```
Chrissie, nice — $458.54 from selling the dresser on Craigslist. Real win this month.
```

Instant — shock alert (single large discretionary transaction, §3.5 — flat/shared, no name, per §3.6):
```
$750 at Costco just landed — that's going to hurt. Safe to spend's down to $190.
Probably worth pulling back hard on discretionary spend the rest of the month to absorb it.
```

Pace-based red alert (flat/shared, no name, per §3.6):
```
Heads up — current pace projects going ~$340 over this month.
Safe to spend right now: $120.
Full view: <link>
```

---

## 7. Public analysis page (Chrissie's access model)

Replaces "Chrissie logs in" entirely — **she never authenticates.**

**David and Chrissie receive the identical text and the identical link** — there's no per-recipient personalization. But the copy is always voiced *at* Chrissie specifically ("Hey Chrissie...") even on David's phone. This is deliberate, not an oversight — see §3.6.

- Each digest/alert text carries a **fresh GUID query-string token** (`dnc_budget_share_links`), e.g. `/dncbudget/view?t=<guid>`.
- **Token expires 2–3 days after creation.** After that, the link 404s/expires even if someone still has it.
- The page itself is **one consistent template regardless of which send generated the token** — always renders the full current-month analysis live (not a snapshot frozen at send time). This is a simplification I'm recommending over building separate "morning view" / "evening view" page variants: the *text* differs by time of day (§5, §6), but the linked page is always the same honest, complete picture. Less to build and maintain, and Chrissie always gets full context no matter which link she clicks.
- **Layout:** above the fold is the headline — a status banner (red/"shame on you" vs. green/"congrats," warning as the middle state) plus the "pointers" callouts, plain-language, where spending's running hot and what to watch, same voice guidance as §3.6. Below the fold always reveals **all** detail for the month — full transaction/category breakdown, no scrolling gate.
- **Scope: current month only, decided.** No prior-month comparison, no prior-month version of this page at all — this page only ever exists for whatever month is currently live. Past months are viewable only as raw grid data from the admin side (§9's grid of months), with no banner/pointers treatment. Not a technical limitation, a deliberate scope call.
- **Hardening**, since this page is intentionally unauthenticated:
  - `X-Robots-Tag: noindex` response header (in addition to `robots.txt` already blocking `/dncbudget/`).
  - `<meta name="referrer" content="no-referrer">` so the token never leaks via a Referer header.
  - No navigation link to this page from anywhere else on the site — reachable only via the texted URL.

---

## 8. Testing strategy, then seeding for the 9/1 live date

Two phases, in order, with a hard reset between them. We don't seed real Chase history until the app itself has been exercised and approved on fake data — otherwise the first time any of this logic runs against real numbers is also the first time it's ever been tested, which is backwards.

### Phase 1 — synthetic data, sandbox testing

Before touching real Plaid data, a seed script inserts fabricated rows directly into `dnc_budget_transactions` (plus a couple fake accounts) — a made-up month or two covering every code path we need to exercise:

- Fixed recurring bills landing on realistic days (mortgage, car payment)
- A variable bill (fake utility) to test the trailing-average estimate logic
- A spread of ordinary discretionary purchases across categories, to test matching + the review grid
- A transfer pair (checking → credit card payoff), to test transfer detection
- A refund/credit, to test the instant "credit posted" text
- An unlabeled cash deposit, to test "counts immediately, explain later" → categorization congrats
- One oversized purchase, to test the §3.5 shock alert
- A stretch with no credits at all, to test the dry-spell nudge copy

**Architectural point that makes this possible:** the Plaid-fetch step has to stay thin and cleanly separated from everything downstream of it (matching, categorizing, alerting, texting, the share-link page). That downstream pipeline runs identically whether the transactions came from real Plaid or the fake seed script — so Phase 1 exercises the *entire* app, not just the parts that don't touch the bank.

For the SMS leg specifically: start with Textbelt's free shared test key (`key=textbelt`, 1/day) or just your own number while iterating on copy and thresholds, and only start hitting both phones with the real paid key once you're happy with the wording — no reason to burn paid quota mid-iteration.

Iterate here until the grid, the categorization flow, the pace math, all four alert types (pace-based, credit-posted, categorization-congrats, shock), and the share-link page all feel right.

**Near the end of Phase 1, a small batch of real texts go to both actual phones** using the real Textbelt key — not the shared free key. Partly a final real-device format/delivery check, partly deliberate pre-launch hype (something like *"Chrissie — something's coming for the budget on 9/1, stay tuned"*). Cheap, low-risk, no new mechanism needed beyond just sending a few real messages ahead of go-live.

### The reset

Once approved, **wipe every `dnc_budget_*` table clean** — a straightforward `DELETE FROM` pass, same style as other one-off data changes already used in this repo. This matters: fake merchant names and fake recurring bills from testing must not survive into the real merchant-memory table or bill list, or they'll pollute real matching once we're live.

### Phase 2 — the real seed

Goal: nothing about September should be "new" to the app on day one.

1. **Backfill historical transactions** from Plaid — target May onward, pending the lookback-window check (§2). Must include historical refunds/credits, not just bills and discretionary spend — the dry-spell nudge (§3.4) needs real "days since last credit" history to work correctly from 9/1, not start blind.
2. **Run recurring-bill auto-detection** over that history to surface mortgage, car payment, utilities, etc. as candidates.
3. **David reviews and confirms** the recurring-bill list before 9/1 — including entering/checking the trailing-average estimate for variable bills (§3.2). This happens ahead of time, not reactively during September.
4. **David categorizes historical discretionary transactions** (May–August) in the review grid. This is what populates `merchant_category_rules` so September's first Amazon or McDonald's charge auto-categorizes correctly from day one instead of hitting the review queue.
5. **Enter September's `total_in`** ahead of time, same as any normal month, just done proactively.
6. **Go live 9/1** with recurring bills confirmed, category memory seeded, and income set.

---

## 9. Admin experience (David's side)

### Transaction grid — the core workspace, not a one-time queue

- Shows **all actual, posted transactions** for whichever month is selected (from the grid of months, §9). Expected/recurring bills that haven't posted yet **never appear as grid rows** — their effect is purely in the top-line "safe to spend for non-expected charges" math (§3.1). Concretely: if you have $2,500 left in non-expected spend for the month, that number already has the unposted mortgage/car-payment/utility-estimate baked in — you just don't see a phantom row for them.
- Category is an **inline dropdown, always editable** — for any transaction, at any time, not just uncategorized ones. Disagree with an auto-categorization (recurring match, merchant-memory rule, whatever)? Change it in place, no separate "correction" flow needed.
- Per-row actions beyond categorize:
  - **Mark as Expected** — promotes a transaction into a recurring bill. Prompts for the metadata a single transaction can't tell us on its own (day-of-month range, tolerance, fixed vs. variable/estimated). Confirmed immediately on save — no pending state, since it's a direct human decision, not a system guess.
  - **Ignore** — sets the transaction's type to `ignored`, removes it from all budget math entirely. Expected to be rare, but has to exist.
- **System-suggested recurring candidates surface contextually, not as a separate screen.** When the hourly job detects a pattern (same merchant/amount 2+ of the last 3 months) it doesn't get its own review queue — it shows as a badge directly on the matching transaction row (e.g. "Possible recurring — Xcel Energy?"). The same **Mark as Expected** action confirms it; dismissing it is equivalent to rejecting it. This replaces the earlier idea of a dedicated recurring-bill review page — it's the same grid, contextual.
- **Default posture: never silently assume something's expected.** Anything the system doesn't recognize defaults to needing evaluation (unclassified/discretionary, pending review) — it only becomes recurring via an automatic suggestion being confirmed, or an explicit manual "Mark as Expected." No silent auto-promotion.
- **"Log a charge" — a global action, not per-row** (it creates a new transaction rather than acting on an existing one). For store/retail cards Plaid can't reach — see §3.7.

### Grid of months — the home view

- `/dncbudget` (authenticated, David only) lands here first — a table, one row per month — not directly on the current month's detail.
- Columns: **Month, Total In, Committed Recurring, Spent So Far, Safe to Spend, Status (green/warning/red), # transactions needing review.**
- Clicking a row drills into that month's transaction grid.

### System panel — a permanent page, not the Stage 1 throwaway buttons

Replaces the Stage 1 scaffold's temporary "Read Transactions" / "Send SMS" test buttons with a real, permanent admin page:

- **Send a test SMS** — one click, no typing. Sends to whichever recipient is flagged `is_default` in `dnc_budget_sms_recipients` (§2), not a blast to everyone in the table. Uses Textbelt the same way the real digests do.
- **Textbelt quota, always visible** — Textbelt has a quota-check endpoint (`GET /quota/<key>`) that reads remaining balance without sending anything. Shown on page load, not just as a byproduct of sending a test text.
- **Pull recent transactions from either connected Plaid account** — personal and Chrissie's real estate business account, selectable, not just the one hardcoded test connection from Stage 1. This requires the real per-Item token storage (`dnc_budget_plaid_items`, §4) rather than a single `PLAID_ACCESS_TOKEN_TEST` secret — pulling this forward is the natural next step now that there are two real accounts to support.

---

## 10. Open items before build starts

Everything product/design-level is now decided. Two technical unknowns remain, to be resolved by testing when we build rather than through more discussion now:

- **Plaid Trial historical lookback window** — needs a live test pull to confirm how far back `/transactions/sync` actually reaches before the backfill scope in §8 can be finalized.
- **How often Sunshine's name resurfaces in routine texts** (§3.6) — one-time intro vs. periodic re-signing. Needs David's call.
- **Whether the store/retail cards in §3.7 are actually Plaid-connectable** — Kohl's (Capital One), Best Buy (Citi), and a couple on MySynchrony are all issued by major banks Plaid generally supports well. Not yet tested. If they connect, those specific cards move to the normal automatic Plaid pipeline and §3.7's manual "Log a charge" entry becomes the fallback for whatever doesn't, rather than the default for every store card. Worth testing before building §3.7 as manual-only.

Settled defaults, not open questions, kept here for reference: shock-alert threshold $300 (§3.5), dry-spell window ~10 days (§3.4), starter category list Groceries/Dining/Gas/Shopping/Other (§4), red-alert pace buffer intentionally left unset pending real data after go-live (§5), analysis page is current-month-only with no past-month version (§7), accountability alerts are flat/shared while reward alerts stay Chrissie-voiced (§3.6), business-account transactions are selectively curated via Ignore rather than wholesale included (§2).

---

## 11. Explicit non-goals

- Teller.io — not used (vendor shut down).
- SimpleFIN — validated as a working fallback, then dropped once Plaid confirmed; not part of the build.
- Chrissie logging in, at all, ever.
- Separate/rotating credentials for dncbudget vs. admin — intentionally shared.
- A dedicated recurring-bill review screen — folded into the main transaction grid as contextual badges/actions instead (§9).
