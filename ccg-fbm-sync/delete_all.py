"""Delete All mode — a hard reset of CCG <-> FBM sync state. See ARCHITECTURE.md.

Ignores CCG's data entirely on the FB side: walks every currently active FB Marketplace
listing (yours, personal items included) and permanently deletes it. Then, on the CCG side,
clears fb_listing_id on every inventory item that has one (for-sale or not) and resets
fb_sync_state back to null everywhere it was set to "excluded" — so nothing from before this
reset is silently skipped by Add All (add_all.py) or the regular ongoing sync tool
(approve.py) afterward.

Irreversible on Facebook's side — deleted listings cannot be recovered. Requires typing
"DELETE ALL" after reviewing a full preview of what's about to be deleted. Run with:

    ./venv/bin/python delete_all.py

Test mode — scope the whole run down to one FB listing (and only the CCG item linked to it),
to verify delete_listing() and the CCG-clearing logic against a single real item before
trusting either at scale:

    ./venv/bin/python delete_all.py --listing-id 1234567890123456
"""
from __future__ import annotations

import argparse

from playwright.sync_api import sync_playwright
from rich.console import Console

from ccg_client import CCGClient
from fbm_client import delete_listing, get_active_listings, open_draft_browser

console = Console()
CONFIRM_PHRASE = "DELETE ALL"


def run_delete_all(only_listing_id: str | None = None) -> None:
    client = CCGClient()

    console.print("[bold]Fetching FB Marketplace listings via browser automation...[/bold]")
    fbm_listings = get_active_listings()
    console.print(f"  {len(fbm_listings)} listing(s) found.\n")

    if only_listing_id:
        fbm_listings = [l for l in fbm_listings if l.id == only_listing_id]
        if not fbm_listings:
            console.print(f"No active FB listing found with id {only_listing_id} — nothing to do.")
            return
        console.print(f"[bold]Test mode: scoped to listing {only_listing_id} only.[/bold]\n")

    if not fbm_listings:
        console.print("Nothing to delete on Facebook.")
    else:
        console.print("[bold red]The following FB listings will be PERMANENTLY DELETED:[/bold red]")
        for listing in fbm_listings:
            console.print(f"  [{listing.id}] {listing.title}")
        console.print(f"\n[bold red]{len(fbm_listings)} listing(s) total. This cannot be undone.[/bold red]")

        typed = input(f"\nType '{CONFIRM_PHRASE}' to proceed, anything else to abort: ").strip()
        if typed != CONFIRM_PHRASE:
            console.print("Aborted — nothing was deleted or changed.")
            return

        console.print("\n[bold]Deleting FB listings...[/bold]")
        playwright = sync_playwright().start()
        browser, context = open_draft_browser(playwright)
        deleted, failed = [], []
        try:
            for listing in fbm_listings:
                ok = delete_listing(context, listing.id)
                if ok:
                    deleted.append(listing)
                    console.print(f"  deleted [{listing.id}] {listing.title}")
                else:
                    failed.append(listing)
        finally:
            browser.close()
            playwright.stop()

        console.print(f"\n  {len(deleted)} deleted, {len(failed)} failed.")
        if failed:
            console.print("[bold yellow]Failed to delete (still live on FB — delete manually):[/bold yellow]")
            for listing in failed:
                console.print(f"  [{listing.id}] {listing.title}")

    console.print("\n[bold]Clearing CCG's Facebook links and exclusions...[/bold]")
    ccg_items = client.get_all_inventory()
    if only_listing_id:
        # Scoped to just the CCG item(s) linked to the one listing under test — leaves every
        # other item's fb_listing_id/fb_sync_state untouched, matching the FB-side scoping above.
        ccg_items = [i for i in ccg_items if str(i.get("fbListingId") or "") == only_listing_id]
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
        "--listing-id",
        help="Test mode: only delete this one FB listing id (and clear only the CCG item linked "
        "to it), instead of every active listing.",
    )
    args = parser.parse_args()
    run_delete_all(only_listing_id=args.listing_id)
