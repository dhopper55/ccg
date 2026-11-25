"""The two Facebook flows: publish a new listing, and update an existing one."""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import parse_qs

from . import form
from .browser import CREATE_LISTING_URL

# Hard-coded for now (decided 2026-11-24): the "List in more places" groups every new listing
# goes to. Facebook only shows this step when creating a listing, not when editing one.
LISTING_GROUPS = [
    "Colorado Music Equipment For Sale",
    "COLORADO MUSIC GEAR BUY SELL TRADE",
    "Colorado used musical gear",
]

EDIT_LISTING_URL = "https://www.facebook.com/marketplace/edit/?listing_id={id}"


class PublishedWithoutId(Exception):
    """Publish went through but the new listing's id wasn't captured."""


class ListingIdCapture:
    """Reads the new listing's id from Facebook's own GraphQL response
    (data.marketplace_listing*.listing.id — confirmed live for Save draft on 2026-09-13; Publish is
    expected to answer the same way). Tolerant of FB's "for (;;);" prefix and multi-line JSON."""

    def __init__(self, page):
        self.page = page
        self.listing_id: str | None = None
        self.trace: list[str] = []

    def __enter__(self):
        self.page.on("response", self._on_response)
        return self

    def __exit__(self, *exc):
        try:
            self.page.remove_listener("response", self._on_response)
        except Exception:
            pass

    def _on_response(self, response) -> None:
        if response.request.method != "POST" or "graphql" not in response.url:
            return
        try:
            friendly = parse_qs(response.request.post_data or "").get("fb_api_req_friendly_name", ["?"])[0]
            text = response.text()
        except Exception as error:
            self.trace.append(f"(unreadable response: {error})")
            return
        keys: list[str] = []
        for chunk in text.removeprefix("for (;;);").splitlines():
            try:
                data = json.loads(chunk).get("data") or {}
            except (ValueError, AttributeError):
                continue
            keys += list(data)
            for key, value in data.items():
                if self.listing_id is None and key.startswith("marketplace_listing") and isinstance(value, dict):
                    listing_id = (value.get("listing") or {}).get("id")
                    if listing_id:
                        self.listing_id = str(listing_id)
        self.trace.append(f"{friendly}: {keys}")


def _fill_details(page, item: dict[str, Any], footer: str | None, log) -> None:
    text_inputs = page.locator("input[type='text']")
    title = form.fb_title(item["title"])
    if title != item["title"]:
        log.info("Title shortened to Facebook's limit: %r", title)
    form.fill_text(text_inputs.nth(0), title)
    form.fill_text(text_inputs.nth(1), f"{float(item['salePrice']):g}")
    form.set_category(page)
    form.set_condition(page, form.map_condition(item.get("condition") or ""))
    textarea = page.locator("textarea").first
    textarea.scroll_into_view_if_needed()
    form.fill_text(textarea, form.build_description(item.get("saleDescription") or "", footer))
    page.wait_for_timeout(800)


def _click_next(page, where: str) -> None:
    next_button = page.get_by_role("button", name="Next", exact=True)
    if not form.wait_until_enabled(next_button, page):
        raise form.FbmStepError(
            f"Facebook kept Next disabled on {where} — a field wasn't accepted (title length, price, "
            "category, condition, description) or photos never finished uploading."
        )
    next_button.first.click()
    page.wait_for_timeout(2500)


