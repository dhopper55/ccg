"""Delete All mode — a hard reset of CCG <-> FBM sync state. See ARCHITECTURE.md.

Ignores CCG's data entirely on the FB side: walks every currently active FB Marketplace
listing (yours, personal items included) and permanently deletes it. Then, on the CCG side,
clears fb_listing_id on every inventory item whose listing is no longer live (for-sale or not)
and resets fb_sync_state back to null everywhere it was set to "excluded" — so nothing from
before this reset is silently skipped by Add All (add_all.py) or the regular ongoing sync tool
(approve.py) afterward.

Deletes by TITLE, all copies at once, then rescans and repeats (up to MAX_PASSES) until a full
scan finds nothing left. An item posted to Marketplace and to groups exists as several separate
listings with separate ids but the same title, and a deleted copy can reappear under a new id
(confirmed live 2026-09-20), so listing ids aren't a stable handle.

Irreversible on Facebook's side — deleted listings cannot be recovered. Requires typing
"DELETE ALL" after reviewing a full preview of what's about to be deleted. Run with:

    ./venv/bin/python delete_all.py

Test mode — scope the whole run to one listing's title (so its group copies too) and only the
CCG item(s) linked to any of those copies:

    ./venv/bin/python delete_all.py --listing-id 1234567890123456
"""
from __future__ import annotations

import argparse
from collections import defaultdict

from playwright.sync_api import sync_playwright
from rich.console import Console

from ccg_client import CCGClient
from fbm_client import delete_rows_with_title, get_active_listings, open_draft_browser

console = Console()
CONFIRM_PHRASE = "DELETE ALL"
MAX_PASSES = 5


def _group_by_title(listings) -> dict[str, list]:
    groups: dict[str, list] = defaultdict(list)
    for listing in listings:
        groups[listing.title].append(listing)
    return groups


def run_delete_all(only_listing_id: str | None = None) -> None:
    client = CCGClient()

    console.print("[bold]Fetching FB Marketplace listings via browser automation...[/bold]")
    fbm_listings = get_active_listings()
    console.print(f"  {len(fbm_listings)} listing(s) found.\n")

    scope_titles: set[str] | None = None
    if only_listing_id:
        target = next((l for l in fbm_listings if l.id == only_listing_id), None)
        if target is None:
            console.print(f"No active FB listing found with id {only_listing_id} — nothing to do.")
            return
        scope_titles = {target.title}
        fbm_listings = [l for l in fbm_listings if l.title in scope_titles]
        console.print(
            f"[bold]Test mode: scoped to the title '{target.title}' "
            f"(listing {only_listing_id} plus any same-titled copies, e.g. group posts).[/bold]\n"
        )

    seen_ids: set[str] = {l.id for l in fbm_listings}
    live_ids: set[str] = set(seen_ids)

    if not fbm_listings:
        console.print("Nothing to delete on Facebook.")
    else:
        groups = _group_by_title(fbm_listings)
        console.print("[bold red]The following FB listings will be PERMANENTLY DELETED:[/bold red]")
        for title, group in groups.items():
            suffix = f"  [yellow]x{len(group)} copies[/yellow]" if len(group) > 1 else ""
            console.print(f"  {title}{suffix}")
            for listing in group:
                console.print(f"      [{listing.id}]")
        console.print(
            f"\n[bold red]{len(fbm_listings)} listing(s) across {len(groups)} title(s). "
            "This cannot be undone.[/bold red]"
        )

        typed = input(f"\nType '{CONFIRM_PHRASE}' to proceed, anything else to abort: ").strip()
        if typed != CONFIRM_PHRASE:
            console.print("Aborted — nothing was deleted or changed.")
            return

        total_deleted = 0
        remaining = fbm_listings
        for pass_number in range(1, MAX_PASSES + 1):
            titles = list(_group_by_title(remaining))
            console.print(f"\n[bold]Pass {pass_number}: deleting {len(remaining)} listing(s) "
                          f"across {len(titles)} title(s)...[/bold]")
            playwright = sync_playwright().start()
            browser, context = open_draft_browser(playwright)
            try:
                for title in titles:
                    deleted, found = delete_rows_with_title(context, title)
                    total_deleted += deleted
                    status = "ok" if deleted == found else "[yellow]INCOMPLETE[/yellow]"
                    console.print(f"  {title}: deleted {deleted} of {found} row(s) — {status}")
            finally:
                browser.close()
                playwright.stop()

            console.print("  Rescanning Facebook to see what's left...")
            rescan = get_active_listings()
            if scope_titles is not None:
                rescan = [l for l in rescan if l.title in scope_titles]
            seen_ids.update(l.id for l in rescan)
            live_ids = {l.id for l in rescan}
            remaining = rescan
            if not remaining:
                break
            console.print(f"  {len(remaining)} listing(s) still live (new ids may have appeared).")

        console.print(f"\n  {total_deleted} row(s) deleted in total.")
        if remaining:
            console.print(f"[bold yellow]{len(remaining)} listing(s) still live after {MAX_PASSES} passes "
                          "— delete manually:[/bold yellow]")
            for listing in remaining:
                console.print(f"  [{listing.id}] {listing.title}")

    console.print("\n[bold]Clearing CCG's Facebook links and exclusions...[/bold]")
    ccg_items = client.get_all_inventory()
    if only_listing_id:
        ccg_items = [i for i in ccg_items if str(i.get("fbListingId") or "") in seen_ids]
    # A link to a listing that's still live on FB must stay — clearing it would recreate
    # exactly the CCG/FB mismatch this tool exists to remove.
    ccg_items = [i for i in ccg_items if str(i.get("fbListingId") or "") not in live_ids]
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
        help="Test mode: scope to this FB listing's title (its group copies too) and only the "
        "CCG item(s) linked to any of them, instead of every active listing.",
    )
    args = parser.parse_args()
    run_delete_all(only_listing_id=args.listing_id)
