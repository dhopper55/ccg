# CCG Agent: Architecture and Design Handoff

**Prepared:** 2026-11-24
**Owner:** David, Coal Creek Guitars
**Purpose of this doc:** Full context for a fresh Claude Code session (or a person) picking up
CCG Agent work with no prior conversation history. It records decisions actually made; anything
not decided yet is under "Open questions". For day-to-day setup commands, see [README.md](README.md).

---

## 1. What this tool is

CCG Agent is an **always-on local worker** that runs jobs queued in CCG (the Worker plus D1,
Coal Creek Guitars' system of record). It is the home for local tools that can't run in a
Cloudflare Worker because they need a real browser, a logged-in Facebook session, or the
Claude subscription on a real machine.

- **Where it runs:** normally a small Windows 11 Pro PC at home on wired internet that is never
  turned off. When David is traveling, his MacBook runs it instead.
- **How work reaches it:** admin (or Worker logic) queues jobs. The agent claims them, runs them
  and reports results back. It pulls work; nothing ever connects in to it.
- **Who controls it:** everything happens from the **Admin > CCG Agent** page: which machine is
  active, which code version runs, the job queue and logs.

### Tools (modules), in build order

| Module | Status | What it does |
|---|---|---|
| `system` | **Built** | Test jobs: `ping` (immediate echo) and `sleep` (long job for testing cancel and leases) |
| `fbm` | **Built, being live-tested (Phase 3)** | Facebook Marketplace. `fbm.add`: "Add to FBM" on the item page queues it, and the agent **publishes** with Playwright, ticks the 3 hard-coded Colorado music groups, and the Worker links the new listing ID. `fbm.update`: queued automatically when an item on FBM is saved with a changed title, description, price, video, brand, model, year, finish, quantity or shipping setting (not photos). See §3.7. Deletes come later |
| `reverb` | **Shell only** | Future Reverb deal finder: crawl the Reverb API, filter and score against comps, then have headless Claude Code (`claude -p`, on the Claude subscription) evaluate the shortlist and write results back to CCG |

---

## 2. Decisions made

1. **The Worker is the single system of record.** Jobs, results, logs, settings and instance
   state all live in D1. The agent keeps **no local data and no log files**; every start
   rebuilds its picture from the Worker.
   - Accepted local footprint: Python, the git checkout of this folder, its `.venv`, the instance
     key (environment variable or `.env`), the Claude Code login (later, for `reverb`) and the
     Facebook login.
2. **The Facebook login stays local on each machine.** It isn't stored on the server: Facebook
   ties sessions to a device and IP, so moving a session around triggers security checkpoints.
   The agent must detect "logged out", report `fb_login_needed` to admin, and hold FBM jobs.
   That status reporting is not built yet.
3. **FBM is Playwright only, with no Claude fallback.** If Playwright fails, the job fails, with
   the error and logs in admin.
4. **"Add to FBM" publishes.** Adding an item to CCG is the approval step. Settings for Facebook
   groups and shipping rules come with the FBM module.
5. **Instance keys, with one active at a time.** Each machine gets its own key, created in admin.
   Only the **active** instance claims jobs. Switching machines means clicking Activate on the
   other one. Inactive instances keep heartbeating so admin can see them.
6. **Remote updates are pull-based.** Admin holds a "desired version" (git branch, tag or full
   commit SHA). Launcher-managed instances switch to it on their own.
7. **Remote access to the home PC is RDP over Tailscale**, never with port 3389 open to the
   internet. Windows **Pro** is required to accept RDP connections.
8. **Code lives in the CCG repo** as this subfolder (`ccg-agent/`), not a separate repo. The PC
   does a sparse clone of only this folder.
9. **Language: Python.** It matches `ccg-fbm-sync` (Playwright, Python) so FBM code can be
   reused, and it behaves the same on macOS and Windows.

---

## 3. Architecture

```
 ┌──────────────── Admin (admin-v2-app) ────────────────┐
 │  CCG Agent page: instances · activate · version ·    │
 │  jobs (test ping / cancel / retry) · logs            │
 └──────────────┬───────────────────────────────────────┘
                │ /api/admin-v2/agent/*   (admin login cookie)
                ▼
 ┌──────────── Worker + D1 (listing-evaluator) ─────────┐
 │  src/agent/handlers.ts  ·  src/agent/store.ts        │
 │  agent_instances · agent_jobs · agent_logs ·         │
 │  agent_settings                                      │
 │  enqueueAgentJob() ◀── future: "Add to FBM", saves   │
 └──────────────▲───────────────────────────────────────┘
                │ /api/agent/*   (Authorization: Bearer ccga_… per instance)
                │ heartbeat · claim · complete · logs        (outbound HTTPS only)
 ┌──────────────┴──────── ccg-agent (this folder) ──────┐
 │  launcher.py  → venv + deps, runs agent, restarts    │
 │  ccg_agent/agent.py                                  │
 │    background thread: heartbeat, log shipping,       │
 │                       update check                   │
 │    main thread: claim → run module handler → report  │
 │  ccg_agent/modules/: system · reverb · (fbm next)    │
 └──────────────────────────────────────────────────────┘
```

### 3.1 Agent process (`ccg_agent/`)

| File | Role |
|---|---|
| `config.py` | Reads `CCG_AGENT_KEY` and `CCG_BASE_URL` (default `https://www.coalcreekguitars.com`) from the environment or `ccg-agent/.env`. `CCG_AGENT_MANAGED=1` (set by the launcher) turns on self-update |
| `api.py` | HTTP client. A 401 raises `InvalidKey`, a 423 raises `NotActive`, a 409 raises `NotClaimed`. One client per thread |
| `agent.py` | The loop. Its **background thread**, every 60s (every 15s while a job runs, or immediately when status changes): sends a heartbeat, which also renews the running job's lease and learns `active`, `desiredRef` and `currentJobCancelled`; ships logs every 5s; checks for updates when managed. Its **main thread**: when active, claims a job (or waits 20s when the queue is empty), runs the handler and reports the result. When inactive or the key is invalid, it just waits |
| `remote_log.py` | Logging to the console plus an in-memory buffer shipped to `/api/agent/logs`. Lines are tagged with the current job id. Transport errors log only to the console, so they can't feed back into the buffer |
| `version.py` | Git helpers: version string (short SHA, `-dirty` if `ccg-agent/` has edits), fetch a ref, check it contains `ccg-agent/launcher.py`, `checkout --force --detach` |
| `modules/base.py` | `Module` (a `name` plus `{job_type: handler}`) and `JobContext` (`payload`, `log`, `set_detail()`, `wait()`, `check_cancelled()`) |
| `modules/__init__.py` | Registry: add new modules here |
| `__main__.py` | `python -m ccg_agent`. Turns SIGTERM into the same clean shutdown as Ctrl+C |

Agent statuses sent in heartbeats: `starting`, `idle`, `working` (detail = job kind or progress
note), `inactive`, `invalid_key` (never reaches the server), `updating`, `stopped`. Planned:
`fb_login_needed`.

### 3.2 Launcher (`launcher.py`)

It uses only the standard library, so any Python 3.10+ can run it. It:
- creates `.venv` if missing and runs `pip install -r requirements.txt` on every (re)start;
- runs the agent with `CCG_AGENT_MANAGED=1`;
- on **exit 75** (the agent just checked out a new version), reinstalls dependencies and
  restarts it immediately;
- on any other exit, restarts with a backoff that starts at 15s and doubles up to 5 minutes.
  The backoff resets once the agent has run for 10 minutes;
- on Windows, is started by the Task Scheduler task "CCG Agent" at logon, in a visible console
  window.

### 3.3 Worker (`workers/listing-evaluator/src/agent/`)

The agent API is routed in `index.ts` **before** `requireAuth`, because it uses its own bearer
key. The admin API is routed **after** `requireAuth`, so it is protected by the admin login.

**Agent API** (POST; `Authorization: Bearer ccga_…`):

| Endpoint | Body → response |
|---|---|
| `/api/agent/heartbeat` | `{hostname, platform, version, managed, status, statusDetail, currentJobId, modules}` → `{instanceId, label, active, desiredRef, heartbeatSeconds, claimIntervalSeconds, currentJobCancelled, serverTime}` |
| `/api/agent/jobs/claim` | `{modules}` → `{job \| null}`. Returns **423** if this instance isn't active |
| `/api/agent/jobs/:id/complete` | `{status: 'done'\|'failed', result?, error?}`. Returns **409** if the job isn't claimed by this instance (cancelled or expired) |
| `/api/agent/logs` | `{entries: [{ts, level, message, jobId?}]}` (up to 200 per call) |

An unknown or deleted key gets **401 `invalid_key`**. Missing tables give **503 `missing_tables`**.

**Admin API** (admin login):

| Endpoint | Purpose |
|---|---|
| `GET /api/admin-v2/agent` | Instances, settings, job counts, heartbeat interval, server time |
| `POST /api/admin-v2/agent/instances` | `{label}` → `{instance, key}`. The key is returned **once** |
| `POST /api/admin-v2/agent/instances/:id/activate\|deactivate\|rename\|delete` | Manage instances. Activate deactivates all others in the same transaction. Delete revokes the key |
| `GET/POST /api/admin-v2/agent/jobs` | List jobs (`?status=&limit=`) or queue one (`{module, type, payload}`) |
| `POST /api/admin-v2/agent/jobs/:id/cancel\|retry` | Cancel a queued or running job. Retry queues a copy of a finished job |
| `GET /api/admin-v2/agent/logs` | `?instanceId=&jobId=&limit=` |
| `POST /api/admin-v2/agent/settings` | `{desiredRef}` |

**For other Worker code:** call `enqueueAgentJob(env, {module, type, payload, createdBy, dedupeKey, maxAttempts})`
from `store.ts`. `dedupeKey` ensures at most one queued or running job per key (for example
`fbm:item:123`), and a duplicate enqueue returns the existing job.

### 3.4 Data model (`d1-add-ccg-agent.sql`, applied to production 2026-11-24)

- **`agent_instances`**: `id`, `label`, `key_hash` (SHA-256; the key itself is never stored),
  `key_hint` (last 4 characters), `active`, heartbeat fields (`last_seen_at`, `hostname`,
  `platform`, `version`, `managed`, `status`, `status_detail`, `current_job_id`,
  `modules_json`). A partial unique index allows **at most one row with `active = 1`**.
- **`agent_jobs`**: `module`, `type`, `payload_json`, `status`
  (`queued → claimed → done | failed | cancelled`), `dedupe_key`, `attempts`, `max_attempts`
  (default **1**), `claimed_by`, `lease_expires_at`, `result_json`, `error`, plus timestamps.
- **`agent_logs`**: `instance_id`, `job_id`, `ts`, `level`, `message`. Lines older than 14
  days are pruned now and then on insert.
- **`agent_settings`**: key/value. `desired_ref` (default `main`).

All timestamps are Unix epoch milliseconds.

### 3.5 Key behaviors

- **Single active instance.** Only the active key can claim. A job already running when its
  instance is deactivated still **finishes and reports**: completing a job requires that this
  instance claimed it, not that it is still active. This avoids running the job twice.
- **Leases.** A claim sets a 5-minute lease, and every heartbeat renews it. Expired leases are
  swept whenever a job is claimed or the admin page loads. An expired job goes back in the queue
  if it has attempts left, otherwise it is marked **failed** with "Lease expired". The default of
  `max_attempts = 1` is deliberate: an FBM publish must never run twice by accident.
- **Cancel.** Admin marks the job `cancelled`. On its next heartbeat (within about 15s while
  working) the agent sees `currentJobCancelled` and sets the job's cancel event. Handlers stop at
  `ctx.wait()` or `ctx.check_cancelled()`, and the result isn't reported.
- **Self-update (managed instances only).** When `desiredRef` changes, and every 5 minutes, the
  agent runs `git fetch origin <ref>`. If the fetched commit differs from HEAD and contains
  `ccg-agent/launcher.py`, the agent waits until it is idle, runs `checkout --force --detach`,
  and exits 75. The launcher then reinstalls dependencies and restarts it. A ref without the
  agent folder is refused and logged. Dev runs (`python -m ccg_agent` without the launcher)
  never self-update.
- **Failure handling.** Invalid key: retry every 5 minutes. Heartbeat or claim network errors:
  retry every 30s. Reporting a result: up to 5 retries with backoff, after which the lease
  expiry marks the job failed.

### 3.6 Security notes

- Agent keys are `ccga_` followed by 32 random bytes in base64url. Only the SHA-256 hash is
  stored. Admin shows the full key once, at creation.
- A key can only heartbeat, claim and complete its own jobs, and write logs. It can't reach any
  admin endpoint.
- Nothing listens on the PC. Remote access is RDP over Tailscale only.

---

### 3.7 Facebook module (`ccg_agent/modules/fbm/`)

| File | Role |
|---|---|
| `browser.py` | Persistent Chromium profile at `~/.ccg-agent/fb-profile` (Windows: `%USERPROFILE%\.ccg-agent\fb-profile`), always headed. `check_login()` loads the create-listing form and checks for its photo input. `python -m ccg_agent fb-login` opens the profile for a person to log in; it waits for Facebook's session cookie without touching the page. Only one process can open the profile, so stop the agent first |
| `form.py` | Form helpers copied from `ccg-fbm-sync/fbm_client.py` on 2026-11-24, with the same selectors and quirks. Steps raise `FbmStepError` instead of pausing for Enter |
| `flows.py` | `publish_listing`: details → delivery → acts on whichever step shows (Allow offers is always turned off) → "List in more places" (groups found **by name**, since Facebook reorders them) → Publish, with the new ID read from Facebook's GraphQL response. `update_listing`: the edit page (`/marketplace/edit/?listing_id=`) → title, price, condition, description, delivery → Update/Save. **The edit flow hasn't been tested live yet.** |
| `__init__.py` | `FbmModule`: the login check (re-run every 30 minutes; every 5 minutes while failing), the `add` and `update` handlers, and a screenshot on any failure |

**Rules:**
- **Shipping and offers:** shipping uses "your own label" at the item's fixed cost, and is off for anything over $500 (Facebook's limit), which becomes local pickup only. Offers are always off.
- **Logged out:** if Facebook is logged out when a job starts, the job is **released** back to the queue without using an attempt. The instance then reports `fb_login_needed`, and admin shows a banner.
- **Publish never runs twice:** an `fbm.add` job has `max_attempts = 1`. If the item already has a listing ID when the job runs, the agent skips it. If Facebook published but the ID wasn't captured, the job fails with "paste the ID by hand; don't click Add to FBM again".
- **`fbm.update`:** queued by `queueFbmUpdateAfterSave` (in `src/agent/fbm.ts`) after a successful save, at most one queued per item, with 3 attempts. It is asynchronous, so a save never fails because of Facebook. A failed update shows "out of sync as of …" on the item page.
- **Missing group:** a group that can't be found is logged and listed under `groupsMissing` in the result. The listing is still published.

