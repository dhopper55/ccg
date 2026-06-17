# Template Dead-Code Cleanup

Both `admin-v2-app` and `shop-app` were built on a purchased React template.
Large chunks of that template — demo dashboards, docs pages, fake data, example
pages — were never wired into production routing and exist only as search noise
for AI assistants.

This document describes how to remove them safely.

---

## Why it's not a simple `rm -rf`

The template code is internally cross-linked. Dead pages import from dead
components which import from dead data files, but some of those intermediate
pieces are also imported by live code. Deleting top-level directories without
tracing imports first breaks the build.

Two concrete examples found during analysis:

- `docs/routes/docPaths` is imported by **live** auth components
  (`SignupForm.tsx`, `ForgotPasswordForm.tsx`, `Auth0Login.tsx`) — delete `docs/`
  first and the build fails.
- `pages/apps/ecommerce/admin/Refund.tsx` exports `RefundFormValues`, a type
  imported by live ecommerce section components — can't delete the page alone.

---

## Steps

### 1 — Safe immediate deletes (no broken imports)

These directories have no inbound imports from live code:

```
admin-v2-app/src/pages/changelog/
admin-v2-app/src/pages/misc/
shop-app/src/pages/changelog/
shop-app/src/pages/misc/
```

Delete them and run `npm run build` (or `tsc --noEmit`) in each app to confirm
clean.

---

### 2 — Fix the three auth components, then delete `docs/`

The only live code importing from `docs/` is:

| File | Import |
|------|--------|
| `src/components/sections/authentications/default/SignupForm.tsx` | `docs/routes/docPaths` |
| `src/components/sections/authentications/default/ForgotPasswordForm.tsx` | `docs/routes/docPaths` |
| `src/pages/authentication/default/auth0/Auth0Login.tsx` | `docs/routes/docPaths` |

In each file, `routePaths` from `docPaths` is used for nav links that point at
template documentation pages (e.g. "back to docs"). These links aren't shown in
production — replace each import + usage with a hardcoded `/` or just remove the
link element entirely.

Once all three files no longer import from `docs/`, delete:

```
admin-v2-app/src/docs/
shop-app/src/docs/
```

Run a build to confirm clean.

---

### 3 — Trace and delete the remaining dead pages + components

The following page directories are not in the router but have inbound imports
from other template-only components under `components/sections/`:

```
admin-v2-app/src/pages/dashboards/     (CRM, HRM, ECommerce, Hiring, TimeTracker, etc.)
admin-v2-app/src/pages/apps/           (calendar, chat, email, file-manager, kanban, etc.)
admin-v2-app/src/pages/landing/
admin-v2-app/src/pages/events/
admin-v2-app/src/pages/pricing/
admin-v2-app/src/pages/Showcase.tsx
```

For each directory, the process is:

1. Grep for imports of that directory across the whole `src/` tree.
2. If every importer is itself dead code, add it to the delete list.
3. Repeat until only true leaves remain.
4. Delete the batch and run `tsc --noEmit`.

The corresponding `components/sections/` subdirectories — `dashboards/`,
`calendar/`, `chat/`, `email/`, `file-manager/`, `kanban/`, `crm/`, `hrm/`,
`hiring/`, `time-tracker/`, `events/`, `landing/`, `ecommerce/admin/` (the
template admin parts, not the CCG-custom ones) — can be deleted in the same
pass once their dependents are gone.

Do the same audit for `shop-app/src/`.

---

### 4 — Delete orphaned `data/` files

Once all dead pages and components are gone, many files under `data/` will have
no remaining importers:

```
admin-v2-app/src/data/calendar.ts
admin-v2-app/src/data/chat.ts
admin-v2-app/src/data/crm/
admin-v2-app/src/data/e-commerce/        (template demo data, not CCG inventory)
admin-v2-app/src/data/email.tsx
admin-v2-app/src/data/events.tsx
admin-v2-app/src/data/file-manager.ts
admin-v2-app/src/data/hiring/
admin-v2-app/src/data/hrm/
admin-v2-app/src/data/kanban/
admin-v2-app/src/data/landing/
admin-v2-app/src/data/project/
admin-v2-app/src/data/social.ts
admin-v2-app/src/data/time-tracker/
admin-v2-app/src/data/users.tsx
```

Use `grep -rn "from.*data/X"` to confirm each file has zero importers before
deleting. Some `data/` files ARE used by live layout code (e.g. `data/search-result`
is imported by the main-layout search box) — don't delete those.

Run a final `tsc --noEmit` and `npm run build` in both apps to confirm clean.

---

## Alternative: annotate instead of delete

If the surgery above feels too risky or time-consuming, a lower-risk option that
still helps AI assistants is to add a note to `ARCHITECTURE.md`:

```markdown
## Template dead code (do not modify or reference)

Both `admin-v2-app` and `shop-app` were built on a purchased React template.
The following directories contain template demo code that is **never imported
by production routes** and can be ignored entirely:

- `src/docs/`
- `src/pages/dashboards/`
- `src/pages/apps/` (except `apps/ecommerce/customer/` which contains real shop pages)
- `src/pages/landing/`, `src/pages/changelog/`, `src/pages/events/`,
  `src/pages/misc/`, `src/pages/pricing/`
- `src/data/` subdirectories: `crm/`, `calendar`, `chat`, `email`, `events`,
  `file-manager`, `hiring/`, `hrm/`, `kanban/`, `landing/`, `project/`,
  `social`, `time-tracker/`, `users`
- `src/components/sections/` subdirectories that mirror the above pages
```

This costs nothing and immediately tells any AI working on the codebase to skip
those trees.
