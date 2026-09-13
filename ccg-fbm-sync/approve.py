"""Interactive CCG <-> FBM sync — the ongoing tool. See ARCHITECTURE.md Section 5.

Stateless: every run pulls fresh data from CCG and FBM, reconciles entirely in memory, and
writes nothing back without an explicit choice per item. Run with:

    ./venv/bin/python approve.py

Two persistent "stop asking" mechanisms exist (added 2026-09-13):
- A CCG item can be permanently excluded from the `to_post` prompt (`fb_sync_state`).
  Not exposed in the admin UI by design — this tool is the only way to set/unset it.
- An FB listing can be permanently ignored (`fb_ignore_list`) for personal, non-inventory
  items (e.g. a lawnmower listed on FB only).
"""
from __future__ import annotations

from rich.console import Console

from ccg_client import CCGClient
from fbm_client import get_active_listings
from reconcile import item_title, reconcile

console = Console()


def _ask(prompt: str, options: list[str]) -> str:
    console.print(f"\n[bold]{prompt}[/bold]")
    for i, option in enumerate(options, 1):
        console.print(f"  {i}. {option}")
    while True:
        choice = input("> ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return options[int(choice) - 1]
        console.print(f"Enter a number from 1 to {len(options)}.")


def _print_fb_draft(item: dict) -> None:
    """No FB publish API exists, so this just prints a copy/paste-able draft — see
    ARCHITECTURE.md Section 9."""
    console.print("\n[bold cyan]----- FB listing draft (copy/paste into Facebook) -----[/bold cyan]")
    console.print(f"Title: {item_title(item)}")
    console.print(f"Price: ${item.get('salePrice') or 0}")
    console.print(f"Description:\n{item.get('saleDescription') or '(none)'}")
    images = item.get("imageUrls") or []
    if images:
        console.print("Images:")
        for url in images:
            console.print(f"  {url}")
    console.print("[bold cyan]--------------------------------------------------------[/bold cyan]")


def run_sync() -> None:
    client = CCGClient()

    console.print("[bold]Fetching CCG inventory...[/bold]")
    ccg_items = client.get_all_inventory()
    console.print(f"  {len(ccg_items)} item(s) found.\n")

    console.print("[bold]Fetching the FB ignore-list...[/bold]")
    ignored_fb_ids = client.get_ignored_fb_listing_ids()
    console.print(f"  {len(ignored_fb_ids)} listing(s) permanently ignored.\n")

    console.print("[bold]Fetching FB Marketplace listings via browser automation...[/bold]")
    fbm_listings = get_active_listings()
    console.print(f"  {len(fbm_listings)} listing(s) found.\n")

    buckets = reconcile(ccg_items, fbm_listings, ignored_fb_ids=ignored_fb_ids)

    for item in buckets["to_post"]:
        choice = _ask(
            f"'{item_title(item)}' is for sale in CCG but not linked to an FB listing.",
            ["Show FB draft to post manually", "Skip for now", "Skip permanently (never ask about this item again)"],
        )
        if choice == "Show FB draft to post manually":
            _print_fb_draft(item)
        elif choice == "Skip permanently (never ask about this item again)":
            client.exclude_from_fbm(item["id"])
            console.print("  excluded — won't ask about this item again.")

    for ccg_item, listing in buckets["possible_link"]:
        choice = _ask(
            f"FB listing '{listing.title}' (id {listing.id}) looks like it could be "
            f"CCG's '{item_title(ccg_item)}'. Link them?",
            ["Link to this CCG item", "Skip"],
        )
        if choice == "Link to this CCG item":
            client.set_fb_listing_id(ccg_item["id"], listing.id)
            console.print("  linked.")

    for listing in buckets["unknown_fbm"]:
        choice = _ask(
            f"FB listing '{listing.title}' (id {listing.id}) doesn't match any CCG item.",
            ["Personal item — ignore this listing going forward", "Skip for now"],
        )
        if choice == "Personal item — ignore this listing going forward":
            client.add_ignored_fb_listing(listing.id, note="personal")
            console.print("  added to the ignore list — won't ask about this listing again.")

    for item in buckets["stale_fb_id"]:
        choice = _ask(
            f"CCG's '{item_title(item)}' is linked to FB listing {item.get('fbListingId')}, "
            "but that listing isn't live on Facebook anymore.",
            ["Sold on FB — mark sold in CCG", "Listing removed/expired — clear the FB link", "Leave as-is"],
        )
        if choice == "Sold on FB — mark sold in CCG":
            client.mark_sold_fbm(item["id"])
            console.print("  marked sold.")
        elif choice == "Listing removed/expired — clear the FB link":
            client.clear_fb_listing_id(item["id"])
            console.print("  cleared.")

    console.print("\n[bold]Summary[/bold]")
    console.print(f"  In sync (no action needed): {len(buckets['in_sync'])}")


if __name__ == "__main__":
    run_sync()
