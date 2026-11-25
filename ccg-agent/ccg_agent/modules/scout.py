"""Marketplace scout: finds new Facebook Marketplace listings and adds them to the evaluator.

scout.scan does what the owner does by hand: for each saved search (Worker: SCOUT_SEARCHES),
open Marketplace search results (local pickup, newest first, Facebook's default area for the
account), scroll a few times, and collect listing cards. Ads (no Marketplace item link, or "Ad"
under the title) are skipped, and so are listings already in CCG. New ones are added through the
normal listing intake (Apify scrape + auto-queue for Claude); the eval module evaluates them.

Uses the agent's Facebook browser profile and login (see modules/fbm/browser.py). It reads
search results at a normal page-load pace and makes no attempt to look less automated.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from .base import Handler, JobContext, Module, ModuleUnavailable
from .fbm import browser

SEARCH_URL = (
    "https://www.facebook.com/marketplace/search/?query={query}"
    "&sortBy=creation_time_descend&deliveryMethod=local_pick_up&exact=false"
)
ITEM_ID_RE = re.compile(r"/marketplace/item/(\d+)")


def _parse_card(text: str) -> dict[str, str] | None:
    """A listing card's text is price / title / location (a struck-through old price may follow
    the price). Ads show the advertiser and "Ad" instead of a location."""
    lines = [line.strip() for line in (text or "").split("\n") if line.strip()]
    if not lines or lines[-1].lower() == "ad" or "sponsored" in (line.lower() for line in lines):
        return None
    price = next((line for line in lines if line.startswith("$") or line.lower() == "free"), "")
    rest = [line for line in lines if line != price and not line.startswith("$") and line.lower() != "just listed"]
    title = rest[0] if rest else ""
    location = rest[-1] if len(rest) > 1 else ""
    return {"price": price, "title": title, "location": location}


class ScoutModule(Module):
    name = "scout"

    def handlers(self) -> dict[str, Handler]:
        return {"scan": self.scan}

    def scan(self, ctx: JobContext) -> dict[str, Any]:
        config = ctx.api.scout_config(ctx.id)
        searches: list[str] = list(config.get("searches") or [])
        scrolls = int(config.get("scrollsPerSearch") or 4)
        max_new = int(config.get("maxNew") or 0)
        ctx.log.info("Scout scan: %s searches, up to %s new listing(s)%s.", len(searches), max_new,
                     " (limits ignored)" if config.get("ignoreLimits") else "")
        if max_new <= 0:
            ctx.log.info("Daily scout limit reached; nothing to add.")
            return {"added": 0, "stoppedBecause": "daily limit reached"}

        per_search: dict[str, list[dict[str, str]]] = {}
        seen: set[str] = set()
        ads_skipped = 0
        try:
            with browser.fb_browser() as context:
                page = context.new_page()
                ctx.set_detail("checking Facebook login")
                if not browser.is_logged_in(page):
                    raise ModuleUnavailable("Facebook is logged out on this machine — run: python -m ccg_agent fb-login")
                for index, query in enumerate(searches, start=1):
                    ctx.check_cancelled()
                    ctx.set_detail(f"search {index}/{len(searches)}: {query}")
                    try:
                        found, ads = self._run_search(ctx, page, query, scrolls, seen)
                    except Exception as exc:
                        ctx.log.warning("Search '%s' failed: %s", query, exc)
                        ctx.screenshot(page, f"search '{query}' failed")
                        continue
                    ads_skipped += ads
                    per_search[query] = found
                    ctx.log.info("'%s': %s listing(s) found, %s ad(s) skipped.", query, len(found), ads)
        except browser.ProfileBusy as exc:
            raise ModuleUnavailable(str(exc)) from exc

        all_ids = [card["id"] for cards in per_search.values() for card in cards]
        known = set(ctx.api.scout_known(ctx.id, all_ids)) if all_ids else set()

        # Round-robin across searches so the brand searches aren't crowded out by "guitar".
        queues = {query: [c for c in cards if c["id"] not in known] for query, cards in per_search.items()}
        picked: list[dict[str, str]] = []
        while len(picked) < max_new and any(queues.values()):
            for query in list(queues):
                if queues[query] and len(picked) < max_new:
                    picked.append(queues[query].pop(0))
        new_total = sum(1 for card in (c for cards in per_search.values() for c in cards) if card["id"] not in known)

        added = 0
        rejected: list[Any] = []
        if picked:
            ctx.set_detail(f"adding {len(picked)} listing(s)")
            response = ctx.api.scout_submit(ctx.id, [card["id"] for card in picked])
            added = int(response.get("accepted") or 0)
            rejected = response.get("rejected") or []
            for card in picked:
                ctx.log.info("Added: %s %s (%s) [%s]", card["price"], card["title"], card["location"], card["search"])
            for item in rejected:
                ctx.log.warning("Rejected by the intake: %s", item)

        ctx.log.info("Scout done: %s listing(s) seen, %s already in CCG, %s new, %s added.",
                     len(all_ids), len(known), new_total, added)
        return {
            "added": added,
            "seen": len(all_ids),
            "alreadyKnown": len(known),
            "newFound": new_total,
            "notAddedDueToLimit": max(0, new_total - len(picked)),
            "adsSkipped": ads_skipped,
            "rejected": rejected,
            "items": picked,
        }

    def _run_search(self, ctx: JobContext, page, query: str, scrolls: int, seen: set[str]) -> tuple[list[dict[str, str]], int]:
        page.goto(SEARCH_URL.format(query=quote(query)), wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        found: list[dict[str, str]] = []
        ads = 0
        for step in range(scrolls + 1):
            for anchor in page.locator("a[href*='/marketplace/item/']").all():
                try:
                    match = ITEM_ID_RE.search(anchor.get_attribute("href") or "")
                    if not match or match.group(1) in seen:
                        continue
                    card = _parse_card(anchor.inner_text())
                except Exception:
                    continue
                item_id = match.group(1)
                seen.add(item_id)
                if card is None:
                    ads += 1
                    continue
                found.append({"id": item_id, "search": query, **card})
            if step < scrolls:
                ctx.check_cancelled()
                page.mouse.wheel(0, 2500)
                page.wait_for_timeout(2500)
        return found, ads
