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
import json
import re
import tempfile
from urllib.parse import parse_qs
from dataclasses import dataclass
from pathlib import Path

import requests
from PIL import Image, ImageOps
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
SHIPPING_OWN_LABEL_OPTION = "Use your own label"
# FB Marketplace doesn't allow shipping on items priced over this — the Shipping row in the
# Delivery method menu is greyed out (confirmed live 2026-10-04 on a $3,499 guitar).
FB_MAX_SHIPPING_PRICE = 500
# FB rejects longer titles ("Please enter a shorter title.", Next stays disabled) — confirmed
# live 2026-10-05: 106 chars rejected, ~95 accepted.
FB_MAX_TITLE_LENGTH = 100

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
            try:
                el.click(timeout=5000)
            except Exception as error:
                print(f"    Couldn't click Grid view (continuing anyway): {error}")
                return
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
                el.click(timeout=3000)
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

        # Every action below has an explicit short timeout and every iteration prints
        # progress — an earlier version left _click_load_more's click at Playwright's default
        # (~30s) action timeout with no console output per iteration, so a single stale/
        # non-actionable "Load more" button could silently eat minutes per pass across up to
        # 60 iterations and look exactly like the browser hanging or endlessly reloading
        # (found live 2026-09-20, on the already-fixed delete_titles code path's sibling here).
        for i in range(60):  # 60 * 25 ≈ 1500, comfortably above any real listing count
            seen.update(_harvest_anchors(page))
            print(f"  pass {i + 1}: {len(seen)} listing(s) found so far (url={page.url})", end="\r")

            before = len(seen)
            try:
                page.mouse.wheel(0, 3000)
            except Exception:
                pass
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
        print(f"  finished after scraping: {len(seen)} listing(s) found.                    ")

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


_POPUP_CLOSE_LABELS = {"close chat", "close conversation", "close", "hide", "close popup"}


def _dismiss_popups(page) -> None:
    """Facebook's Messenger chat popup can appear mid-session and sit on top of the selling
    page, intercepting clicks on whatever it overlaps — confirmed live 2026-09-20 (David closing
    it by hand made delete failures stop). Called before every delete attempt. Best-effort:
    never raises, and Escape alone is often enough even if the label-based click below finds
    nothing to close."""
    try:
        page.keyboard.press("Escape")
    except Exception:
        pass
    try:
        for el in page.query_selector_all("[aria-label]"):
            label = (el.get_attribute("aria-label") or "").strip().lower()
            if label in _POPUP_CLOSE_LABELS and el.is_visible():
                try:
                    el.click(timeout=1000)
                except Exception:
                    continue
    except Exception:
        pass


def _delete_row_at(page, index: int) -> tuple[bool, str]:
    """Deletes the row at `index` among CURRENTLY VISIBLE rows on an already-loaded selling
    page — no title/id matching involved in picking what to act on. Returns (True, title) on a
    verified delete, (False, title) if a delete was attempted but failed or couldn't be
    confirmed (never raises). Prints which specific step failed (open menu / click Delete /
    confirm dialog / row didn't disappear) so a future failure is diagnosable from the log
    instead of just "something timed out" (found live 2026-09-20: the combined try/except gave
    no way to tell which of the three clicks had failed).
    """
    all_rows = page.locator("[aria-label^='More actions for ']")
    before = all_rows.count()
    row = all_rows.nth(index)
    title = (row.get_attribute("aria-label") or "").removeprefix("More actions for ").strip() or "(untitled row)"

    _dismiss_popups(page)

    step = "opening the 3-dot menu"
    try:
        row.scroll_into_view_if_needed(timeout=8000)
        page.wait_for_timeout(400)  # let any scroll-triggered reflow settle before clicking
        row.click(timeout=8000)
        page.wait_for_timeout(800)

        step = "clicking Delete in the menu"
        page.get_by_role("menuitem", name="Delete", exact=True).click(timeout=8000)
        page.wait_for_timeout(800)

        step = "confirming the delete dialog"
        page.get_by_role("dialog", name="Delete listing?").get_by_role(
            "button", name="Delete", exact=True
        ).click(timeout=8000)
    except Exception as error:
        first_line = str(error).strip().split("\n")[0]
        print(f"  Couldn't delete '{title}' — failed while {step}: {first_line}")
        return False, title

    for _ in range(15):
        page.wait_for_timeout(1000)
        if all_rows.count() < before:
            return True, title
    print(f"  Clicked Delete on '{title}' but the row count didn't drop.")
    return False, title


