"""Automatic evals: runs Claude Code headless on the owner's Claude SUBSCRIPTION.

eval.drain = what typing "eval" in Claude Desktop does: Claude uses the CCG Eval connector
(get_next_queued_item -> photos -> save -> next) until the queue is empty or the run's item
limit is hit. The Worker decides the model and the limit per run (POST /api/agent/eval/config,
set in Admin > Settings > System > Claude eval).

Subscription, not API credits: Claude Code bills the API instead of the subscription when it
sees ANTHROPIC_API_KEY (or similar) in its environment, so those are always removed before it
starts. One-time setup per machine: install Claude Code and run `claude` once to log in with the
subscription account. The CCG Eval connector comes with the claude.ai login.

Claude Code is limited to the CCG Eval connector: no shell, file or web tools, run from an
empty temp folder.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

from .base import Handler, JobCancelled, JobContext, Module, ModuleUnavailable

CONNECTOR_TOOL_PREFIX = "mcp__claude_ai_CCG_Eval"
SAVE_TOOLS = ("save_listing_evaluation", "save_inventory_evaluation")
SKIP_TOOL = "skip_queued_item"
# Built-in tools Claude Code must not use during an eval (ToolSearch stays allowed: it's how
# Claude loads the connector's tools). Read-only file tools are blocked too (Glob was seen
# used, harmlessly, on 2026-11-25).
BLOCKED_BUILTIN_TOOLS = (
    "Bash,Edit,Write,MultiEdit,NotebookEdit,WebFetch,WebSearch,Task,Agent,"
    "Read,Glob,Grep,LS,TodoWrite"
)
# Anything that would make Claude Code use paid API credits or another provider.
API_ENV_VARS = (
    "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY",
)
QUEUE_EMPTY_RE = re.compile(r'queue_empty\W{0,6}true', re.I)
USAGE_LIMIT_HINTS = ("usage limit", "limit reached", "rate limit", "limit will reset")


def find_claude() -> str | None:
    found = shutil.which("claude")
    if found:
        return found
    home = Path.home()
    for candidate in (
        home / ".claude" / "local" / "claude",
        home / ".local" / "bin" / "claude",
        home / ".local" / "bin" / "claude.exe",
        Path(os.environ.get("APPDATA", "")) / "npm" / "claude.cmd",
    ):
        if candidate.is_file():
            return str(candidate)
    return None


def subscription_env() -> dict[str, str]:
    env = dict(os.environ)
    for name in API_ENV_VARS:
        env.pop(name, None)
    return env


def _tool_short_name(name: str) -> str:
    return name.rsplit("__", 1)[-1]


class _Run:
    """Parses Claude Code's stream-json output (one JSON object per line) on a reader thread."""

    def __init__(self, ctx: JobContext, max_items: int):
        self.ctx = ctx
        self.max_items = max_items
        self.lock = threading.Lock()
        self.pending: dict[str, str] = {}  # tool_use_id -> tool short name
        self.evaluated = 0
        self.skipped = 0
        self.queue_empty = False
        self.connector_ok: bool | None = None
        self.result: dict[str, Any] | None = None
        self.hit_item_limit = False
        self.stderr_tail: list[str] = []
        self.usage_limited: dict[str, Any] | None = None
        self.connector_calls = 0

    def handle_line(self, line: str) -> None:
        line = line.strip()
        if not line:
            return
        try:
            event = json.loads(line)
        except ValueError:
            self.ctx.log.info("claude: %s", line[:300])
            return
        kind = event.get("type")
        if kind == "system" and event.get("subtype") == "init":
            # claude.ai connectors are usually still "pending" at init and their tools load on
            # demand (Claude finds them with ToolSearch), so only a failed/needs-auth status
            # means the connector is really missing (confirmed live 2026-11-25).
            # Only an explicit failed/needs-auth stops the run here; whether the connector really
            # works is judged after the run (did Claude manage to call any CCG Eval tool?).
            servers = event.get("mcp_servers") or []
            ccg = next((srv for srv in servers if "ccg" in str(srv.get("name", "")).lower()), None)
            status = str((ccg or {}).get("status") or "not listed")
            if ccg is not None and status in ("failed", "needs-auth"):
                self.connector_ok = False
            self.ctx.log.info(
                "Claude Code started (model %s); CCG Eval connector: %s. Connectors seen: %s",
                event.get("model"), status,
                ", ".join(f"{srv.get('name')}={srv.get('status')}" for srv in servers) or "none",
            )
        elif kind == "rate_limit_event":
            info = event.get("rate_limit_info") or {}
            if str(info.get("status")) == "rejected":
                self.usage_limited = info
                self.ctx.log.warning("Claude subscription usage limit reached (%s); resets at %s.",
                                     info.get("rateLimitType"), info.get("resetsAt"))
        elif kind == "assistant":
            for block in (event.get("message") or {}).get("content") or []:
                if block.get("type") == "tool_use":
                    if str(block.get("name") or "").startswith(CONNECTOR_TOOL_PREFIX):
                        with self.lock:
                            self.connector_calls += 1
                    name = _tool_short_name(str(block.get("name") or ""))
                    with self.lock:
                        self.pending[str(block.get("id"))] = name
                    args = block.get("input") or {}
                    target = args.get("queue_id") or args.get("id") or ""
                    self.ctx.log.info("Claude -> %s%s", name, f" ({target})" if target else "")
                elif block.get("type") == "text" and (block.get("text") or "").strip():
                    self.ctx.log.info("Claude: %s", block["text"].strip()[:400])
        elif kind == "user":
            for block in (event.get("message") or {}).get("content") or []:
                if block.get("type") != "tool_result":
                    continue
                with self.lock:
                    name = self.pending.pop(str(block.get("tool_use_id")), "")
                failed = bool(block.get("is_error"))
                text = json.dumps(block.get("content"))[:2000]
                if name in SAVE_TOOLS and not failed:
                    with self.lock:
                        self.evaluated += 1
                        count = self.evaluated
                        if count >= self.max_items:
                            self.hit_item_limit = True
                    self.ctx.log.info("Saved evaluation %s of max %s.", count, self.max_items)
                    self.ctx.set_detail(f"evaluated {count} of max {self.max_items}")
                elif name == SKIP_TOOL and not failed:
                    with self.lock:
                        self.skipped += 1
                    self.ctx.log.warning("Claude skipped an item: %s", text[:300])
                elif name == "get_next_queued_item" and QUEUE_EMPTY_RE.search(text):
                    self.queue_empty = True
                elif failed:
                    self.ctx.log.warning("Tool %s returned an error: %s", name or "?", text[:400])
        elif kind == "result":
            self.result = event