**Worker endpoints:**
- `POST /api/admin-v2/agent/fbm/items/:id/add` and `GET …/status` for the item page.
- `POST /api/agent/fbm/item` returns item data, but only for an item whose job this instance holds.
- `POST /api/agent/jobs/:id/release` and `…/screenshot` (stored in R2 under `agent/<jobId>/`). Admin views screenshots through `GET /api/admin-v2/agent/screenshot?key=`.

---

## 4. Testing on the MacBook (before the PC exists)

Prerequisites: the worker is deployed and the migration has run (both done 2026-11-24).

**1. Create a key in admin**
- Open **Admin → CCG Agent**. If the page shows an error, the worker deploy hasn't finished.
- Click **Add instance**, name it `MacBook`, and click **Copy**. The key is only shown once.

**2. Set up and start the agent in Terminal**
```bash
cd ~/Documents/Code/ccg/ccg-agent
cp .env.example .env
open -e .env          # replace the placeholder with your key, save, close
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m ccg_agent
```
You should see `CCG Agent … starting on …` and then `Instance 'MacBook' is not active —
standing by.` Leave that Terminal window open.

**3. Check it in admin** (the page refreshes every 10 seconds)

| Test | What to do | What should happen |
|---|---|---|
| Heartbeat | Just wait | MacBook shows **inactive**, "seen Xs ago", your Mac's name, and "dev run" |
| Activate | Click **Activate** | It gets the green **ACTIVE** chip, and Terminal prints "ACTIVE — will take jobs" |
| Ping | Click **Send test ping** | The job goes to **done** within about 20 seconds. Click the row to see the result and logs |
| Cancel | Click **Send 2-min job**, then **Cancel** while it shows **running** | Status shows "working" with a progress note, and the job stops within about 15 seconds |
| Switching keys | Add a second instance ("Home PC") and **Activate** it | MacBook drops to **inactive** and stops taking jobs. Switch back afterwards |
| Shutdown | Press **Ctrl+C** in Terminal | MacBook shows **offline** |
| Logs | Scroll down | Everything Terminal printed is also in the **Logs** box |

