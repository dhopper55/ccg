"""Git helpers: what version is running, and moving to the version Admin asks for.

The agent's "version" is the git commit it's running from. Admin sets a desired ref (branch,
tag or full commit SHA); launcher-managed instances fetch it and switch when it differs.
"""
from __future__ import annotations

import subprocess

from .config import REPO_DIR

AGENT_MARKER = "ccg-agent/launcher.py"  # a ref without this file can't run the agent


def _git(*args: str, timeout: float = 120) -> str:
    out = subprocess.run(
        ["git", "-C", str(REPO_DIR), *args],
        capture_output=True, text=True, timeout=timeout, check=True,
    )
    return out.stdout.strip()


def current_commit() -> str | None:
    try:
        return _git("rev-parse", "HEAD")
    except Exception:
        return None


def version_string() -> str:
    """Short SHA, plus '-dirty' when there are local edits under ccg-agent/."""
    sha = current_commit()
    if not sha:
        return "unknown"
    try:
        dirty = bool(_git("status", "--porcelain", "--", "ccg-agent"))
    except Exception:
        dirty = False
    return sha[:10] + ("-dirty" if dirty else "")


def fetch_ref(ref: str) -> str:
    """Fetch `ref` from origin and return the commit it points to."""
    _git("fetch", "--quiet", "origin", ref)
    return _git("rev-parse", "FETCH_HEAD")


def has_agent(commit: str) -> bool:
    try:
        _git("cat-file", "-e", f"{commit}:{AGENT_MARKER}")
        return True
    except Exception:
        return False


def checkout(commit: str) -> None:
    """Switch the working tree to `commit` (detached), discarding local edits."""
    _git("checkout", "--quiet", "--force", "--detach", commit)
