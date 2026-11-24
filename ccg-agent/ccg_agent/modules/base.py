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


@dataclass
class JobContext:
    job: dict[str, Any]
    log: logging.Logger
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

    def set_detail(self, text: str | None) -> None:
        """Short progress note shown next to the instance in Admin (sent with the heartbeat)."""
        self._set_detail(text)


Handler = Callable[[JobContext], dict[str, Any]]


class Module:
    name: str = ""

    def handlers(self) -> dict[str, Handler]:
        return {}
