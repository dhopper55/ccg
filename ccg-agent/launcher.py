"""CCG Agent launcher: the one thing the always-on PC starts at logon.

  python launcher.py

Uses only the standard library, so any Python 3.10+ can run it. It:
  1. makes sure ccg-agent/.venv exists and has requirements.txt installed,
  2. runs the agent (`.venv python -m ccg_agent`) with CCG_AGENT_MANAGED=1 so it self-updates,
  3. when the agent exits with code 75 (it just checked out a new version), reinstalls
     dependencies and starts it again; on a crash, waits (backing off up to 5 min) and restarts.
Ctrl+C stops everything.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import venv
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent
VENV_DIR = AGENT_DIR / ".venv"
EXIT_UPDATED = 75  # keep in sync with ccg_agent/config.py
MAX_BACKOFF = 300


def say(message: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} [launcher] {message}", flush=True)


def venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def ensure_environment() -> None:
    if not venv_python().exists():
        say(f"Creating virtual environment in {VENV_DIR} ...")
        venv.EnvBuilder(with_pip=True).create(VENV_DIR)
    say("Installing/updating dependencies ...")
    subprocess.run(
        [str(venv_python()), "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
         "-r", str(AGENT_DIR / "requirements.txt")],
        check=True,
    )
    # Browser for the Facebook module (no-op when already installed).
    subprocess.run([str(venv_python()), "-m", "playwright", "install", "chromium"], check=True)


def run_agent() -> int:
    env = dict(os.environ, CCG_AGENT_MANAGED="1", PYTHONUNBUFFERED="1")
    proc = subprocess.Popen([str(venv_python()), "-m", "ccg_agent"], cwd=str(AGENT_DIR), env=env)
    try:
        return proc.wait()
    except KeyboardInterrupt:
        # The agent got the same Ctrl+C and shuts down on its own; give it a moment.
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
        raise


def main() -> int:
    say(f"Starting CCG Agent launcher in {AGENT_DIR}")
    backoff = 15
    needs_install = True
    while True:
        try:
            if needs_install:
                ensure_environment()
                needs_install = False
            started = time.monotonic()
            code = run_agent()
        except KeyboardInterrupt:
            say("Stopped.")
            return 0
        except Exception as exc:  # e.g. pip couldn't reach the internet after a power cut
            say(f"Setup failed: {exc}. Retrying in {backoff}s.")
            code = -1
            started = time.monotonic()

        if code == EXIT_UPDATED:
            say("Agent updated itself; reinstalling dependencies and restarting.")
            needs_install = True
            backoff = 15
            continue
        if code == 0:
            say("Agent exited normally. Restarting in 5s (close this window to stop).")
            time.sleep(5)
            continue
        if time.monotonic() - started > 600:
            backoff = 15  # it ran fine for a while; this is a fresh failure
        say(f"Agent exited with code {code}. Restarting in {backoff}s.")
        try:
            time.sleep(backoff)
        except KeyboardInterrupt:
            say("Stopped.")
            return 0
        backoff = min(MAX_BACKOFF, backoff * 2)


if __name__ == "__main__":
    sys.exit(main())
