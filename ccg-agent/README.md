# CCG Agent

An always-on local worker (the home Windows PC, or the MacBook while traveling) that runs jobs
queued in CCG. Tools ("modules") plug into it: `system` (test jobs) today, `fbm` next, `reverb`
later.

```
Admin (CCG Agent page)  ──queue jobs / activate keys / set version──▶  Worker + D1
                                                                         ▲   │
                                       heartbeat · claim · complete · logs   │ { active, desiredRef,
                                                                         │   ▼   cancel, job }
                                                              ccg-agent (this folder)
```

## Principles

- **The Worker is the system of record.** The agent keeps no local data and no log files; each
  start rebuilds everything from the Worker. Local machine holds only: Python, this code, its
  `.venv`, the instance key (env var / `.env`) and — later — the Facebook login.
- **One active instance.** Every machine gets its own key (Admin > CCG Agent > Add instance).
  Only the instance marked Active claims jobs; the others keep heartbeating so you can see them.
  Switching machines = Activate the other one. A job already running finishes and reports even if
  its instance was just deactivated.
- **Unknown/deleted key** → the agent logs it and retries every 5 minutes. **Network down** →
  retries every 30s.
- **Leases.** A claimed job is kept alive by heartbeats. If the machine dies mid-job, the lease
  expires after 5 minutes and the job fails (or re-queues if its `maxAttempts` allows).
- **Cancel** in Admin stops a running job within ~15s (handlers call `ctx.wait()` /
  `ctx.check_cancelled()` between steps).

## Run on the MacBook (dev)

```bash
cd ccg-agent
cp .env.example .env          # paste the instance key from Admin
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m ccg_agent # Ctrl+C to stop
```

A direct run like this never self-updates (Admin shows it as "dev run"), so local edits are safe.

## Set up the Windows PC

1. **Windows 11 Pro** (needed for RDP). Settings:
   - BIOS/UEFI: *Restore on AC power loss* = **Power On**.
   - Power: sleep **Never**. Windows Update: set active hours.
   - Auto-login (the browser automation needs a logged-in desktop): run `netplwiz`, untick
     *Users must enter a user name and password* (if the box is missing, first turn off
     *Settings > Accounts > Sign-in options > For improved security, only allow Windows Hello*).
2. Install tools, then open a **new** PowerShell window:
   ```powershell
   winget install --id Git.Git -e
   winget install --id Python.Python.3.13 -e
   ```
3. In Admin > CCG Agent, **Add instance** "Home PC" and copy its key.
4. Download `scripts/install-windows.ps1` from GitHub and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File install-windows.ps1 -Key ccga_... -Ref ccg-agent-foundation
   ```
   (Use `-Ref main` once this is merged.) It sparse-clones only `ccg-agent/` into `%USERPROFILE%\ccg`,
   stores the key as a user environment variable, and registers a **CCG Agent** scheduled task
   that starts `launcher.py` at logon in a visible console window.
5. Back in Admin, the instance appears within a minute. Click **Activate**, then **Send test ping**.

### Remote access (RDP)

- Install [Tailscale](https://tailscale.com) on the PC and the laptop; RDP to the PC's Tailscale
  name. Never expose port 3389 to the internet.
- Enable Remote Desktop: *Settings > System > Remote Desktop*.
- **Leaving an RDP session:** don't just close the window (that locks the desktop and can break
  browser automation). Run `scripts/rdp-disconnect.cmd` *as administrator* instead — it hands the
  still-logged-in session back to the PC's console. A desktop shortcut with "Run as administrator"
  ticked is easiest.

## Updating remotely

Admin > CCG Agent > **Agent version** holds a git branch, tag or full commit SHA. Launcher-managed
instances check it on heartbeat (and every 5 minutes); when it points at a different commit they
finish the current job, `git checkout` it, exit with code 75, and the launcher reinstalls
`requirements.txt` and restarts them. Roll back by setting the old ref. A ref that doesn't contain
`ccg-agent/launcher.py` is refused.

So the flow from anywhere is: push your change → set the version in Admin (or leave it on the
branch name, and every push to that branch rolls out within ~5 minutes).

## Adding a tool

1. `ccg_agent/modules/<name>.py`: subclass `Module`, set `name`, return `{job_type: handler}`.
   A handler takes a `JobContext` (`ctx.payload`, `ctx.log`, `ctx.set_detail()`, `ctx.wait()`,
   `ctx.check_cancelled()`) and returns a JSON-able dict, or raises to fail the job.
2. Register it in `ccg_agent/modules/__init__.py`.
3. Queue jobs from the Worker with `enqueueAgentJob(env, { module, type, payload, dedupeKey })`
   (`workers/listing-evaluator/src/agent/store.ts`). Jobs default to `maxAttempts: 1` — only raise
   it for jobs that are safe to run twice.

## Files

| Path | What |
|---|---|
| `launcher.py` | Supervisor (stdlib only): venv + deps, runs the agent, restarts on crash/update |
| `ccg_agent/agent.py` | Heartbeat/log thread + claim-run-report loop |
| `ccg_agent/api.py` | Worker client (`/api/agent/*`) |
| `ccg_agent/remote_log.py` | Console + shipped-to-Worker logging |
| `ccg_agent/version.py` | Git version / self-update helpers |
| `ccg_agent/modules/` | Tools |
| `scripts/install-windows.ps1` | One-time Windows setup |
| `scripts/rdp-disconnect.cmd` | End RDP without locking the console |

Worker side: `workers/listing-evaluator/src/agent/` · tables: `d1-add-ccg-agent.sql` ·
Admin page: `admin-v2-app/src/pages/ccg-agent/CcgAgent.tsx`.
