"""Module registry. To add a tool: write a Module subclass and list it here."""
from __future__ import annotations

from .base import Module
from .eval_claude import EvalModule
from .fbm import FbmModule  # noqa: F401  (paused, see load_modules)
from .reverb import ReverbModule
from .system import SystemModule


def load_modules() -> list[Module]:
    # FbmModule is paused (2026-11-25, see ARCHITECTURE.md §0). Add it back here to resume; while
    # it's loaded it opens a browser every 30 minutes to check the Facebook login.
    return [SystemModule(), EvalModule(), ReverbModule()]