class EvalModule(Module):
    name = "eval"
    availability_check_seconds = 1800
    unavailable_status = "claude_login_needed"

    def handlers(self) -> dict[str, Handler]:
        return {"drain": self.drain}

    def check_available(self) -> tuple[bool, str | None]:
        claude = find_claude()
        if not claude:
            return False, "Claude Code isn't installed on this machine (see ccg-agent/README.md)."
        try:
            with tempfile.TemporaryDirectory(prefix="ccg_agent_eval_") as tmp:
                out = subprocess.run(
                    [claude, "mcp", "list"], capture_output=True, text=True, timeout=120,
                    cwd=tmp, env=subscription_env(),
                )
        except Exception as exc:
            return False, f"Couldn't run Claude Code: {exc}"
        listing = f"{out.stdout}\n{out.stderr}".lower()
        if "ccg" in listing and "eval" in listing:
            return True, None
        return False, ("Claude Code can't see the CCG Eval connector — run `claude` once on this "
                       "machine and log in with the Claude subscription account.")

    # ------------------------------------------------------------------ job

    def drain(self, ctx: JobContext) -> dict[str, Any]:
        config = ctx.api.eval_config()
        max_items = int(config.get("maxItems") or 0)
        model = str(config.get("model") or "opus")
        if int(config.get("queued") or 0) == 0:
            return {"evaluated": 0, "stoppedBecause": "queue empty"}
        if max_items <= 0:
            return {"evaluated": 0, "stoppedBecause": "daily limit reached"}
        claude = find_claude()
        if not claude:
            raise ModuleUnavailable("Claude Code isn't installed on this machine.")

        timeout_s = int(config.get("timeoutMinutes") or 30) * 60
        prompt = (
            "eval\n\n"
            f"Evaluate at most {max_items} item{'s' if max_items != 1 else ''} from the queue, then stop."
        )
        cmd = [
            claude, "-p", prompt,
            "--model", model,
            "--output-format", "stream-json", "--verbose",
            "--allowedTools", CONNECTOR_TOOL_PREFIX,
            "--disallowedTools", BLOCKED_BUILTIN_TOOLS,
            "--max-turns", str(20 + max_items * 15),
        ]
        ctx.log.info("Starting Claude Code: model %s, up to %s item(s)%s.", model, max_items,
                     " (deep)" if config.get("deep") else "")
        ctx.set_detail(f"evaluating (max {max_items})")
        run = _Run(ctx, max_items)
        started = time.monotonic()
        stopped_because = None

        with tempfile.TemporaryDirectory(prefix="ccg_agent_eval_") as tmp:
            proc = subprocess.Popen(
                cmd, cwd=tmp, env=subscription_env(), text=True, encoding="utf-8", errors="replace",
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )

            def read_stdout() -> None:
                for line in proc.stdout:  # type: ignore[union-attr]
                    try:
                        run.handle_line(line)
                    except Exception as exc:
                        ctx.log.warning("Couldn't parse a Claude Code line: %s", exc)

            def read_stderr() -> None:
                for line in proc.stderr:  # type: ignore[union-attr]
                    run.stderr_tail = (run.stderr_tail + [line.rstrip()])[-20:]

            readers = [threading.Thread(target=read_stdout, daemon=True),
                       threading.Thread(target=read_stderr, daemon=True)]
            for reader in readers:
                reader.start()
            try:
                while proc.poll() is None:
                    if ctx.cancelled():
                        stopped_because = "cancelled"
                        break
                    if run.hit_item_limit:
                        # Stop right after the Nth save, before Claude claims another item.
                        stopped_because = "item limit"
                        break
                    if run.usage_limited:
                        stopped_because = "usage limit"
                        break
                    if run.connector_ok is False:
                        stopped_because = "connector missing"
                        break
                    if time.monotonic() - started > timeout_s:
                        stopped_because = "timeout"
                        break
                    time.sleep(0.5)
            finally:
                if proc.poll() is None:
                    proc.terminate()
                    try:
                        proc.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                for reader in readers:
                    reader.join(timeout=5)

        if stopped_because == "cancelled":
            raise JobCancelled("Cancelled in Admin.")
        if stopped_because == "connector missing":
            raise ModuleUnavailable("Claude Code started without the CCG Eval connector — log in again with `claude`.")

        result = run.result or {}
        result_text = str(result.get("result") or "")
        stderr_text = "\n".join(run.stderr_tail)
        if stopped_because is None:
            stopped_because = "queue empty" if run.queue_empty else str(result.get("subtype") or "finished")

        summary: dict[str, Any] = {
            "evaluated": run.evaluated,
            "skipped": run.skipped,
            "model": model,
            "deep": bool(config.get("deep")),
            "maxItems": max_items,
            "stoppedBecause": stopped_because,
            "numTurns": result.get("num_turns"),
            "durationMs": result.get("duration_ms"),
            # Claude Code's own estimate of what the run would cost on the API; on a
            # subscription nothing is billed, but it's a useful measure of usage.
            "costUsdEstimate": result.get("total_cost_usd"),
            "usage": result.get("usage"),
        }
        ctx.log.info("Run finished: %s evaluated, %s skipped, stopped because: %s.",
                     run.evaluated, run.skipped, stopped_because)

        if run.usage_limited:
            resets = run.usage_limited.get("resetsAt")
            when = time.strftime("%Y-%m-%d %H:%M", time.localtime(int(resets))) if resets else "later"
            summary["usageLimitResetsAt"] = resets
            if run.evaluated == 0:
                raise ModuleUnavailable(f"Claude subscription usage limit reached; resets {when}.")
            return summary

        if run.connector_calls == 0 and run.evaluated == 0 and stopped_because not in ("timeout",):
            raise ModuleUnavailable(
                "Claude Code couldn't use the CCG Eval connector on this run. Claude said: "
                f"{(result_text or stderr_text or 'nothing')[:400]}"
            )
        failed = bool(result.get("is_error")) or (not result and stopped_because not in ("item limit",))
        if failed and run.evaluated == 0:
            message = result_text or stderr_text or "Claude Code exited without a result."
            if any(hint in message.lower() for hint in USAGE_LIMIT_HINTS):
                raise ModuleUnavailable(f"Claude subscription usage limit: {message[:300]}")
            if stopped_because == "timeout":
                raise RuntimeError(f"Claude Code didn't finish within {timeout_s // 60} minutes.")
            raise RuntimeError(f"Claude Code failed: {message[:1500]}")
        if failed:
            summary["warning"] = (result_text or stderr_text)[:1000]
        return summary
