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

Also drafts new listings (`create_draft_listing`): fills Facebook's real "Item for sale"
create form (photos, title, price, category, condition, description — the description gets
`FBM_DESCRIPTION_POSTFIX` appended, matching how the public shop site appends its own
different shop-info footer to every listing) and saves it via FB's own "Save draft" rather
than publishing. Title/Price are plain unlabeled `input[type=text]` elements (positions 0/1)
and Category/Condition are unlabeled `[role=combobox]` elements (positions 1/2, position 0
is FB's global search box) — this form has no aria-labels on its own fields, so everything
is matched by DOM position, not name.
"""
from __future__ import annotations

import io
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

import requests
from PIL import Image
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(__file__).parent / ".fb_session.json"
DEBUG_SCREENSHOT = Path(__file__).parent / "debug_screenshot.png"
DEBUG_DUMP = Path(__file__).parent / "debug_dump.txt"
LISTINGS_URL = "https://www.facebook.com/marketplace/you/selling"
CREATE_LISTING_URL = "https://www.facebook.com/marketplace/create/item"
DRAFT_CATEGORY = "Musical Instruments"
MAX_DRAFT_PHOTOS = 10
MAX_DRAFT_PHOTO_DIMENSION = 2048
CONDITION_OPTIONS = ["New", "Used - Like New", "Used - Good", "Used - Fair"]
MEETUP_PREFERENCE_LABELS = ["Public meetup", "Door pickup", "Door dropoff"]
DELIVERY_LOCAL_ONLY = "Local pickup"
DELIVERY_SHIPPING_AND_LOCAL = "Shipping & local pickup"
SHIPPING_OWN_LABEL_OPTION = "Use your own label"

# Appended to every drafted description (decided 2026-09-13) — the public shop site already
# appends its own shop-info footer to CCG's raw saleDescription (DEFAULT_SALE_DESCRIPTION_POSTFIX
# in workers/listing-evaluator/src/constants.ts), but that's a *different* footer (business
# hours, online-vs-in-store payment split, no amp lineup/accessories mention) than what's
# wanted here — this is FBM-specific content, not a reuse of the site's existing postfix.
FBM_DESCRIPTION_POSTFIX = """📍 Local pickup in Englewood, CO - Come down to our shop in Englewood and give this item (and many others) a try. We have a wide variety of amplifiers and effects in the shop that you can use to dial in that perfect tone! See some of our lineup below.

🔐 Contact us to make an appointment! Just send us a message or give us a call!

💳 Payment options:
• Cash, Venmo, Zelle, CashApp, PayPal, Credit Card, or Financing
• Financing is with Affirm or Klarna via Stripe - our secure payment provider

Message us with any questions!
info@coalcreekguitars.com
(303) 376-9214 (call or text anytime)

🛍️We also have a large selection of brand new guitar essential accessories from brands like Dunlop, MXR, and Music Nomad. Everything from strings, picks, pedals, cables, capos, slides, and more, we have it all in our showroom.

About Coal Creek Guitars: Coal Creek Guitars has been serving the Denver area since 2017, specializing in clean, affordable, ready-to-play instruments.

Coal Creek Guitars – Curated used guitars, clean players, and great local deals. Buy with confidence.

In-shop amp lineup:
Marshall JCM 800 (Vintage/Marshall Crunch)
EVH 5150 Iconic Series EL34 15-watt (Modern High Gain)
VOX AC4 (Tube VOX Chime AND Low Watt Tube) - hear tube breakup at HUMAN volume
Marshall DSL40 Combo
Fender Deluxe Reverb (Fender Clean)
Fender Mustang IV (Loud Clean Pedal Platform - lots of headroom)
Marshall Code 100 (Modeling)
Fender Acoustic 100 (Acoustic)
Fender Rumble 100 (Bass)"""


def build_fbm_description(raw_description: str, footer: str | None = None) -> str:
    """Item text + the site's standard footer. `footer` should be the live value from the
    site's settings (CCGClient.get_sale_description_postfix); FBM_DESCRIPTION_POSTFIX is only
    the fallback if that couldn't be fetched."""
    footer = (footer or "").strip() or FBM_DESCRIPTION_POSTFIX
    raw = (raw_description or "").strip()
    if raw.endswith(footer):
        raw = raw[: -len(footer)].rstrip()
    return f"{raw}\n\n{footer}" if raw else footer

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


def open_draft_browser(playwright):
    """One browser, reused for every draft in a run — each draft opens in its own new tab
    (via create_draft_listing's `context`) rather than a separate browser window each time.
    Caller owns the lifecycle: close `browser` and call `playwright.stop()` when done."""
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context(storage_state=str(SESSION_FILE))
    return browser, context


def _load_all_selling_rows(page, row_button) -> None:
    stable_rounds = 0
    for _ in range(80):
        before = row_button.count()
        page.mouse.wheel(0, 3000)
        page.wait_for_timeout(800)
        clicked = _click_load_more(page)
        if clicked:
            page.wait_for_timeout(2000)
        if not clicked and row_button.count() == before:
            stable_rounds += 1
            if stable_rounds >= 3:
                return
        else:
            stable_rounds = 0


def delete_rows_with_title(context, title: str) -> tuple[int, int]:
    """Permanently deletes EVERY row on your selling page titled `title` (added 2026-09-20,
    ccg-fbm-sync Delete All mode). Irreversible on Facebook's side. Returns
    (deleted_count, rows_found_initially).

    Why by title, all copies at once: an item posted to Marketplace AND to groups exists as
    several separate listings with separate ids but the same title (confirmed live 2026-09-20 —
    David usually posts to 4 groups, and deleting one copy left the others, one even reappeared
    under a new id). List-view rows carry no listing id, so title is the only stable handle.

    Selectors confirmed live 2026-09-20 by probing a real listing (read-only, stopped before
    confirming): the listing page and Edit form have no delete control at all. Delete lives in
    the selling page's per-row "More actions for <title>" button -> menuitem "Delete" ->
    dialog "Delete listing?" with Delete / Cancel. Each delete is verified by the matching row
    count dropping by exactly one, not assumed from the clicks; on any failure it stops and
    reports how many were deleted so far (never raises).
    """
    page = context.new_page()
    deleted = 0
    found = 0
    try:
        page.goto(LISTINGS_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)

        row_button = page.get_by_role("button", name=f"More actions for {title}", exact=True)
        _load_all_selling_rows(page, row_button)
        found = row_button.count()
        remaining = found

        while remaining > 0:
            row_button.first.scroll_into_view_if_needed()
            row_button.first.click()
            page.wait_for_timeout(1000)
            page.get_by_role("menuitem", name="Delete", exact=True).click(timeout=5000)
            page.wait_for_timeout(1000)
            page.get_by_role("dialog", name="Delete listing?").get_by_role(
                "button", name="Delete", exact=True
            ).click(timeout=5000)

            for _ in range(15):
                page.wait_for_timeout(1000)
                if row_button.count() < remaining:
                    break
            if row_button.count() >= remaining:
                print(f"  Clicked Delete on '{title}' but the row count didn't drop — stopping this title.")
                break
            remaining = row_button.count()
            deleted += 1
    except Exception as error:
        print(f"  Error while deleting '{title}': {error}")
    finally:
        page.close()
    return deleted, found


def map_condition(ccg_condition: str) -> str:
    """CCG's condition text doesn't always match FB's four fixed options exactly, so this
    maps it: exact match first, then keyword heuristics, defaulting to 'Used - Good'."""
    normalized = (ccg_condition or "").strip().lower()
    for option in CONDITION_OPTIONS:
        if option.lower() == normalized:
            return option
    if "new" in normalized and "like" not in normalized:
        return "New"
    if "like new" in normalized or "excellent" in normalized or "mint" in normalized:
        return "Used - Like New"
    if "fair" in normalized or "poor" in normalized or "parts" in normalized or "project" in normalized:
        return "Used - Fair"
    return "Used - Good"


def _download_images(image_urls: list[str]) -> list[str]:
    """Two distinct, confirmed-live problems fixed here, not one (2026-09-13):

    1. CCG's stored photos are iPhone MPO files (a multi-frame JPEG container from Portrait
       mode): frame 0 is the true full-res photo (e.g. 5281x3961), frame 1 is a much smaller
       grayscale depth map (e.g. 2640x1980, mode "L") used for the bokeh effect, not a real
       photo at all. Fixed by decoding with Pillow and taking frame 0 explicitly.
    2. Fixing #1 alone still produced "major blur" in Facebook's own listing preview (visible
       to David directly, reproducible on a hard page reload — not a caching artifact). Root
       cause: these originals are enormous (5281x3961 = ~21 megapixels). Verified directly —
       uploading that same frame-0 photo *unresized* still came out blurry; downscaling the
       identical photo to 2048px on the long edge and re-uploading rendered perfectly sharp.
       Something in Facebook's own client-side handling of very large images (plausibly a
       canvas-based resize/preview step hitting a dimension or memory limit) mishandles them.
       Fixed by capping the long edge at `MAX_DRAFT_PHOTO_DIMENSION` (2048px) — comfortably
       more resolution than any marketplace listing needs, safely under whatever limit this
       is hitting.

    Both fixes are real and necessary; neither alone explained what David was seeing.
    """
    tmp_dir = tempfile.mkdtemp(prefix="fbm_draft_")
    paths: list[str] = []
    for i, url in enumerate(image_urls[:MAX_DRAFT_PHOTOS]):
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as error:
            print(f"  Couldn't download image {i} ({url}): {error}")
            continue

        path = str(Path(tmp_dir) / f"photo_{i}.jpg")
        try:
            img = Image.open(io.BytesIO(resp.content))
            img.seek(0)  # explicit: always the primary frame, never MPO's secondary/depth frame
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.thumbnail((MAX_DRAFT_PHOTO_DIMENSION, MAX_DRAFT_PHOTO_DIMENSION), Image.LANCZOS)
            img.save(path, "JPEG", quality=90)
        except Exception as error:
            print(f"  Couldn't re-encode image {i}, using raw downloaded bytes instead: {error}")
            with open(path, "wb") as f:
                f.write(resp.content)
        paths.append(path)
    return paths


def _step_summary(page) -> str:
    """Current URL plus the visible step heading(s), for diagnosing where a run got to."""
    try:
        headings = [
            (h.inner_text() or "").strip().replace("\n", " / ")
            for h in page.locator("[role='heading']").all()[:4]
        ]
    except Exception:
        headings = []
    return f"url={page.url} headings={headings}"


def _dump_page_controls(page) -> None:
    """Writes every switch/checkbox/button/combobox on the page (role, aria state, label, text,
    visibility) to debug_dump.txt so a failed step can be diagnosed without re-running it."""
    lines = [f"{_step_summary(page)}", ""]
    for el in page.locator("[role='switch'], [role='checkbox'], input[type='checkbox'], "
                           "[role='button'], button, [role='combobox']").all():
        try:
            lines.append(
                f"role={el.get_attribute('role')} type={el.get_attribute('type')} "
                f"aria-checked={el.get_attribute('aria-checked')} aria-label={el.get_attribute('aria-label')!r} "
                f"visible={el.is_visible()} text={(el.inner_text() or '').strip()[:60]!r}"
            )
        except Exception:
            continue
    lines += ["", "--- visible text mentioning offers/price ---"]
    for el in page.get_by_text("offer", exact=False).all()[:15] + page.get_by_text("price", exact=False).all()[:15]:
        try:
            lines.append(f"visible={el.is_visible()} text={(el.inner_text() or '').strip()[:100]!r}")
        except Exception:
            continue
    DEBUG_DUMP.write_text("\n".join(lines))


def _pause_for_inspection(page, reason: str) -> None:
    """Leave the browser open on the failed step so it can be looked at (and dump its controls)."""
    try:
        _dump_page_controls(page)
        page.screenshot(path=str(DEBUG_SCREENSHOT))
    except Exception:
        pass
    print(f"  {reason}\n  Browser left open on the failed step; control dump saved to {DEBUG_DUMP.name}.")
    input("  Press Enter to close the browser and continue... ")


def _set_delivery_method(page, label: str) -> bool:
    """Picks the Delivery method dropdown's value. Needed because the account default now
    pre-selects "Shipping & local pickup" (confirmed live 2026-09-20), so the old assumption
    that the form opens on local pickup no longer holds."""
    box = page.locator("[role='combobox']").filter(has_text="Delivery method").first
    box.scroll_into_view_if_needed()
    current = (box.inner_text() or "").strip().split("\n")[-1].strip()
    if current.lower() == label.lower():
        return True
    box.click()
    page.wait_for_timeout(800)
    option = page.get_by_role("option", name=label, exact=True)
    if option.count() == 0:
        option = page.get_by_text(label, exact=True)
    option.last.click(timeout=5000)
    page.wait_for_timeout(1000)
    after = (box.inner_text() or "").strip().split("\n")[-1].strip()
    return after.lower() == label.lower()


def _configure_own_label_shipping(page, shipping_cost) -> bool:
    """Shipping label row -> "Change shipping method" dialog -> Shipping option "Use your own
    label" -> Shipping rate = the fixed cost -> Update. Flow confirmed from live screenshots
    2026-09-20; selectors are text-based since this form has no stable aria-labels."""
    page.get_by_text("Select shipping label", exact=True).first.click(timeout=5000)
    dialog = page.get_by_role("dialog", name="Change shipping method")
    dialog.wait_for(timeout=8000)

    option_box = dialog.locator("[role='combobox']").filter(has_text="Shipping option").first
    option_box.click()
    page.wait_for_timeout(800)
    own = page.get_by_role("option", name=SHIPPING_OWN_LABEL_OPTION, exact=True)
    if own.count() == 0:
        own = page.get_by_text(SHIPPING_OWN_LABEL_OPTION, exact=True)
    own.last.click(timeout=5000)
    page.wait_for_timeout(1000)

    rate = dialog.get_by_label("Shipping rate")
    if rate.count() == 0:
        rate = dialog.locator("input[type='text']").last
    rate.first.click()
    rate.first.fill(f"{float(shipping_cost):g}")
    page.wait_for_timeout(500)
    dialog.get_by_role("button", name="Update", exact=True).click(timeout=5000)
    page.wait_for_timeout(1500)
    return page.get_by_text("Your own label", exact=False).count() > 0


def _turn_off_offers(page) -> bool:
    """Allow offers step: always OFF. The toggle is a real role=switch whose aria-checked is the
    ground truth (confirmed from a live page dump 2026-09-20). Do NOT infer state from the
    "Minimum price you'll consider" text: a screen-reader-only validation message containing
    those words stays in the DOM (and reads as visible) even with offers off, which made an
    earlier version think offers was still on and click it a second time. Clicks at most once,
    then polls aria-checked."""
    page.get_by_text("Allow offers", exact=True).first.wait_for(timeout=8000)
    page.wait_for_timeout(1500)
    toggle = page.get_by_role("switch").first
    toggle.wait_for(timeout=8000)

    def is_on() -> bool:
        return toggle.get_attribute("aria-checked") == "true"

    if not is_on():
        return True
    toggle.click()
    for _ in range(8):
        page.wait_for_timeout(1000)
        if not is_on():
            return True
    return False


def create_draft_listing(
    context,
    title: str,
    price,
    condition: str,
    description: str,
    image_urls: list[str],
    allow_shipping: bool = False,
    shipping_cost=None,
    footer: str | None = None,
) -> str | None:
    """Fills Facebook's real "Item for sale" create-listing form — photos, title, price,
    category (fixed at Musical Instruments), condition, description — advances to the
    Delivery step and checks all 3 meetup preferences (Public meetup, Door pickup, Door
    dropoff), then clicks FB's own **Save draft** (top-right on every step) rather than
    continuing to Publish. This persists it server-side in Facebook's actual Drafts list
    (Marketplace > Create new listing > Drafts) — confirmed via the "Draft saved
    successfully" toast and the draft appearing there — so several can be queued up in one
    run and finished/published later at your own pace, independent of any browser tab
    staying open. Never clicks Publish. Closes its tab when done (nothing left to review
    live).

    allow_shipping / shipping_cost (added 2026-09-20, Add All mode). Flow confirmed from live
    screenshots: the account default now pre-selects "Shipping & local pickup", so the Delivery
    method dropdown is always set explicitly. shipping_cost of 0 (or allow_shipping False) ->
    "Local pickup" + the 3 meetup boxes, exactly as before. shipping_cost > 0 -> "Shipping &
    local pickup" (which replaces the meetup section with a "Shipping label" row): open the
    label dialog, Shipping option "Use your own label", Shipping rate = shipping_cost, Update;
    Next to the "Allow offers" step, always turned OFF; then Save draft. If any shipping step
    fails, the draft is NOT saved (returns None) rather than saving a mis-configured listing.
    Selectors are text-based and not yet run end-to-end — expect to tune them on the first run.

    Returns the new listing's FB id on a confirmed save (parsed straight from the save
    request's own GraphQL response — `data.marketplace_listing_create.listing.id`, confirmed
    live 2026-09-13 — not a guess or a DOM lookup), or None if it aborted early (e.g. no
    photos downloaded) or the save couldn't be confirmed.
    """
    photo_paths = _download_images(image_urls)
    if not photo_paths:
        print("  No photos could be downloaded — can't draft (FB requires at least one photo).")
        return None

    mapped_condition = map_condition(condition)

    page = context.new_page()
    page.goto(CREATE_LISTING_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    page.locator("input[type='file'][accept*='image']").first.set_input_files(photo_paths)
    page.wait_for_timeout(4000)

    text_inputs = page.locator("input[type='text']")
    text_inputs.nth(0).click()
    text_inputs.nth(0).fill(title)
    text_inputs.nth(1).click()
    text_inputs.nth(1).fill(str(price))

    category_box = page.locator("[role='combobox']").nth(1)
    category_box.scroll_into_view_if_needed()
    category_box.click()
    page.wait_for_timeout(800)
    page.get_by_text(DRAFT_CATEGORY, exact=True).first.click()
    page.wait_for_timeout(800)

    condition_box = page.locator("[role='combobox']").nth(2)
    condition_box.scroll_into_view_if_needed()
    condition_box.click()
    page.wait_for_timeout(800)
    page.get_by_text(mapped_condition, exact=True).first.click()
    page.wait_for_timeout(800)

    textarea = page.locator("textarea").first
    textarea.scroll_into_view_if_needed()
    textarea.click()
    textarea.fill(build_fbm_description(description, footer))
    page.wait_for_timeout(800)

    page.get_by_role("button", name="Next", exact=True).click()  # -> Delivery step
    page.wait_for_timeout(2500)

    # Meetup preferences: Public meetup / Door pickup / Door dropoff. These are NOT real
    # <input type=checkbox> elements (only the unrelated "Set shipping & local pickup as
    # default" toggle above them is) — they're plain divs with no checkbox role at all.
    # Clicking each row's own label text toggles it correctly (confirmed via the preview
    # panel updating) and is simpler than hunting for whatever custom element draws the
    # checkbox square itself.
    use_shipping = bool(allow_shipping) and float(shipping_cost or 0) > 0

    if not _set_delivery_method(page, DELIVERY_SHIPPING_AND_LOCAL if use_shipping else DELIVERY_LOCAL_ONLY):
        print("  Couldn't set the Delivery method dropdown — not saving this draft.")
        page.close()
        return None

    if use_shipping:
        try:
            if not _configure_own_label_shipping(page, shipping_cost):
                raise RuntimeError("shipping label row didn't show 'Your own label' after Update")
            page.get_by_role("button", name="Next", exact=True).click()  # -> Allow offers
            page.wait_for_timeout(2000)
            if not _turn_off_offers(page):
                raise RuntimeError("couldn't turn Allow offers off")
        except Exception as error:
            _pause_for_inspection(
                page, f"Shipping setup failed — not saving this draft (Facebook's layout may have changed): {error}"
            )
            page.close()
            return None
    else:
        for label_text in MEETUP_PREFERENCE_LABELS:
            try:
                page.get_by_text(label_text, exact=True).first.click(timeout=5000)
            except Exception:
                print(f"  Couldn't check '{label_text}' — Facebook's delivery-step layout may have changed.")
        page.wait_for_timeout(500)

    new_listing_id: str | None = None

    def _capture_listing_id(response) -> None:
        nonlocal new_listing_id
        if new_listing_id is not None:
            return
        if response.request.method != "POST" or "graphql" not in response.url:
            return
        try:
            data = response.json()
        except Exception:
            return
        listing_id = (
            data.get("data", {})
            .get("marketplace_listing_create", {})
            .get("listing", {})
            .get("id")
        )
        if listing_id:
            new_listing_id = str(listing_id)

    page.on("response", _capture_listing_id)
    print(f"  Saving draft from: {_step_summary(page)}")
    page.get_by_text("Save draft", exact=True).first.click()

    # A successful save redirects away from the create-item form back to the listing-type
    # hub — a more durable signal than the "Draft saved successfully" toast, which can be
    # gone before a fixed wait catches it (confirmed: with 8 photos, 2.5s wasn't always
    # enough and this returned a false "not saved" on a save that had actually worked).
    saved = False
    for _ in range(10):
        page.wait_for_timeout(1000)
        if "step=" not in page.url and page.url.rstrip("/").endswith("/create"):
            saved = True
            break
    page.remove_listener("response", _capture_listing_id)

    if saved:
        print("  Saved to Facebook's Drafts (Marketplace > Create new listing > Drafts).")
        if new_listing_id is None:
            print("  WARNING: saved, but couldn't capture the new listing id from the save response.")
    else:
        print("  WARNING: clicked Save draft but couldn't confirm the success toast — check FB's Drafts list.")
        print(f"  After clicking, the page was: {_step_summary(page)}")
        page.screenshot(path=str(DEBUG_SCREENSHOT))
    page.close()
    return new_listing_id if saved else None
