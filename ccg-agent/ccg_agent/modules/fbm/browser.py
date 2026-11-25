"""The Facebook browser: a persistent Chromium profile kept on THIS machine.

Facebook ties a login to the device, so the login never leaves the machine (decided
2026-11-24). The profile lives in ~/.ccg-agent/fb-profile (Windows: %USERPROFILE%\\.ccg-agent).
Log in once with `python -m ccg_agent fb-login`; the agent reuses it for every job.

Only one process can open the profile at a time, so stop the agent before running fb-login.
The browser is always headed (visible): Facebook is much more suspicious of headless browsers,
and on the home PC that's why Windows auto-logs in to a real desktop.
"""
from __future__ import annotations

import contextlib
from pathlib import Path
from typing import Iterator

PROFILE_DIR = Path.home() / ".ccg-agent" / "fb-profile"
CREATE_LISTING_URL = "https://www.facebook.com/marketplace/create/item"
VIEWPORT = {"width": 1400, "height": 1000}


class ProfileBusy(Exception):
    """Another process (usually `fb-login`, or a second agent) has the profile open."""


@contextlib.contextmanager
def fb_browser(interactive: bool = False) -> Iterator[object]:
    """Yields a Playwright BrowserContext on the persistent profile; closes it afterwards.

    `interactive` (fb-login): the page follows the real window size, so dialogs such as a
    captcha aren't cut off and the window can be resized. Jobs use a fixed viewport so the
    form's layout is predictable.
    """
    from playwright.sync_api import Error as PlaywrightError, sync_playwright

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    size_options = {"no_viewport": True} if interactive else {"viewport": VIEWPORT}
    with sync_playwright() as playwright:
        try:
            context = playwright.chromium.launch_persistent_context(
                str(PROFILE_DIR), headless=False, **size_options,
            )
        except PlaywrightError as exc:
            text = str(exc)
            if "ProcessSingleton" in text or "SingletonLock" in text or "user data directory is already in use" in text:
                raise ProfileBusy("The Facebook browser profile is open in another window (fb-login?).") from exc
            raise
        try:
            yield context
        finally:
            context.close()


def is_logged_in(page) -> bool:
    """Facebook can expire a session server-side while cookies look fine, so check what matters:
    whether the create-listing form actually loads (its photo input appears). Same check the
    old ccg-fbm-sync tool settled on after live testing (2026-10-28)."""
    page.goto(CREATE_LISTING_URL, wait_until="domcontentloaded")
    try:
        page.locator("input[type='file'][accept*='image']").first.wait_for(state="attached", timeout=15000)
        return True
    except Exception:
        return False


def check_login() -> tuple[bool, str | None]:
    with fb_browser() as context:
        page = context.new_page()
        try:
            ok = is_logged_in(page)
        finally:
            page.close()
    return (True, None) if ok else (False, "Facebook is logged out on this machine — run: python -m ccg_agent fb-login")


def interactive_login() -> int:
    """`python -m ccg_agent fb-login`: open the profile so a person can log in to Facebook."""
    print(f"Opening the CCG Agent's Facebook browser (profile: {PROFILE_DIR}).")
    print("Log in to Facebook in that window (including any 2FA).")
    print("Don't close the window yourself — it closes on its own once the login is confirmed.")
    try:
        with fb_browser(interactive=True) as context:
            page = context.pages[0] if context.pages else context.new_page()
            if is_logged_in(page):
                print("Already logged in. Nothing to do.")
                return 0
            page.goto("https://www.facebook.com/login", wait_until="domcontentloaded")
            if _wait_for_login(context, page):
                print("Logged in. The agent can publish to Facebook from this machine now.")
                return 0
    except ProfileBusy as exc:
        print(f"{exc} Stop the agent (Ctrl+C in its window) and try again.")
        return 1
    except Exception as exc:
        # Most often: the window was closed before the login was confirmed. The login may still
        # have been saved, so check rather than guess.
        if "closed" not in str(exc).lower():
            raise
        print("The browser window was closed. Checking whether the Facebook login was saved...")
        ok, _reason = check_login()
        if ok:
            print("Logged in. The agent can publish to Facebook from this machine now.")
            return 0
        print("Not logged in. Run fb-login again and leave the window open until it closes itself.")
        return 1
    print("Timed out waiting for a login. Run fb-login again when ready.")
    return 1


def _wait_for_login(context, page) -> bool:
    """Don't touch the page while the person is typing: watch for Facebook's session cookie,
    then confirm the create-listing form really loads. Up to ~20 minutes."""
    for _ in range(400):
        page.wait_for_timeout(3000)
        if any(c.get("name") == "c_user" for c in context.cookies("https://www.facebook.com")):
            page.wait_for_timeout(5000)  # let any post-login redirects finish
            if is_logged_in(page):
                return True
            print("Facebook still isn't showing the create-listing form (a security check?).")
            print("Finish whatever Facebook is asking in the window; still waiting...")
            page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
            page.wait_for_timeout(45000)  # give them time before checking again
    return False
