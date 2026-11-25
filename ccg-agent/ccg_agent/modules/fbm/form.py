"""Facebook Marketplace form helpers, copied from ccg-fbm-sync/fbm_client.py (2026-11-24).

The selectors and the live-tested quirks noted below come from that tool. Differences:
nothing here waits for keyboard input or writes debug files — a failed step raises
FbmStepError, and the job handler takes a screenshot for Admin.

Facebook's form has almost no aria-labels on its own fields, so much is matched by DOM position
or visible text. Expect to retune when Facebook changes the layout.
"""
from __future__ import annotations

import io
import re
import shutil
import tempfile
from pathlib import Path

import requests
from PIL import Image, ImageOps

LISTING_CATEGORY = "Musical Instruments"
MAX_PHOTOS = 10
MAX_PHOTO_DIMENSION = 2048
CONDITION_OPTIONS = ["New", "Used - Like New", "Used - Good", "Used - Fair"]
MEETUP_PREFERENCE_LABELS = ["Public meetup", "Door pickup", "Door dropoff"]
SHIPPING_OWN_LABEL_OPTION = "Use your own label"
# FB Marketplace doesn't allow shipping on items priced over this — the Shipping row in the
# Delivery method menu is greyed out (confirmed live 2026-10-04 on a $3,499 guitar).
FB_MAX_SHIPPING_PRICE = 500
# FB rejects longer titles ("Please enter a shorter title.") — 106 chars rejected, ~95 accepted.
FB_MAX_TITLE_LENGTH = 100

# Fallback only: the Worker sends the site's live footer with each job.
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


class FbmStepError(Exception):
    """A form step didn't do what it should. The message says which step."""


# ---------------------------------------------------------------------------------- values

def build_description(raw_description: str, footer: str | None = None) -> str:
    footer = (footer or "").strip() or FBM_DESCRIPTION_POSTFIX
    raw = (raw_description or "").strip()
    if raw.endswith(footer):
        raw = raw[: -len(footer)].rstrip()
    return f"{raw}\n\n{footer}" if raw else footer


def map_condition(ccg_condition: str) -> str:
    """CCG's condition text -> one of FB's four options (exact, then keywords, else Used - Good)."""
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


def fb_title(title: str) -> str:
    """Shortened to FB's limit only if needed: cut at the last whole word that fits, then drop
    any dangling separator or unclosed bracket left at the end."""
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


def wants_shipping(allow_shipping: bool, price: float) -> bool:
    """A $0 shipping cost is free shipping, not "no shipping"; only allow_shipping decides. But FB
    won't ship anything over $500, so those are local pickup only."""
    return bool(allow_shipping) and float(price or 0) <= FB_MAX_SHIPPING_PRICE


class Photos:
    """Downloads listing photos to a temp folder (deleted on exit). Two live-confirmed fixes
    (2026-09-13): CCG's iPhone MPO photos are decoded as frame 0 (frame 1 is a depth map), and the
    long edge is capped at 2048px (FB blurs ~21MP uploads). EXIF orientation is baked in."""

    def __init__(self, image_urls: list[str], log):
        self.image_urls = image_urls[:MAX_PHOTOS]
        self.log = log
        self.dir: str | None = None
        self.paths: list[str] = []

    def __enter__(self) -> list[str]:
        self.dir = tempfile.mkdtemp(prefix="ccg_agent_fbm_")
        for i, url in enumerate(self.image_urls):
            try:
                resp = requests.get(url, timeout=30)
                resp.raise_for_status()
            except requests.RequestException as error:
                self.log.warning("Couldn't download photo %s (%s): %s", i, url, error)
                continue
            path = str(Path(self.dir) / f"photo_{i}.jpg")
            try:
                img = Image.open(io.BytesIO(resp.content))
                img.seek(0)
                img = ImageOps.exif_transpose(img)
                if img.mode != "RGB":
                    img = img.convert("RGB")
                img.thumbnail((MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION), Image.LANCZOS)
                img.save(path, "JPEG", quality=90)
            except Exception as error:
                self.log.warning("Couldn't re-encode photo %s, using the raw bytes: %s", i, error)
                Path(path).write_bytes(resp.content)
            self.paths.append(path)
        return self.paths

    def __exit__(self, *exc) -> None:
        if self.dir:
            shutil.rmtree(self.dir, ignore_errors=True)


# ---------------------------------------------------------------------------------- page

