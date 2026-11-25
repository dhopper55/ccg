"""What a tool ("module") looks like to the agent.

A module has a name (matching agent_jobs.module in the Worker) and a map of job type -> handler.
A handler gets a JobContext and returns a JSON-serializable result dict, or raises to fail the
job (the exception message becomes the job's error in Admin).
"""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Callable


class JobCancelled(Exception):
    """Raised by JobContext.check_cancelled() when Admin cancelled the running job."""


class ModuleUnavailable(Exception):
    """Raise from a handler BEFORE changing anything external (e.g. Facebook turned out to be
    logged out). The job goes back to the queue without using an attempt, and the module stops
    claiming jobs until check_available() passes again."""


@dataclass
class JobContext:
    job: dict[str, Any]
    log: logging.Logger
    api: Any = None  # AgentApi for the main thread (module calls such as api.fbm_item)
    screenshots: list[str] = field(default_factory=list)  # R2 keys, reported with the result
    _cancel: threading.Event = field(default_factory=threading.Event)
    _set_detail: Callable[[str | None], None] = lambda _detail: None

    @property
    def id(self) -> str:
        return self.job["id"]

    @property
    def payload(self) -> dict[str, Any]:
        payload = self.job.get("payload")
        return payload if isinstance(payload, dict) else {}

    def cancelled(self) -> bool:
        return self._cancel.is_set()

    def check_cancelled(self) -> None:
        """Call between steps of long jobs so a cancel in Admin stops them promptly."""
        if self._cancel.is_set():
            raise JobCancelled("Cancelled in Admin.")

    def wait(self, seconds: float) -> None:
        """Sleep that wakes up early (and raises) if the job is cancelled."""
        if self._cancel.wait(seconds):
            raise JobCancelled("Cancelled in Admin.")

    def screenshot(self, page: Any, label: str = "") -> None:
        """Best-effort: capture a Playwright page and upload it to the Worker (shown in Admin)."""
        try:
            key = self.api.upload_screenshot(self.id, page.screenshot(full_page=False))
            self.screenshots.append(key)
            self.log.info("Screenshot saved%s.", f" ({label})" if label else "")
        except Exception as exc:
            self.log.warning("Couldn't save a screenshot: %s", exc)

    def set_detail(self, text: str | None) -> None:
        """Short progress note shown next to the instance in Admin (sent with the heartbeat)."""
        self._set_detail(text)


Handler = Callable[[JobContext], dict[str, Any]]


class Module:
    name: str = ""
    # How often to re-run check_available() while it's passing (it always re-runs when failing).
    availability_check_seconds: float = 1800
    unavailable_status: str = "unavailable"

    def handlers(self) -> dict[str, Handler]:
        return {}

    def check_available(self) -> tuple[bool, str | None]:
        """Can this module take jobs right now? Runs on the main thread between jobs.
        Return (False, reason) to stop claiming this module's jobs (they wait in the queue)."""
        return True, None