**Later:** to start the agent again, run
`cd ~/Documents/Code/ccg/ccg-agent && .venv/bin/python -m ccg_agent`.

**Testing the Worker locally** (no production data involved): run `wrangler dev --local
--persist-to <tmp dir>` with `--var AUTH_USER:test --var AUTH_SECRET:<x>`, apply
`d1-add-ccg-agent.sql` with `wrangler d1 execute listing_evaluator --local --persist-to <same dir>`,
insert an instance row whose `key_hash` is the SHA-256 of a test key, and point the agent at it
with `CCG_BASE_URL=http://localhost:8799`. Sign the admin cookie as `auth=test.<base64url HMAC-SHA256("test", secret)>`.

---

## 5. Setting up the home Windows PC

The full steps are in [README.md](README.md#set-up-the-windows-pc). In short:

- **Hardware/OS:** Windows 11 **Pro**, wired Ethernet, 16 GB RAM (Ryzen 5 / Core i5 class
  preferred for Playwright plus Claude Code).
- **BIOS:** restore on AC power loss = Power On.
- **Windows:** sleep set to Never, Windows Update active hours set, auto-login via `netplwiz`
  (browser automation needs a logged-in desktop).
- **Install:** `winget install Git.Git` and `Python.Python.3.13`, then run
  `scripts/install-windows.ps1 -Key ccga_…`. It sparse-clones to `%USERPROFILE%\ccg`, sets
  user environment variables, registers and starts the "CCG Agent" scheduled task.
- **Remote access:** Tailscale plus RDP. End a session with `scripts/rdp-disconnect.cmd` (run
  as administrator), not by closing the window, so the desktop stays unlocked for Playwright.

---

## 6. Adding a module

1. Create `ccg_agent/modules/<name>.py`: subclass `Module`, set `name` (lowercase; it must match
   `agent_jobs.module`), and return `{job_type: handler}`. A handler takes a `JobContext` and
   returns a JSON-serializable dict, or raises an exception to fail the job (the message becomes
   the job error in admin). Long handlers should call `ctx.wait()` or `ctx.check_cancelled()`
   between steps and `ctx.set_detail()` for progress.
2. Register it in `ccg_agent/modules/__init__.py`. Add any dependencies to `requirements.txt`;
   the launcher installs them on the next restart.
3. Queue jobs from the Worker with `enqueueAgentJob(...)`, or by hand from admin. Use
   `dedupeKey` for per-item jobs. Leave `maxAttempts` at 1 unless the job is safe to run twice.

An instance only claims modules that have at least one handler, so an empty shell like `reverb`
never takes jobs.

---

## 7. Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Worker: instances and keys, heartbeat, job queue, logs, admin page | **Done** |
| 2 | Agent: launcher, loop, key check, remote logging, self-update, Windows installer, `system` and `reverb` shell | **Done** |
| 3 | FBM: `fbm.add` (publish + 3 groups) and automatic `fbm.update`, Add to FBM button and out-of-sync warning, `fb-login`, screenshots | **Built; live-testing on the Mac** |
| 4 | `fbm.delete` when an item sells on any channel; shipping changes also synced to Reverb (GX done) | Planned |
| 5 | Harden the home PC: Tailscale, RDP, alerts | Planned |
| 6 | `reverb` deal finder: API crawl, comps, headless Claude Code evaluation, results stored in CCG | Planned |

## 8. Open questions

- **Facebook groups and shipping rules:** global defaults only, or a per-item override when
  clicking "Add to FBM"?
- **Pacing:** the maximum number of Facebook publishes per hour before it looks bot-like.
- **Alerts:** how to be notified of "FB login needed" or "agent offline". Admin banner only, or
  also email or text?
- **Failure screenshots:** upload a screenshot on job failure (the R2 `CUSTOM_ITEMS_BUCKET`
  under an `agent/` prefix)? Not built yet; useful once FBM runs.
