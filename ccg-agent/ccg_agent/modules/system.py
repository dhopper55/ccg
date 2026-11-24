"""Built-in jobs for checking the plumbing end to end from Admin."""
from __future__ import annotations

import platform
import socket
import time
from typing import Any

from ..version import version_string
from .base import Handler, JobContext, Module


class SystemModule(Module):
    name = "system"

    def handlers(self) -> dict[str, Handler]:
        return {"ping": self.ping, "sleep": self.sleep}

    def ping(self, ctx: JobContext) -> dict[str, Any]:
        """Answers immediately: proves claim -> run -> complete works."""
        ctx.log.info("Pong from %s.", socket.gethostname())
        return {
            "pong": True,
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "python": platform.python_version(),
            "version": version_string(),
            "agentTime": int(time.time() * 1000),
            "echo": ctx.payload,
        }

    def sleep(self, ctx: JobContext) -> dict[str, Any]:
        """Runs for payload.seconds (default 120, max 1800): for testing lease renewal and Cancel."""
        seconds = max(1, min(1800, int(ctx.payload.get("seconds", 120))))
        ctx.log.info("Sleeping %ss.", seconds)
        for elapsed in range(0, seconds, 5):
            ctx.set_detail(f"slept {elapsed}s of {seconds}s")
            ctx.wait(min(5, seconds - elapsed))
        return {"slept": seconds}