def step_summary(page) -> str:
    try:
        headings = [
            (h.inner_text() or "").strip().replace("\n", " / ")
            for h in page.locator("[role='heading']").all()[:4]
        ]
    except Exception:
        headings = []
    return f"url={page.url} headings={headings}"


def dismiss_popups(page) -> None:
    """Messenger chat popups can sit on top of the form and swallow clicks. Best-effort."""
    try:
        page.keyboard.press("Escape")
    except Exception:
        pass
    try:
        for el in page.query_selector_all("[aria-label]"):
            label = (el.get_attribute("aria-label") or "").strip().lower()
            if label in {"close chat", "close conversation", "close popup"} and el.is_visible():
                try:
                    el.click(timeout=1000)
                except Exception:
                    continue
    except Exception:
        pass


def click_dropdown_option(page, label: str) -> None:
    """role=option first, then *visible* text only (a bare get_by_text can hit a hidden span with
    the same text — confirmed live 2026-10-03 with condition "New")."""
    option = page.get_by_role("option", name=label, exact=True)
    if option.count() == 0:
        option = page.get_by_text(label, exact=True).filter(visible=True)
    option.first.click(timeout=5000)


def fill_text(locator, value: str) -> None:
    locator.click()
    locator.fill("")
    locator.fill(value)


def set_category(page) -> None:
    """FB may show a "Suggested category" chip; prefer it, then verify the combobox took a value
    (the chip can otherwise steal the dropdown click — seen 2026-10-14)."""
    category_box = page.locator("[role='combobox']").filter(has_text="Category").first
    if category_box.count() == 0:
        category_box = page.locator("[role='combobox']").nth(1)
    suggested = page.get_by_role("button", name=f"Suggested category: {LISTING_CATEGORY}", exact=True)
    if suggested.count() > 0:
        suggested.first.click()
        page.wait_for_timeout(800)
    if LISTING_CATEGORY not in (category_box.inner_text() or ""):
        category_box.scroll_into_view_if_needed()
        category_box.click()
        page.wait_for_timeout(800)
        click_dropdown_option(page, LISTING_CATEGORY)
        page.wait_for_timeout(800)


def set_condition(page, condition: str) -> None:
    box = page.locator("[role='combobox']").filter(has_text="Condition").first
    if box.count() == 0:
        box = page.locator("[role='combobox']").nth(2)
    if condition in (box.inner_text() or ""):
        return
    box.scroll_into_view_if_needed()
    box.click()
    page.wait_for_timeout(800)
    click_dropdown_option(page, condition)
    page.wait_for_timeout(800)


def wait_until_enabled(button, page, seconds: int = 60) -> bool:
    """Next stays aria-disabled until every field is valid and photo uploads finish."""
    for _ in range(seconds):
        if button.count() and button.first.get_attribute("aria-disabled") != "true":
            return True
        page.wait_for_timeout(1000)
    return False


def check_meetup_preference(page, label: str) -> bool:
    """Each meetup row is a role=checkbox with aria-checked (since 2026-10-04)."""
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
    lines = [line.strip().lower() for line in (box.inner_text() or "").split("\n") if line.strip()]
    value = " ".join(line for line in lines if line != "delivery method")
    return "shipping" in value, "pickup" in value


def set_delivery_method(page, want_shipping: bool) -> None:
    """The Delivery method control is a menu of two independent checkbox rows ("Shipping",
    "Local pickup"); the account default opens with both on. Toggle each wrong row, close the
    menu, and poll (the box text lags the click). Local pickup is always on."""
    box = page.locator("[role='combobox']").filter(has_text="Delivery method").first
    box.scroll_into_view_if_needed()
    wanted = (want_shipping, True)
    if _delivery_modes(box) != wanted:
        box.click()
        page.wait_for_timeout(800)
        current = _delivery_modes(box)
        for row_label, is_on, should_be_on in (
            ("Shipping", current[0], wanted[0]),
            ("Local pickup", current[1], wanted[1]),
        ):
            if is_on != should_be_on:
                page.get_by_text(row_label, exact=True).filter(visible=True).last.click(timeout=5000)
                page.wait_for_timeout(1200)
        # Turning Shipping on may open a setup dialog; Escape would cancel it.
        if page.get_by_role("dialog").filter(visible=True).count() == 0:
            page.keyboard.press("Escape")
    for _ in range(8):
        page.wait_for_timeout(750)
        if _delivery_modes(box) == wanted:
            return
    raise FbmStepError(
        f"Delivery method didn't end up as shipping={wanted[0]}, local pickup=True "
        f"(box reads {(box.inner_text() or '').strip()!r})."
    )


