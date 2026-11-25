"""The agent loop.

Two threads:
  * background: heartbeat (reports status, renews the running job's lease, learns whether this
    instance is active, whether the running job was cancelled, and which version to run), ships
    log lines, and — for launcher-managed instances — checks for a new version.
  * main: when active, claims a job, runs it, reports the result; when not, waits.

Nothing is persisted locally: every start rebuilds its picture from the Worker.
"""
from __future__ import annotations

import logging
import platform
import socket
import threading
import time
from typing import Any

from . import remote_log, version
from .api import AgentApi, InvalidKey, NotActive, NotClaimed
from .config import EXIT_UPDATED, Config
from .modules import load_modules
from .modules.base import JobCancelled, JobContext, ModuleUnavailable

log = logging.getLogger("ccg_agent")
local_log = remote_log.local_log

UPDATE_CHECK_SECONDS = 300
LOG_FLUSH_SECONDS = 5
INVALID_KEY_RETRY_SECONDS = 300
WORKING_HEARTBEAT_SECONDS = 15  # faster while a job runs, so Cancel in Admin lands quickly
NETWORK_RETRY_SECONDS = 30


class Agent:
    def __init__(self, config: Config):
        self.config = config
        self.version = version.version_string()
        self.modules = load_modules()
        self.handlers = {(m.name, t): h for m in self.modules for t, h in m.handlers().items()}
        self.claim_modules = sorted({m for m, _ in self.handlers})
        # name -> [available, reason, monotonic time of next check]
        self.availability: dict[str, list[Any]] = {name: [True, None, 0.0] for name in self.claim_modules}

        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.heartbeat_now = threading.Event()
        self.first_heartbeat = threading.Event()

        self.status = "starting"
        self.detail: str | None = None
        self.current_job_id: str | None = None
        self.cancel_event: threading.Event | None = None

        self.active: bool | None = None
        self.key_invalid = False
        self.label: str | None = None
        self.heartbeat_seconds = 60
        self.claim_interval = 20
        self.desired_ref: str | None = None

        self.pending_commit: str | None = None
        self._checked_ref: str | None = None
        self._next_update_check = 0.0
        self._bad_commits: set[str] = set()

    # ------------------------------------------------------------------ state

    def _set_status(self, status: str, detail: str | None = None) -> None:
        with self.lock:
            changed = (status, detail) != (self.status, self.detail)
            self.status, self.detail = status, detail
        if changed:
            self.heartbeat_now.set()

    def _set_detail(self, detail: str | None) -> None:
        with self.lock:
            self.detail = detail

    def _heartbeat_body(self) -> dict[str, Any]:
        with self.lock:
            return {
                "hostname": socket.gethostname(),
                "platform": f"{platform.system()} {platform.release()} / Python {platform.python_version()}",
                "version": self.version,
                "managed": self.config.managed,
                "status": self.status,
                "statusDetail": self.detail,
                "currentJobId": self.current_job_id,
                "modules": [m.name for m in self.modules],
            }

    # ------------------------------------------------------------------ background thread

    def _background(self) -> None:
        api = AgentApi(self.config, timeout=20)
        next_heartbeat = 0.0
        next_flush = 0.0
        while not self.stop.is_set():
            now = time.monotonic()
            if now >= next_heartbeat or self.heartbeat_now.is_set():
                self.heartbeat_now.clear()
                next_heartbeat = now + self._heartbeat(api)
            if now >= next_flush:
                remote_log.flush(api)
                next_flush = now + LOG_FLUSH_SECONDS
            self.stop.wait(1)

    def _heartbeat(self, api: AgentApi) -> float:
        """Returns seconds until the next heartbeat."""
        try:
            resp = api.heartbeat(self._heartbeat_body())
        except InvalidKey:
            if not self.key_invalid:
                local_log.error(
                    "The Worker rejected this agent key (unknown or deleted in Admin). "
                    "Retrying every %s minutes.", INVALID_KEY_RETRY_SECONDS // 60,
                )
            self.key_invalid = True
            self.active = False
            self.first_heartbeat.set()
            return INVALID_KEY_RETRY_SECONDS
        except Exception as exc:
            local_log.warning("Heartbeat failed (%s); retrying in %ss.", exc, NETWORK_RETRY_SECONDS)
            return NETWORK_RETRY_SECONDS

        if self.key_invalid:
            local_log.info("Agent key accepted again.")
        self.key_invalid = False
        active = bool(resp.get("active"))
        if active != self.active:
            log.info(
                "Instance '%s' is %s.", resp.get("label"),
                "ACTIVE — will take jobs" if active else "not active — standing by",
            )
        self.active = active
        self.label = resp.get("label")
        self.heartbeat_seconds = int(resp.get("heartbeatSeconds") or 60)
        self.claim_interval = int(resp.get("claimIntervalSeconds") or 20)
        if resp.get("currentJobCancelled"):
            with self.lock:
                if self.cancel_event and not self.cancel_event.is_set():
                    log.warning("Admin cancelled the running job; stopping it.")
                    self.cancel_event.set()
        self.desired_ref = resp.get("desiredRef") or None
        self.first_heartbeat.set()
        self._maybe_check_for_update()
        with self.lock:
            working = self.current_job_id is not None
        return min(self.heartbeat_seconds, WORKING_HEARTBEAT_SECONDS) if working else self.heartbeat_seconds

    def _maybe_check_for_update(self) -> None:
        if not self.config.managed or self.pending_commit or not self.desired_ref:
            return
        ref = self.desired_ref
        if ref == self._checked_ref and time.monotonic() < self._next_update_check:
            return
        self._checked_ref = ref
        self._next_update_check = time.monotonic() + UPDATE_CHECK_SECONDS
        try:
            target = version.fetch_ref(ref)
        except Exception as exc:
            log.warning("Couldn't fetch version '%s' from git: %s", ref, exc)
            return
        if target == version.current_commit() or target in self._bad_commits:
            return
        if not version.has_agent(target):
            self._bad_commits.add(target)
            log.error("Version '%s' (%s) has no ccg-agent folder; not switching to it.", ref, target[:10])
            return
        log.info("New version available: '%s' (%s). Will update when idle.", ref, target[:10])
        self.pending_commit = target

    # ------------------------------------------------------------------ main loop

    def run(self) -> int:
        remote_log.setup_logging()
        log.info(
            "CCG Agent %s starting on %s (%s). Modules: %s. Self-update: %s.",
            self.version, socket.gethostname(), platform.system(),
            ", ".join(m.name for m in self.modules), "on" if self.config.managed else "off (dev run)",
        )
        threading.Thread(target=self._background, name="ccg-agent-bg", daemon=True).start()
        api = AgentApi(self.config, timeout=60)
        try:
            while not self.first_heartbeat.wait(1):
                pass
            return self._main_loop(api)
        except KeyboardInterrupt:
            log.info("Stopping (Ctrl+C).")
            return 0
        finally:
            self._shutdown()

    def _main_loop(self, api: AgentApi) -> int:
        while not self.stop.is_set():
            if self.pending_commit:
                code = self._apply_update()
                if code is not None:
                    return code
                continue
            if self.key_invalid:
                self._set_status("invalid_key")
                self.stop.wait(15)
                continue
            if not self.active:
                self._set_status("inactive")
                self.stop.wait(15)
                continue
            claimable = self._claimable_modules()
            blocked = [m for m in self.modules if m.name in self.availability and not self.availability[m.name][0]]
            if blocked:
                self._set_status(blocked[0].unavailable_status, self.availability[blocked[0].name][1])
            else:
                self._set_status("idle")
            if not claimable:
                self.stop.wait(self.claim_interval)
                continue
            try:
                job = api.claim(claimable)
            except NotActive:
                if self.active:
                    log.info("Instance '%s' is not active — standing by.", self.label)
                self.active = False
                continue
            except InvalidKey:
                self.key_invalid = True
                continue
            except Exception as exc:
                local_log.warning("Claim failed (%s); retrying in %ss.", exc, NETWORK_RETRY_SECONDS)
                self.stop.wait(NETWORK_RETRY_SECONDS)
                continue
            if job:
                self._run_job(api, job)
            else:
                self.stop.wait(self.claim_interval)
        return 0

    def _claimable_modules(self) -> list[str]:
        """Re-checks module availability when due (on this thread: checks may drive a browser)."""
        now = time.monotonic()
        for module in self.modules:
            state = self.availability.get(module.name)
            if state is None or now < state[2]:
                continue
            try:
                ok, reason = module.check_available()
            except Exception as exc:
                ok, reason = False, f"{type(exc).__name__}: {exc}"
            if (ok, reason) != (state[0], state[1]):
                if ok:
                    log.info("Module '%s' is available again.", module.name)
                else:
                    log.warning("Module '%s' can't take jobs: %s", module.name, reason)
            state[0], state[1] = ok, reason
            state[2] = now + (module.availability_check_seconds if ok else 300)
        return [name for name in self.claim_modules if self.availability[name][0]]

    def _run_job(self, api: AgentApi, job: dict[str, Any]) -> None:
        job_id, kind = job["id"], f"{job['module']}.{job['type']}"
        cancel = threading.Event()
        with self.lock:
            self.current_job_id = job_id
            self.cancel_event = cancel
        self._set_status("working", kind)  # also triggers an immediate heartbeat
        token = remote_log.current_job_id.set(job_id)
        started = time.monotonic()
        log.info("Job %s started: %s (attempt %s of %s).", job_id[:8], kind, job.get("attempts"), job.get("maxAttempts"))

        status, result, error = "failed", None, None
        ctx = None
        try:
            handler = self.handlers.get((job["module"], job["type"]))
            if handler is None:
                raise RuntimeError(f"This agent version can't run '{kind}' jobs.")
            ctx = JobContext(job=job, log=logging.getLogger(f"ccg_agent.{job['module']}"), api=api,
                             _cancel=cancel, _set_detail=self._set_detail)
            result = handler(ctx)
            status = "done"
            log.info("Job %s done in %.1fs.", job_id[:8], time.monotonic() - started)
        except ModuleUnavailable as exc:
            log.warning("Job %s: module '%s' unavailable (%s); putting the job back in the queue.",
                        job_id[:8], job["module"], exc)
            state = self.availability.get(job["module"])
            if state is not None:
                state[0], state[1], state[2] = False, str(exc), time.monotonic() + 300
            status = "released"
        except JobCancelled:
            error = "Cancelled in Admin."
            log.warning("Job %s cancelled after %.1fs.", job_id[:8], time.monotonic() - started)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            log.exception("Job %s failed.", job_id[:8])
        finally:
            remote_log.current_job_id.reset(token)

        if ctx is not None and ctx.screenshots:
            result = dict(result or {}) if isinstance(result, dict) or result is None else {"value": result}
            result["screenshots"] = ctx.screenshots
        if status == "released":
            try:
                api.release(job_id)
            except Exception as exc:
                log.warning("Couldn't release job %s (%s); its lease will expire instead.", job_id[:8], exc)
        elif not cancel.is_set():
            self._report(api, job_id, status, result, error)
        with self.lock:
            self.current_job_id = None
            self.cancel_event = None
        self._set_status("idle")

    def _report(self, api: AgentApi, job_id: str, status: str, result: Any, error: str | None) -> None:
        for attempt in range(5):
            try:
                api.complete(job_id, status, result, error)
                return
            except NotClaimed:
                log.warning("Job %s: result not recorded — it's no longer ours (cancelled or lease expired).", job_id[:8])
                return
            except Exception as exc:
                local_log.warning("Reporting job %s failed (%s); retrying.", job_id[:8], exc)
                self.stop.wait(min(60, 5 * 2 ** attempt))
        log.error("Gave up reporting job %s; its lease will expire and Admin will show it failed.", job_id[:8])

    def _apply_update(self) -> int | None:
        commit = self.pending_commit or ""
        self._set_status("updating", commit[:10])
        log.info("Updating to %s and restarting.", commit[:10])
        try:
            version.checkout(commit)
        except Exception as exc:
            log.error("Update to %s failed: %s", commit[:10], exc)
            self._bad_commits.add(commit)
            self.pending_commit = None
            return None
        return EXIT_UPDATED

    def _shutdown(self) -> None:
        if self.status != "updating":
            self._set_status("stopped")
        self.stop.set()
        try:
            api = AgentApi(self.config, timeout=10)
            api.heartbeat(self._heartbeat_body())
            remote_log.flush(api)
        except Exception:
            pass
