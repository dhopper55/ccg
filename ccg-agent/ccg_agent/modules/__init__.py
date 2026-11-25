"""Module registry. To add a tool: write a Module subclass and list it here."""
from __future__ import annotations

from .base import Module
from .fbm import FbmModule
from .reverb import ReverbModule
from .system import SystemModule


def load_modules() -> list[Module]:
    return [SystemModule(), FbmModule(), ReverbModule()]