def delete_everything_on_selling_page(context, limit: int | None = None) -> tuple[int, bool]:
    """Deletes listings on your selling page ONE AT A TIME, always acting on whichever is
    currently in front of you — never matching by title or id (added 2026-09-20, replacing an
    earlier title-matching design). Returns (deleted_count, swept_clean) where swept_clean is
    True only if the page was confirmed empty after two consecutive fresh reloads.

    A listing that fails to delete is SKIPPED (tries the next one instead of stopping the whole
    run), up to 2 attempts per title before giving up on it for good — found live 2026-09-20
    that stopping the entire run on one flaky listing was too fragile for a ~150-listing sweep.
    Skipped titles are tracked across page reloads too (not just within one loaded batch), so a
    listing that keeps failing doesn't get retried forever across reload cycles. If EVERY
    currently visible row has already exhausted its retries, the run stops rather than looping.

    Why no title/id matching for picking what to delete: the previous version correlated
    listings scraped in Grid view (for preview/ids) against rows in List view (for deleting) by
    matching title TEXT between the two — but the two views can render/truncate the same title
    differently, so the match silently failed on some listings, which is what made deletes
    "consistently fail" on a real run. This mirrors exactly how David does it by hand: click the
    3-dot menu on whatever's in front of you, delete it, move to the next; if the page runs out
    of visible listings, reload the whole page (once, not "Load more" — no scrolling/pagination
    anywhere in this function) and keep going.

    Irreversible on Facebook's side. `limit`, if given, stops after that many deletions
    (without needing the page to run empty) — for testing on a handful of items first.
    """
    page = context.new_page()
    deleted = 0
    swept_clean = False
    failure_counts: dict[str, int] = {}
    MAX_ATTEMPTS_PER_TITLE = 2
    try:
        page.goto(LISTINGS_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        _dismiss_popups(page)

        empty_reloads = 0
        while limit is None or deleted < limit:
            all_rows = page.locator("[aria-label^='More actions for ']")
            total = all_rows.count()

            if total == 0:
                empty_reloads += 1
                if empty_reloads > 2:
                    swept_clean = True
                    break
                print(f"  No listings visible — reloading the page ({empty_reloads}/2 checks)...")
                page.reload(wait_until="domcontentloaded")
                page.wait_for_timeout(4000)
                _dismiss_popups(page)
                continue

            # Pick the first currently-visible row that hasn't already exhausted its retries.
            index = None
            for i in range(total):
                candidate_title = (
                    all_rows.nth(i).get_attribute("aria-label") or ""
                ).removeprefix("More actions for ").strip() or "(untitled row)"
                if failure_counts.get(candidate_title, 0) < MAX_ATTEMPTS_PER_TITLE:
                    index = i
                    break
            if index is None:
                print(
                    f"  All {total} visible listing(s) already failed to delete "
                    f"{MAX_ATTEMPTS_PER_TITLE} time(s) each — stopping rather than loop. "
                    "Delete these manually, then rerun."
                )
                break

            ok, title = _delete_row_at(page, index)
            if ok:
                deleted += 1
                empty_reloads = 0
                failure_counts.pop(title, None)
                print(f"  [{deleted}] deleted: {title}")
            else:
                failure_counts[title] = failure_counts.get(title, 0) + 1
    finally:
        page.close()
    return deleted, swept_clean


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


def _fb_title(title: str) -> str:
    """CCG's title, shortened to FB's limit only if needed: cut at the last whole word that
    fits, then drop any dangling separator or unclosed bracket left at the end."""
    title = " ".join(title.split())
    if len(title) <= FB_MAX_TITLE_LENGTH:
        return title
    cut = title[: FB_MAX_TITLE_LENGTH + 1].rsplit(" ", 1)[0]
    while True:
        trimmed = cut.rstrip(" -–—,;:/|&+")
        if trimmed.count("(") > trimmed.count(")"):
            trimmed = trimmed[: trimmed.rfind("(")]
        if trimmed == cut:
            return cut
        cut = trimmed


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
            # Bake the EXIF Orientation into the pixels: re-saving drops the EXIF tag, so a
            # photo stored sideways + "rotate 90" tag (common from iPhones) uploaded rotated
            # (2026-10-05).
            img = ImageOps.exif_transpose(img)
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


def _click_dropdown_option(page, label: str) -> None:
    """Clicks an open dropdown's option by its exact label. Targets role=option first, then
    falls back to *visible* text only — a bare get_by_text(...).first can resolve to a hidden
    element elsewhere on the page with the same text (confirmed live 2026-10-03: condition
    "New" matched a hidden "New" span and timed out instead of clicking the option)."""
    option = page.get_by_role("option", name=label, exact=True)
    if option.count() == 0:
        option = page.get_by_text(label, exact=True).filter(visible=True)
    option.first.click(timeout=5000)


def _check_meetup_preference(page, label: str) -> bool:
    """Ticks one meetup preference row. As of 2026-10-04 each row is a role=checkbox with
    aria-checked (it used to be a plain div), so find it by its label, click only if it's off,
    and confirm aria-checked flipped. Falls back to clicking the label text if no such row."""
    row = page.get_by_role("checkbox").filter(has_text=label).filter(visible=True)
    if row.count() == 0:
        try:
            page.get_by_text(label, exact=True).filter(visible=True).first.click(timeout=5000)
            return True
        except Exception:
            return False
    row = row.first
    if row.get_attribute("aria-checked") == "true":
        return True
    try:
        row.click(timeout=5000)
    except Exception:
        return False
    for _ in range(4):
        page.wait_for_timeout(500)
        if row.get_attribute("aria-checked") == "true":
            return True
    return False


def _delivery_modes(box) -> tuple[bool, bool]:
    """(shipping on, local pickup on), read from the Delivery method box's value text — every
    line after the "Delivery method" caption, e.g. "Shipping" or "Local pickup"."""
    lines = [line.strip().lower() for line in (box.inner_text() or "").split("\n") if line.strip()]
    value = " ".join(line for line in lines if line != "delivery method")
    return "shipping" in value, "pickup" in value


def _set_delivery_method(page, want_shipping: bool) -> bool:
    """Sets the Delivery method control. Since ~2026-10-03 (confirmed live 2026-10-04) it's a
    menu of two independent checkbox rows, "Shipping" and "Local pickup" — not a single-choice
    dropdown — and the account default ("Set shipping and local pickup as default") opens it
    with both on. Clicking a row's label toggles it, so: read which modes are on from the box
    text, toggle each row that's wrong, close the menu, and re-check. Local pickup is always
    wanted; Shipping only when want_shipping. On failure the browser is left open."""
    box = page.locator("[role='combobox']").filter(has_text="Delivery method").first
    box.scroll_into_view_if_needed()
    wanted = (want_shipping, True)

    trace = [f"start: {(box.inner_text() or '').strip()!r}"]
    if _delivery_modes(box) != wanted:
        box.click()
        page.wait_for_timeout(800)
        current = _delivery_modes(box)
        for step, (row_label, is_on, should_be_on) in enumerate((
            ("Shipping", current[0], wanted[0]),
            ("Local pickup", current[1], wanted[1]),
        )):
            if is_on != should_be_on:
                page.get_by_text(row_label, exact=True).filter(visible=True).last.click(timeout=5000)
                page.wait_for_timeout(1200)
                shot = DEBUG_SCREENSHOT.with_name(f"debug_delivery_{step}.png")
                page.screenshot(path=str(shot))
                trace.append(f"after clicking {row_label!r}: {(box.inner_text() or '').strip()!r} ({shot.name})")
        # Turning Shipping on may open a setup dialog; Escape would cancel it, so only press
        # Escape (to close the menu) when no dialog is up.
        if page.get_by_role("dialog").filter(visible=True).count() == 0:
            page.keyboard.press("Escape")
        else:
            trace.append("a dialog was open after the clicks — left it, didn't press Escape")

    # The box text can lag the click (2026-10-04: a check 1s after Escape read the old value
    # though the box showed "Local pickup" moments later), so poll rather than read once.
    for _ in range(8):
        page.wait_for_timeout(750)
        if _delivery_modes(box) == wanted:
            return True
    _pause_for_inspection(
        page,
        f"Delivery method didn't end up as shipping={wanted[0]}, local pickup={wanted[1]}. "
        f"Box now reads {(box.inner_text() or '').strip()!r}. Trace: {trace}",
    )
    return False


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
    fb_title = _fb_title(title)
    if fb_title != title:
        print(f"  Title is {len(title)} chars (FB max {FB_MAX_TITLE_LENGTH}) — using on FB: {fb_title!r}")
    text_inputs.nth(0).fill(fb_title)
    text_inputs.nth(1).click()
    text_inputs.nth(1).fill(str(price))

    category_box = page.locator("[role='combobox']").nth(1)
    category_box.scroll_into_view_if_needed()
    category_box.click()
    page.wait_for_timeout(800)
    _click_dropdown_option(page, DRAFT_CATEGORY)
    page.wait_for_timeout(800)

    condition_box = page.locator("[role='combobox']").nth(2)
    condition_box.scroll_into_view_if_needed()
    condition_box.click()
    page.wait_for_timeout(800)
    _click_dropdown_option(page, mapped_condition)
    page.wait_for_timeout(800)

    textarea = page.locator("textarea").first
    textarea.scroll_into_view_if_needed()
    textarea.click()
    textarea.fill(build_fbm_description(description, footer))
    page.wait_for_timeout(800)

    # Next stays aria-disabled until every required field is valid and photo uploads finish
    # (2026-10-05: one item timed out here with no clue why). Give uploads time, then leave
    # the browser open on the form rather than crashing the whole run.
    next_button = page.get_by_role("button", name="Next", exact=True)
    for _ in range(30):
        if next_button.get_attribute("aria-disabled") != "true":
            break
        page.wait_for_timeout(1000)
    else:
        _pause_for_inspection(
            page,
            "Facebook kept Next disabled on the listing-details step — a field wasn't accepted "
            "(title length, price, category, condition, description) or photos never finished uploading. "
            "Not saving this draft.",
        )
        page.close()
        return None
    next_button.click()  # -> Delivery step
    page.wait_for_timeout(2500)

    # Meetup preferences (Public meetup / Door pickup / Door dropoff) — see
    # _check_meetup_preference.
    use_shipping = bool(allow_shipping) and float(shipping_cost or 0) > 0
    if use_shipping and float(price or 0) > FB_MAX_SHIPPING_PRICE:
        print(
            f"  FB doesn't allow shipping over ${FB_MAX_SHIPPING_PRICE} — drafting as local pickup only "
            "(CCG's shipping settings are unchanged)."
        )
        use_shipping = False

    if not _set_delivery_method(page, want_shipping=use_shipping):
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
            if not _check_meetup_preference(page, label_text):
                print(f"  Couldn't check '{label_text}' — Facebook's delivery-step layout may have changed.")
        page.wait_for_timeout(500)

    new_listing_id: str | None = None

    save_trace: list[str] = []

    def _capture_listing_id(response) -> None:
        # Tolerant on purpose (2026-10-05: a save succeeded but the id wasn't captured): FB
        # can prefix "for (;;);" or stream several JSON objects line by line, and the mutation
        # name isn't guaranteed — accept any data.marketplace_listing*.listing.id. Every
        # GraphQL POST seen is recorded so a miss can be diagnosed from debug_dump.txt.
        nonlocal new_listing_id
        if response.request.method != "POST" or "graphql" not in response.url:
            return
        try:
            friendly = parse_qs(response.request.post_data or "").get("fb_api_req_friendly_name", ["?"])[0]
            text = response.text()
        except Exception as error:
            save_trace.append(f"(unreadable response: {error})")
            return
        keys: list[str] = []
        for chunk in text.removeprefix("for (;;);").splitlines():
            try:
                data = json.loads(chunk).get("data") or {}
            except (ValueError, AttributeError):
                continue
            keys += list(data)
            for key, value in data.items():
                if new_listing_id is None and key.startswith("marketplace_listing") and isinstance(value, dict):
                    listing_id = (value.get("listing") or {}).get("id")
                    if listing_id:
                        new_listing_id = str(listing_id)
        save_trace.append(f"{friendly}: data keys {keys} | {text[:300]!r}")

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
            DEBUG_DUMP.write_text("GraphQL POSTs seen during Save draft:\n\n" + "\n\n".join(save_trace))
            print(
                "  WARNING: saved, but couldn't capture the new listing id from the save response "
                f"({len(save_trace)} GraphQL responses logged to {DEBUG_DUMP.name}). The draft is on FB "
                "but NOT linked in CCG — delete it from FB Drafts before re-running, or it'll be duplicated."
            )
    else:
        print("  WARNING: clicked Save draft but couldn't confirm the success toast — check FB's Drafts list.")
        print(f"  After clicking, the page was: {_step_summary(page)}")
        page.screenshot(path=str(DEBUG_SCREENSHOT))
    page.close()
    return new_listing_id if saved else None
