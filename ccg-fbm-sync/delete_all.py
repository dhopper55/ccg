"""Delete All mode — a hard reset of CCG <-> FBM sync state. See ARCHITECTURE.md.

Ignores CCG's data entirely on the FB side: deletes every currently active FB Marketplace
listing (yours, personal items included) ONE AT A TIME — loads the selling page ONCE (whatever
batch it shows, ~25), deletes them one by one via the 3-dot menu, and when it runs out of
visible listings, reloads the whole page and keeps going. No "Load N more" clicking/scrolling
at any point — that was slow and is not what this does. Exactly how David does it by hand. Then,
once the page is confirmed swept clean, clears fb_listing_id on every CCG inventory item
(for-sale or not) and resets fb_sync_state back to null everywhere it was "excluded" — so
nothing from before this reset is silently skipped by Add All (add_all.py) or the regular
ongoing sync tool (approve.py) afterward.

No preview scrape, and no title/id matching between scrapes: an earlier version first tried
correlating a Grid-view scrape against List-view rows by title text (silently failed whenever
the two views rendered a title differently), then tried scraping a preview list up front (which
itself required the same slow "Load N more" pagination this is explicitly avoiding). This
version does neither — it just starts deleting whatever's in front of it.

Irreversible on Facebook's side — deleted listings cannot be recovered. Requires typing
"DELETE ALL" before it starts. Run with:

    ./venv/bin/python delete_all.py

Test mode — stop after N deletions instead of sweeping the whole page clean (CCG is NOT
cleaned up in this mode, since the sweep isn't complete):

    ./venv/bin/python delete_all.py --limit 3
"""
from __future__ import annotations

import argparse

from playwright.sync_api import sync_playwright
from rich.console import Console

from ccg_client import CCGClient
from fbm_client import delete_everything_on_selling_page, open_draft_browser

console = Console()
CONFIRM_PHRASE = "DELETE ALL"


def run_delete_all(limit: int | None = None) -> None:
    client = CCGClient()

    console.print(
        "[bold red]This will PERMANENTLY DELETE every active listing on your Facebook "
        "Marketplace selling page, one at a time, including personal items. This cannot be "
        "undone.[/bold red]"
    )
    if limit:
        console.print(f"[bold]Test mode: stopping after {limit} deletion(s) — CCG will not be touched.[/bold]")

    typed = input(f"\nType '{CONFIRM_PHRASE}' to proceed, anything else to abort: ").strip()
    if typed != CONFIRM_PHRASE:
        console.print("Aborted — nothing was deleted or changed.")
        return

    console.print("\n[bold]Deleting...[/bold]")
    playwright = sync_playwright().start()
    browser, context = open_draft_browser(playwright)
    try:
        deleted, swept_clean = delete_everything_on_selling_page(context, limit=limit)
    finally:
        browser.close()
        playwright.stop()

    console.print(f"\n  {deleted} listing(s) deleted.")
    if limit:
        console.print("[bold]Test mode complete — rerun without --limit for the full sweep + CCG cleanup.[/bold]")
        return
    if not swept_clean:
        console.print(
            "[bold yellow]Stopped without confirming the selling page is empty — CCG was NOT touched. "
            "Rerun to continue.[/bold yellow]"
        )
        return

    console.print("\n[bold]Clearing CCG's Facebook links and exclusions...[/bold]")
    ccg_items = client.get_all_inventory()
    console.print(f"  {len(ccg_items)} CCG item(s) to check.\n")

    cleared_links = 0
    cleared_exclusions = 0
    for item in ccg_items:
        if item.get("fbListingId"):
            client.clear_fb_listing_id(item["id"])
            cleared_links += 1
        if item.get("fbSyncState") == "excluded":
            client.clear_fb_sync_state(item["id"])
            cleared_exclusions += 1

    console.print(f"  {cleared_links} fb_listing_id link(s) cleared.")
    console.print(f"  {cleared_exclusions} 'skip permanently' exclusion(s) reset.")
    console.print("\n[bold]Delete All complete.[/bold] Run add_all.py when ready to re-list.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--limit",
        type=int,
        help="Test mode: stop after this many deletions instead of sweeping the whole page "
        "clean. CCG is not touched in this mode.",
    )
    args = parser.parse_args()
    run_delete_all(limit=args.limit)