def publish_listing(ctx, page, item: dict[str, Any], footer: str | None) -> dict[str, Any]:
    """Create -> details -> delivery -> Allow offers (off) -> List in more places (groups) -> Publish."""
    log = ctx.log
    with form.Photos(item["imageUrls"], log) as photos:
        if not photos:
            raise form.FbmStepError("No photos could be downloaded (Facebook requires at least one).")
        ctx.set_detail("filling in the listing")
        page.goto(CREATE_LISTING_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        form.dismiss_popups(page)
        page.locator("input[type='file'][accept*='image']").first.set_input_files(photos)
        page.wait_for_timeout(4000)
        _fill_details(page, item, footer, log)
        ctx.check_cancelled()
        _click_next(page, "the listing details step")

        ctx.set_detail("delivery")
        form.apply_delivery(page, item["allowShipping"], item["salePrice"], item["fixedShippingAmount"], log)
        ctx.check_cancelled()

        # From here on, act on whichever step is showing — the step order can differ with and
        # without shipping. Nothing is published until the Publish click below.
        groups_selected: list[str] = []
        groups_missing: list[str] = []
        for _ in range(6):
            if form.heading_visible(page, "List in more places"):
                ctx.set_detail("choosing groups")
                groups_selected, groups_missing = form.select_groups(page, LISTING_GROUPS, log)
                break
            if form.heading_visible(page, "Allow offers"):
                form.turn_off_offers(page)
                _click_next(page, "the Allow offers step")
                continue
            _click_next(page, f"step '{form.step_summary(page)}'")
        else:
            raise form.FbmStepError(f"Never reached 'List in more places' (last: {form.step_summary(page)}).")

        ctx.check_cancelled()  # last chance: after this the listing is public
        publish = page.get_by_role("button", name="Publish", exact=True)
        if not form.wait_until_enabled(publish, page, seconds=20):
            raise form.FbmStepError("The Publish button never became clickable.")
        ctx.set_detail("publishing")
        with ListingIdCapture(page) as capture:
            publish.first.click()
            published = False
            for _ in range(40):
                page.wait_for_timeout(1000)
                # Leaving the create-item form means it went through (Save draft lands on the
                # /marketplace/create hub; Publish goes on to your listings).
                if "/marketplace/create/item" not in page.url or capture.listing_id:
                    published = True
                    break
            page.wait_for_timeout(2000)  # let the create response land if it's still streaming
        if not published:
            raise form.FbmStepError(
                f"Clicked Publish but Facebook didn't leave the create form within 40s ({form.step_summary(page)}). "
                "Check Facebook before retrying — it may have published anyway."
            )
        if not capture.listing_id:
            log.warning("Publish GraphQL responses seen: %s", capture.trace[-15:])
            raise PublishedWithoutId(
                "Published on Facebook, but couldn't capture the new listing's ID. Find it on Facebook "
                "and paste it into the item's FB Listing ID. Do NOT click Add to FBM again (it would duplicate)."
            )
    log.info("Published listing %s (groups: %s%s).", capture.listing_id, ", ".join(groups_selected) or "none",
             f"; not found: {', '.join(groups_missing)}" if groups_missing else "")
    return {
        "fbListingId": capture.listing_id,
        "groups": groups_selected,
        "groupsMissing": groups_missing,
    }


def update_listing(ctx, page, item: dict[str, Any], footer: str | None) -> dict[str, Any]:
    """Edit page -> title, price, condition, description, delivery (no photos) -> Update.
    Facebook's edit screens haven't been automated before: first runs may need retuning."""
    log = ctx.log
    fb_id = item["fbListingId"]
    ctx.set_detail("opening the listing")
    page.goto(EDIT_LISTING_URL.format(id=fb_id), wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    form.dismiss_popups(page)
    try:
        page.locator("input[type='text']").first.wait_for(timeout=15000)
    except Exception:
        raise form.FbmStepError(
            f"Facebook's edit page for listing {fb_id} didn't load (deleted on Facebook, or the ID is wrong?)."
        ) from None
    _fill_details(page, item, footer, log)
    ctx.check_cancelled()

    ctx.set_detail("saving changes")
    delivery_done = False
    for _ in range(8):
        if not delivery_done and page.locator("[role='combobox']").filter(has_text="Delivery method").count() > 0:
            form.apply_delivery(page, item["allowShipping"], item["salePrice"], item["fixedShippingAmount"], log)
            delivery_done = True
        if form.heading_visible(page, "Allow offers"):
            form.turn_off_offers(page)
        for name in ("Update", "Save"):
            button = page.get_by_role("button", name=name, exact=True).filter(visible=True)
            if button.count() and button.first.get_attribute("aria-disabled") != "true":
                button.first.click()
                for _ in range(30):
                    page.wait_for_timeout(1000)
                    if "/marketplace/edit" not in page.url:
                        log.info("Updated listing %s.", fb_id)
                        return {"fbListingId": fb_id, "deliveryUpdated": delivery_done}
                raise form.FbmStepError(f"Clicked {name} but Facebook stayed on the edit page ({form.step_summary(page)}).")
        _click_next(page, f"edit step '{form.step_summary(page)}'")
    raise form.FbmStepError(f"Never found an Update/Save button on the edit pages ({form.step_summary(page)}).")
