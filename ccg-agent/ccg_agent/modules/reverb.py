"""Reverb deal finder — placeholder. No job types yet, so this instance never claims reverb jobs."""
from __future__ import annotations

from .base import Handler, Module


class ReverbModule(Module):
    name = "reverb"

    def handlers(self) -> dict[str, Handler]:
        return {}
