"""Thin HTTP client for CCG's Worker API.

Logs in fresh on first use each run (no persisted session) — see ARCHITECTURE.md
Section 4 "Auth (decided 2026-09-13)". Holds the session cookie in memory only,
via a plain requests.Session; nothing is written to disk.
"""
from __future__ import annotations

import os

import requests
from dotenv import load_dotenv

load_dotenv()


class CCGClient:
    def __init__(self, base_url: str | None = None, username: str | None = None, password: str | None = None):
        self.base_url = (base_url or os.environ["CCG_BASE_URL"]).rstrip("/")
        self.username = username or os.environ["CCG_USERNAME"]
        self.password = password or os.environ["CCG_PASSWORD"]
        self.session = requests.Session()
        self._logged_in = False

    def login(self) -> None:
        resp = self.session.post(
            f"{self.base_url}/api/login",
            json={"username": self.username, "password": self.password},
        )
        resp.raise_for_status()
        self._logged_in = True

    def _ensure_login(self) -> None:
        if not self._logged_in:
            self.login()

    def get_all_inventory(self, **params) -> list[dict]:
        """Fetch every page of GET /api/inventory. The endpoint has no filters for
        for_sale / "fb_listing_id is null" — callers filter client-side.
        """
        self._ensure_login()
        page = 1
        limit = 100
        records: list[dict] = []
        while True:
            resp = self.session.get(
                f"{self.base_url}/api/inventory",
                params={"active": "all", **params, "page": page, "limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()
            batch = data.get("records", [])
            records.extend(batch)
            total_pages = data.get("totalPages")
            if total_pages is not None:
                if page >= total_pages:
                    break
            elif len(batch) < limit:
                break
            page += 1
        return records

    def set_fb_listing_id(self, item_id: int, fb_listing_id: str) -> dict:
        self._ensure_login()
        resp = self.session.post(
            f"{self.base_url}/api/inventory/{item_id}/fb-add",
            json={"fbListingId": fb_listing_id},
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-add failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def clear_fb_listing_id(self, item_id: int) -> dict:
        self._ensure_login()
        resp = self.session.post(f"{self.base_url}/api/inventory/{item_id}/fb-remove")
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-remove failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def mark_sold_fbm(self, item_id: int, sell_notes: str = "Marked sold via ccg-fbm-sync tool.") -> dict:
        self._ensure_login()
        resp = self.session.post(
            f"{self.base_url}/api/inventory/{item_id}/fb-mark-sold",
            json={"sellNotes": sell_notes},
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-mark-sold failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()