def configure_own_label_shipping(page, shipping_cost: float) -> None:
    """Shipping label row -> "Change shipping method" dialog -> "Use your own label" -> rate -> Update."""
    trigger = page.get_by_text("Select shipping label", exact=True)
    if trigger.count() == 0:
        # Already configured (e.g. editing a listing): open the existing label row instead.
        trigger = page.get_by_text("Your own label", exact=False)
    trigger.first.click(timeout=5000)
    dialog = page.get_by_role("dialog", name="Change shipping method")
    dialog.wait_for(timeout=8000)

    option_box = dialog.locator("[role='combobox']").filter(has_text="Shipping option").first
    if SHIPPING_OWN_LABEL_OPTION.lower() not in (option_box.inner_text() or "").lower():
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
    fill_text(rate.first, f"{float(shipping_cost):g}")
    page.wait_for_timeout(500)
    dialog.get_by_role("button", name="Update", exact=True).click(timeout=5000)
    page.wait_for_timeout(1500)
    if page.get_by_text("Your own label", exact=False).count() == 0:
        raise FbmStepError("Shipping label didn't show 'Your own label' after Update.")


def apply_delivery(page, allow_shipping: bool, price: float, shipping_cost: float, log) -> None:
    use_shipping = wants_shipping(allow_shipping, price)
    if allow_shipping and not use_shipping:
        log.info("FB doesn't allow shipping over $%s — listing as local pickup only.", FB_MAX_SHIPPING_PRICE)
    set_delivery_method(page, use_shipping)
    if use_shipping:
        configure_own_label_shipping(page, shipping_cost)
    else:
        for label in MEETUP_PREFERENCE_LABELS:
            if not check_meetup_preference(page, label):
                log.warning("Couldn't tick meetup preference '%s' (layout may have changed).", label)


def turn_off_offers(page) -> None:
    """Allow offers is always OFF. The toggle is a real role=switch; aria-checked is the truth
    (don't infer from "Minimum price" text — a hidden validation message keeps those words)."""
    page.wait_for_timeout(1000)
    toggle = page.get_by_role("switch").first
    toggle.wait_for(timeout=8000)
    if toggle.get_attribute("aria-checked") != "true":
        return
    toggle.click()
    for _ in range(8):
        page.wait_for_timeout(1000)
        if toggle.get_attribute("aria-checked") != "true":
            return
    raise FbmStepError("Couldn't turn Allow offers off.")


def heading_visible(page, text: str) -> bool:
    try:
        return page.get_by_text(text, exact=True).filter(visible=True).count() > 0
    except Exception:
        return False


def _group_pattern(name: str) -> re.Pattern:
    # Case-insensitive, any whitespace (long names wrap onto two lines).
    return re.compile(r"\s+".join(re.escape(word) for word in name.split()), re.I)


def select_groups(page, groups: list[str], log) -> tuple[list[str], list[str]]:
    """On "List in more places": tick each group by NAME (Facebook reorders the list), scrolling
    the panel to find it. Returns (selected, missing). Marketplace itself is pre-checked."""
    selected: list[str] = []
    missing: list[str] = []
    for name in groups:
        pattern = _group_pattern(name)
        row = None
        for _ in range(12):
            checkbox = page.get_by_role("checkbox", name=pattern)
            if checkbox.count() > 0:
                row = checkbox.first
                break
            candidate = page.get_by_role("checkbox").filter(has_text=pattern)
            if candidate.count() > 0:
                row = candidate.first
                break
            text = page.get_by_text(pattern)
            if text.count() > 0:
                row = text.first
                break
            # Not rendered yet: scroll the left panel (where the group list lives) and retry.
            page.mouse.move(300, 700)
            page.mouse.wheel(0, 500)
            page.wait_for_timeout(600)
        if row is None:
            log.warning("Group not found on 'List in more places': %s", name)
            missing.append(name)
            continue
        row.scroll_into_view_if_needed()
        if row.get_attribute("aria-checked") == "true":
            selected.append(name)
            continue
        row.click(timeout=5000)
        page.wait_for_timeout(800)
        state = row.get_attribute("aria-checked")
        if state == "false":
            raise FbmStepError(f"Clicked group '{name}' but it didn't get checked.")
        if state is None:
            log.info("Ticked group '%s' (couldn't read its checkbox state to confirm).", name)
        selected.append(name)
    return selected, missing
