"""Facebook Marketplace module: fbm.add (publish) and fbm.update (edit an existing listing).

Playwright only — if a step fails, the job fails (with a screenshot in Admin); no fallback.
Before every job the Facebook login is checked; if it's gone the job goes back to the queue
and the instance reports "fb_login_needed" until someone runs `python -m ccg_agent fb-login`.
"""
from __future__ import annotations

from typing import Any

from ..base import Handler, JobContext, Module, ModuleUnavailable
from . import browser, flows


class FbmModule(Module):
    name = "fbm"
    availability_check_seconds = 1800
    unavailable_status = "fb_login_needed"

    def handlers(self) -> dict[str, Handler]:
        return {"add": self.add, "update": self.update}

    def check_available(self) -> tuple[bool, str | None]:
        try:
            return browser.check_login()
        except browser.ProfileBusy as exc:
            return False, str(exc)

    # ------------------------------------------------------------------ jobs

    def add(self, ctx: JobContext) -> dict[str, Any]:
        data = self._load(ctx)
        item = data["item"]
        if item.get("fbListingId"):
            # Linked by hand (or by an earlier run) since the job was queued: never publish twice.
            ctx.log.info("Item already has FB listing %s; nothing to publish.", item["fbListingId"])
            return {"fbListingId": item["fbListingId"], "skipped": "already linked"}
        if item.get("isSold"):
            raise RuntimeError("Item was sold before the agent got to it; not publishing.")
        return self._run(ctx, lambda page: flows.publish_listing(ctx, page, item, data.get("footer")))

    def update(self, ctx: JobContext) -> dict[str, Any]:
        data = self._load(ctx)
        item = data["item"]
        if not item.get("fbListingId"):
            ctx.log.info("Item no longer has an FB listing ID; nothing to update.")
            return {"skipped": "not linked"}
        if item.get("isSold"):
            ctx.log.info("Item is sold; skipping the update.")
            return {"skipped": "sold"}
        return self._run(ctx, lambda page: flows.update_listing(ctx, page, item, data.get("footer")))

    # ------------------------------------------------------------------ helpers

    def _load(self, ctx: JobContext) -> dict[str, Any]:
        item_id = str(ctx.payload.get("itemId") or "")
        if not item_id:
            raise RuntimeError("Job payload has no itemId.")
        return ctx.api.fbm_item(item_id)

    def _run(self, ctx: JobContext, flow) -> dict[str, Any]:
        try:
            with browser.fb_browser() as context:
                page = context.new_page()
                ctx.set_detail("checking Facebook login")
                if not browser.is_logged_in(page):
                    raise ModuleUnavailable("Facebook is logged out on this machine — run: python -m ccg_agent fb-login")
                try:
                    return flow(page)
                except ModuleUnavailable:
                    raise
                except Exception:
                    ctx.screenshot(page, "failure")
                    raise
        except browser.ProfileBusy as exc:
            raise ModuleUnavailable(str(exc)) from exc
