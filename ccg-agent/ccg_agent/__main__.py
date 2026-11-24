"""Run the agent directly (dev mode, no self-update):  python -m ccg_agent
The launcher runs it the same way with CCG_AGENT_MANAGED=1."""
from __future__ import annotations

import signal
import sys

from .agent import Agent
from .config import load_config


def _stop_on_sigterm(_signum, _frame):
    raise KeyboardInterrupt  # same clean shutdown as Ctrl+C


def main() -> int:
    signal.signal(signal.SIGTERM, _stop_on_sigterm)
    return Agent(load_config()).run()


if __name__ == "__main__":
    sys.exit(main())
