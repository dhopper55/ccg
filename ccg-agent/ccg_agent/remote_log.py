"""Logging: every line goes to the console and is shipped to the Worker (Admin > CCG Agent > Logs).

There are no local log files. Lines are buffered in memory and flushed by the background
thread; if the Worker is unreachable the buffer is capped so memory can't grow forever.
"""
from __future__ import annotations

import contextvars
import logging
import sys
import threading
import time
from collections import deque
from typing import Any

current_job_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_job_id", default=None)

MAX_BUFFER = 2000
BATCH = 200

log = logging.getLogger("ccg_agent")
# Transport problems with shipping logs go here: console only, never shipped (no feedback loop).
local_log = logging.getLogger("ccg_agent.local")


class _RemoteBufferHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.INFO)
        self.buffer: deque[dict[str, Any]] = deque(maxlen=MAX_BUFFER)
        self._buffer_lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        if record.name.startswith("ccg_agent.local"):
            return
        try:
            message = record.getMessage()
            if record.exc_info:
                message += "\n" + logging.Formatter().formatException(record.exc_info)
            entry = {
                "ts": int(record.created * 1000),
                "level": record.levelname,
                "message": message[:4000],
                "jobId": getattr(record, "job_id", None),
            }
            with self._buffer_lock:
                self.buffer.append(entry)
        except Exception:  # never let logging break the agent
            self.handleError(record)

    def take(self, n: int) -> list[dict[str, Any]]:
        with self._buffer_lock:
            return [self.buffer.popleft() for _ in range(min(n, len(self.buffer)))]

    def put_back(self, entries: list[dict[str, Any]]) -> None:
        with self._buffer_lock:
            self.buffer.extendleft(reversed(entries))


class _JobIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "job_id"):
            record.job_id = current_job_id.get()
        return True


remote_handler = _RemoteBufferHandler()


def setup_logging() -> None:
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(message)s", "%H:%M:%S"))
    root = logging.getLogger("ccg_agent")
    root.setLevel(logging.INFO)
    root.handlers.clear()
    root.addHandler(console)
    root.addHandler(remote_handler)
    root.propagate = False
    remote_handler.addFilter(_JobIdFilter())


def flush(api: Any) -> None:
    """Ship buffered lines. On failure they go back on the buffer for the next try."""
    while True:
        entries = remote_handler.take(BATCH)
        if not entries:
            return
        try:
            api.send_logs(entries)
        except Exception as exc:
            remote_handler.put_back(entries)
            local_log.warning("Couldn't ship logs to the Worker (%s); will retry.", exc)
            return
        time.sleep(0)  # yield between batches
