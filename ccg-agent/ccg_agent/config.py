"""Agent configuration: just the Worker URL and this instance's key.

Read from environment variables. For convenience on the MacBook, a git-ignored `.env` file in
the ccg-agent folder is also read (environment variables win). Nothing else is stored locally.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent      # .../ccg-agent
REPO_DIR = AGENT_DIR.parent                              # git checkout root
DEFAULT_BASE_URL = "https://www.coalcreekguitars.com"

# Exit code the agent uses to ask the launcher to reinstall dependencies and restart it
# (after it has checked out a new version). Anything else non-zero is treated as a crash.
EXIT_UPDATED = 75


def _read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


@dataclass(frozen=True)
class Config:
    base_url: str
    agent_key: str
    managed: bool  # True when started by launcher.py: allowed to self-update


def load_config() -> Config:
    dotenv = _read_dotenv(AGENT_DIR / ".env")

    def get(name: str, default: str = "") -> str:
        return os.environ.get(name) or dotenv.get(name) or default

    key = get("CCG_AGENT_KEY")
    if not key.startswith("ccga_"):
        raise SystemExit(
            "CCG_AGENT_KEY is not set (or doesn't look like an agent key). Create an instance in "
            "Admin > CCG Agent, then set CCG_AGENT_KEY in the environment or in ccg-agent/.env."
        )
    return Config(
        base_url=get("CCG_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        agent_key=key,
        managed=os.environ.get("CCG_AGENT_MANAGED") == "1",
    )
