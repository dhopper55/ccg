"""HTTP client for the Worker's /api/agent/* endpoints (bearer = this instance's key)."""
from __future__ import annotations

from typing import Any

import requests

from .config import Config


class InvalidKey(Exception):
    """The Worker doesn't recognize this key (never created, or deleted in Admin)."""


class NotActive(Exception):
    """This key is valid but isn't the active instance, so it may not claim jobs."""


class NotClaimed(Exception):
    """The job is no longer ours (cancelled in Admin, or its lease expired)."""


class AgentApi:
    """One per thread: requests.Session isn't meant to be shared across threads."""

    def __init__(self, config: Config, timeout: float = 30):
        self.base_url = config.base_url
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {config.agent_key}",
            "User-Agent": "ccg-agent",
        })

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        resp = self.session.post(f"{self.base_url}{path}", json=body, timeout=self.timeout)
        if resp.status_code == 401:
            raise InvalidKey(resp.text[:200])
        if resp.status_code == 423:
            raise NotActive(resp.text[:200])
        if resp.status_code == 409:
            raise NotClaimed(resp.text[:200])
        resp.raise_for_status()
        return resp.json()

    def heartbeat(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._post("/api/agent/heartbeat", body)

    def claim(self, modules: list[str]) -> dict[str, Any] | None:
        return self._post("/api/agent/jobs/claim", {"modules": modules}).get("job")

    def complete(self, job_id: str, status: str, result: Any = None, error: str | None = None) -> None:
        self._post(f"/api/agent/jobs/{job_id}/complete", {"status": status, "result": result, "error": error})

    def release(self, job_id: str) -> None:
        self._post(f"/api/agent/jobs/{job_id}/release", {})

    def send_logs(self, entries: list[dict[str, Any]]) -> None:
        self._post("/api/agent/logs", {"entries": entries})

    def scout_config(self, job_id: str) -> dict[str, Any]:
        return self._post("/api/agent/scout/config", {"jobId": job_id})

    def scout_known(self, job_id: str, ids: list[str]) -> list[str]:
        known: list[str] = []
        for i in range(0, len(ids), 500):
            known += self._post("/api/agent/scout/known", {"jobId": job_id, "ids": ids[i:i + 500]}).get("known") or []
        return known

    def scout_submit(self, job_id: str, ids: list[str]) -> dict[str, Any]:
        return self._post("/api/agent/scout/submit", {"jobId": job_id, "ids": ids})

    def eval_config(self) -> dict[str, Any]:
        """{queued, deep, model, maxItems, timeoutMinutes} for the next eval run."""
        return self._post("/api/agent/eval/config", {})

    def fbm_item(self, item_id: str) -> dict[str, Any]:
        """{item: {...}, footer} for an item this instance holds an fbm job for."""
        return self._post("/api/agent/fbm/item", {"itemId": item_id})

    def upload_screenshot(self, job_id: str, png: bytes) -> str:
        resp = self.session.post(
            f"{self.base_url}/api/agent/jobs/{job_id}/screenshot",
            data=png, headers={"Content-Type": "image/png"}, timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()["key"]
