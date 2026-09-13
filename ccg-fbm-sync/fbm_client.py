"""Reads current Facebook Marketplace listings by driving a real browser (Playwright).

Facebook has no public API for reading your own Marketplace listings, so this automates
your own logged-in "Your listings" page instead — see ARCHITECTURE.md Section 6 (decided
2026-09-13, superseding the earlier manual-paste plan). This is against Facebook's
automation/bot terms even for read-only access to your own account — a known, accepted
risk, not an oversight.

Session handling: the first run opens a real, visible browser window so you log into
Facebook yourself, by hand (sidesteps 2FA/captcha entirely — this code never sees your
password). That session is saved locally to `.fb_session.json` and reused on every later
run. Delete that file to force a fresh login (e.g. if Facebook logs the session out).

`.fb_session.json` holds live Facebook auth cookies — treat it like a password, never
commit it (already in .gitignore).

Runs headed (a visible window), not headless, on every run, not just the first — Facebook's
bot detection is known to challenge/block plain headless Chromium.

Extraction approach (confirmed live 2026-09-13, after two earlier attempts failed):
- The default "List view" renders each row's title as a `role="button"` div with no real
  href, and only the FIRST ~10 rows carry an embedded JSON preload blob (Relay/GraphQL SSR
  data) — anything loaded afterward via "Load more" lives only in client-side JS state and
  is never written back into the page's HTML, so a JSON-scraping approach silently caps out
  at whatever the first batch happened to include.
- Switching to **"Grid view"** (a toggle button on the same page) instead renders every
  listing — including ones loaded later via "Load more" — as a real
  `<a href="/marketplace/item/<id>/...">` anchor with the title as its text. That works
  uniformly regardless of how the row was loaded, so this scrapes grid view, not list view.
- Pagination is a "Load N more" button click (confirmed label text is literally
  "Load 25 more", not "Load more" — an earlier version required an exact "load more" match
  and never found it).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import sync_playwright

SESSION_FILE = Path(__file__).parent / ".fb_session.json"
DEBUG_SCREENSHOT = Path(__file__).parent / "debug_screenshot.png"
LISTINGS_URL = "https://www.facebook.com/marketplace/you/selling"

_ITEM_HREF_RE = re.compile(r"/marketplace/item/(\d+)")
_LOAD_MORE_RE = re.compile(r"load\s+\d+\s+more", re.I)


@dataclass
class FbListing:
    id: str
    title: str


def _switch_to_grid_view(page) -> None:
    for el in page.query_selector_all("[aria-label]"):
        if (el.get_attribute("aria-label") or "") == "Grid view":
            el.click()
            page.wait_for_timeout(2000)
            return


def _harvest_anchors(page) -> dict[str, str]:
    found: dict[str, str] = {}
    for anchor in page.query_selector_all("a[href*='/marketplace/item/']"):
        href = anchor.get_attribute("href") or ""
        match = _ITEM_HREF_RE.search(href)
        if not match:
            continue
        title = (anchor.inner_text() or "").strip().split("\n")[0]
        if title:
            found[match.group(1)] = title
    return found


def _click_load_more(page) -> bool:
    for el in page.query_selector_all("[aria-label]"):
        label = el.get_attribute("aria-label") or ""
        if _LOAD_MORE_RE.search(label):
            try:
                el.click()
                return True
            except Exception:
                continue
    return False


def _login_and_save_session(playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://www.facebook.com/login")
    print("\nA browser window opened. Log into Facebook there, then come back and press Enter.")
    input()
    context.storage_state(path=str(SESSION_FILE))
    browser.close()
    print(f"Session saved to {SESSION_FILE.name} — future runs won't need to log in again.\n")


def get_active_listings() -> list[FbListing]:
    with sync_playwright() as playwright:
        if not SESSION_FILE.exists():
            _login_and_save_session(playwright)

        browser = playwright.chromium.launch(headless=False)
        context = browser.new_context(storage_state=str(SESSION_FILE))
        page = context.new_page()
        # "networkidle" effectively never fires on Facebook — it keeps background
        # websocket/polling traffic running indefinitely, so that wait condition just times
        # out. "domcontentloaded" plus a fixed pause for the SPA to render is what actually works.
        page.goto(LISTINGS_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        page.screenshot(path=str(DEBUG_SCREENSHOT), full_page=True)

        _switch_to_grid_view(page)

        print("Loading all listings (clicking through 'Load N more', ~25 at a time)...")
        seen: dict[str, str] = {}
        stable_rounds = 0

        for _ in range(60):  # 60 * 25 ≈ 1500, comfortably above any real listing count
            seen.update(_harvest_anchors(page))

            before = len(seen)
            page.mouse.wheel(0, 3000)
            page.wait_for_timeout(1000)
            clicked = _click_load_more(page)
            if clicked:
                page.wait_for_timeout(2000)

            if len(seen) == before and not clicked:
                stable_rounds += 1
                if stable_rounds >= 3:
                    break
            else:
                stable_rounds = 0

        seen.update(_harvest_anchors(page))  # final harvest

        context.storage_state(path=str(SESSION_FILE))  # refresh cookies for next run
        browser.close()

        print(f"Found {len(seen)} listing(s) via scraping.")
        return [FbListing(id=listing_id, title=title) for listing_id, title in seen.items()]
