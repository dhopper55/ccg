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

    def get_sale_description_postfix(self) -> str | None:
        """The site's live standard description footer (public /api/shop/settings, no login
        needed) — the exact text the public site appends after each item's admin description,
        so Facebook listings match the site instead of a hardcoded copy that can drift."""
        try:
            resp = self.session.get(f"{self.base_url}/api/shop/settings", timeout=15)
            resp.raise_for_status()
            return (resp.json().get("saleDescriptionPostfix") or "").strip() or None
        except (requests.RequestException, ValueError):
            return None

    def reframe(self, title: str, description: str) -> dict:
        """Same AI rewrite as the item page's Reframe button (POST
        /api/admin-v2/inventory/reframe): same facts, new wording. Returns {title, description}.
        Saves nothing."""
        self._ensure_login()
        resp = self.session.post(
            f"{self.base_url}/api/admin-v2/inventory/reframe",
            json={"title": title, "description": description},
            timeout=90,
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"reframe failed: {resp.status_code} {resp.text[:300]}")
        return resp.json()

    def set_fb_groups(self, item_id, fb_groups: int) -> dict:
        """Records which FB groups the item went to: 1 music, 2 general, 3 all, 4 none."""
        self._ensure_login()
        resp = self.session.post(
            f"{self.base_url}/api/inventory/{item_id}/fb-groups", json={"fbGroups": fb_groups}, timeout=15
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-groups failed for item {item_id}: {resp.status_code} {resp.text[:200]}")
        return resp.json()

    def get_site_description(self, item_id) -> str | None:
        """The item's description exactly as the public site shows it (GET
        /api/shop/products/:id, no login): sale description + Serial #/Year/Finish lines + the
        footer for the item's category (Guitar/Bass, Amp, Pedal, Generic). Used verbatim on FB so
        both always match. None if the site won't serve the item (e.g. in-store-only) or the
        request fails — callers fall back to the old description + main footer."""
        try:
            resp = self.session.get(f"{self.base_url}/api/shop/products/{item_id}", timeout=15)
            if resp.status_code >= 400:
                return None
            text = ((resp.json().get("record") or {}).get("saleDescription") or "").strip()
            return text or None
        except (requests.RequestException, ValueError):
            return None

    def set_fb_listing_id(self, item_id: int, fb_listing_id: str) -> dict:
        """Retries on a dropped connection: this runs right after the browser step, which can
        leave the session's pooled keep-alive connection idle long enough for the server to
        close it (confirmed 2026-10-03: ConnectionResetError on fb-add after a draft had
        already saved). Safe to repeat — it only sets the item's fb_listing_id."""
        self._ensure_login()
        for attempt in range(3):
            try:
                resp = self.session.post(
                    f"{self.base_url}/api/inventory/{item_id}/fb-add",
                    json={"fbListingId": fb_listing_id},
                    timeout=30,
                )
                break
            except requests.ConnectionError:
                if attempt == 2:
                    raise
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-add failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def clear_fb_listing_id(self, item_id: int) -> dict:
        self._ensure_login()
        resp = self.session.post(f"{self.base_url}/api/inventory/{item_id}/fb-remove")
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-remove failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def remove_reverb_listing(self, item_id: int) -> dict:
        """Mirrors admin-v2-app's "Delete From Reverb" button. Unlike Facebook, Reverb has a
        real API: the Worker calls Reverb's own PUT /my/listings/:id/state/end first, and only
        clears CCG's reverb_listing_id if that call succeeds (fail-closed — crud2.ts
        handleInventoryReverbRemove). A non-2xx here means the Reverb-side end failed (already
        ended/sold is a common, expected case) and the CCG link was deliberately left in place
        for manual review rather than force-cleared."""
        self._ensure_login()
        resp = self.session.post(f"{self.base_url}/api/inventory/{item_id}/reverb-remove")
        if resp.status_code >= 400:
            raise RuntimeError(f"reverb-remove failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def force_clear_reverb_listing(self, item_id: int) -> dict:
        """Clears reverb_listing_id WITHOUT calling Reverb's API — for a listing already
        confirmed gone on Reverb's side, where remove_reverb_listing's fail-closed check keeps
        refusing to clear it (e.g. Reverb already auto-ended it when it sold, so the end-listing
        call itself 404s/fails). Use only once you've confirmed on Reverb.com that the listing
        is actually gone — this does no verification of its own."""
        self._ensure_login()
        resp = self.session.post(f"{self.base_url}/api/inventory/{item_id}/reverb-force-clear")
        if resp.status_code >= 400:
            raise RuntimeError(f"reverb-force-clear failed for item {item_id}: {resp.status_code} {resp.text}")
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

    def exclude_from_fbm(self, item_id: int) -> dict:
        """'Skip permanently' — the tool will never ask about posting this CCG item to FB
        again. Not exposed in the admin UI (2026-09-13); this is the only way to set it."""
        self._ensure_login()
        resp = self.session.post(f"{self.base_url}/api/inventory/{item_id}/fb-exclude")
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-exclude failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def clear_fb_sync_state(self, item_id: int) -> dict:
        """Inverse of exclude_from_fbm — resets fb_sync_state back to null. Used by Delete All
        mode to reset every item's exclusion flag as part of a full CCG/FBM resync."""
        self._ensure_login()
        resp = self.session.post(f"{self.base_url}/api/inventory/{item_id}/fb-include")
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-include failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def get_item(self, item_id) -> dict:
        """The FULL edit-form record (GET /api/inventory/:id) — what admin-v2-app's edit form
        loads and saves back. Use this, not a get_all_inventory() row, as the base for
        update_item: the list rows are a trimmed shape (thumbnail-wrapped imageUrl, no
        per-image `images` with isPrivate flags), and saving one back failed with "Unable to
        fetch source image" (2026-09-20) and risked blanking fields the list omits."""
        self._ensure_login()
        resp = self.session.get(f"{self.base_url}/api/inventory/{item_id}")
        if resp.status_code >= 400:
            raise RuntimeError(f"get item {item_id} failed: {resp.status_code} {resp.text}")
        data = resp.json()
        return data.get("record", data)

    def get_public_image_urls(self, item_id) -> list[str]:
        """Absolute URLs of the item's non-private images, in display order. List rows from
        get_all_inventory() carry only a flat `imageUrls` (private ones included, no flags), so
        this loads the full record, whose `images` entries carry `isPrivate`. Private images
        (e.g. serial/receipt shots) must never go to Facebook."""
        record = self.get_item(item_id)
        images = record.get("images") or []
        if images:
            urls = [img.get("url") for img in images if img.get("url") and not img.get("isPrivate")]
        else:
            # Legacy item with no per-image rows: no privacy info exists, so all are public.
            urls = record.get("imageUrls") or []
        return [u if u.startswith("http") else f"{self.base_url}{u}" for u in urls]

    def update_item(self, item_id: int, record: dict) -> dict:
        """POST /api/inventory/:id/update is a full-record replace, not a patch — it reads
        ~50 body fields with hard defaults and 400s if title/categoryId/barcode/purchasedDate/
        images are missing. Callers must pass the item's full record (from get_item) with only
        the changed fields overwritten on top of it — never a partial dict of just the changed
        fields, or every other field gets wiped/defaulted."""
        self._ensure_login()
        resp = self.session.post(f"{self.base_url}/api/inventory/{item_id}/update", json=record)
        if resp.status_code >= 400:
            raise RuntimeError(f"update failed for item {item_id}: {resp.status_code} {resp.text}")
        return resp.json()

    def get_ignored_fb_listing_ids(self) -> set[str]:
        """FB listing ids known to be personal items, not CCG inventory (e.g. a lawnmover
        listed on FB only) — never suggested as unknown/possible-link again."""
        self._ensure_login()
        resp = self.session.get(f"{self.base_url}/api/fb-ignore-list")
        resp.raise_for_status()
        records = resp.json().get("records", [])
        return {r["fbListingId"] for r in records}

    def add_ignored_fb_listing(self, fb_listing_id: str, note: str | None = None) -> dict:
        self._ensure_login()
        resp = self.session.post(
            f"{self.base_url}/api/fb-ignore-list",
            json={"fbListingId": fb_listing_id, "note": note},
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"fb-ignore-list add failed for {fb_listing_id}: {resp.status_code} {resp.text}")
        return resp.json()
