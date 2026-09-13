"""ONE-TIME USE bootstrap tool — see ARCHITECTURE.md Section 7.

Backfills fb_listing_id on CCG items that are already live on Facebook Marketplace,
by exact title match against sales_channel_fbm=1 items with no fb_listing_id yet.
Only links a title when it's unique on both sides; anything else is left for manual
review rather than guessed.

Delete this file (and any tests referencing it) once the backfill has been run and
verified — it is not part of the ongoing architecture.

Usage:
    python match_mode.py            # dry run — prints the report, writes nothing
    python match_mode.py --apply    # after reviewing the report, actually link the matches
"""
from __future__ import annotations

import sys
from collections import defaultdict

from rich.console import Console
from rich.table import Table

from ccg_client import CCGClient
from fbm_client import FbListing, get_active_listings

console = Console()


def _ccg_title(item: dict) -> str:
    return (item.get("saleTitle") or item.get("title") or "").strip()


def group_by_title(items: list, title_of) -> dict[str, list]:
    groups: dict[str, list] = defaultdict(list)
    for item in items:
        title = title_of(item)
        if title:
            groups[title].append(item)
    return groups


def compute_matches(
    ccg_candidates: list[dict], fbm_listings: list[FbListing]
) -> tuple[list[tuple[dict, FbListing]], list[tuple[str, list, list]], list[dict]]:
    """Pure matching logic — exact title match, 1:1 only. No I/O, so it's cheap to unit test
    before running against production data. See ARCHITECTURE.md Section 7 for the rules."""
    ccg_by_title = group_by_title(ccg_candidates, _ccg_title)
    fbm_by_title = group_by_title(fbm_listings, lambda l: l.title.strip())

    matched: list[tuple[dict, FbListing]] = []
    ambiguous: list[tuple[str, list, list]] = []
    unmatched: list[dict] = []

    for title, ccg_group in ccg_by_title.items():
        fbm_group = fbm_by_title.get(title, [])
        if len(ccg_group) == 1 and len(fbm_group) == 1:
            matched.append((ccg_group[0], fbm_group[0]))
        elif not fbm_group:
            unmatched.extend(ccg_group)
        else:
            ambiguous.append((title, ccg_group, fbm_group))

    return matched, ambiguous, unmatched


def run_match_mode(dry_run: bool = True) -> None:
    client = CCGClient()

    console.print("[bold]Fetching CCG candidates[/bold] (for_sale, sales_channel_fbm, no fb_listing_id yet)...")
    ccg_candidates = client.get_items_for_match_mode()
    console.print(f"  {len(ccg_candidates)} candidate(s) found.\n")

    fbm_listings = get_active_listings()
    console.print(f"{len(fbm_listings)} FB listing(s) pasted.\n")

    matched, ambiguous, unmatched = compute_matches(ccg_candidates, fbm_listings)

    _print_report(matched, ambiguous, unmatched)

    if not matched:
        return

    if dry_run:
        console.print("\n[yellow]Dry run — no changes written. Re-run with --apply to save these matches.[/yellow]")
        return

    console.print(f"\nAbout to link {len(matched)} item(s) in CCG.")
    confirm = input("Apply now? [y/N] ").strip().lower()
    if confirm != "y":
        console.print("Aborted — nothing written.")
        return

    for ccg_item, fbm_listing in matched:
        client.set_fb_listing_id(ccg_item["id"], fbm_listing.id)
        console.print(f"  linked {ccg_item.get('ccgNumber', ccg_item['id'])} -> {fbm_listing.id}")

    console.print("[green]Done.[/green] Spot-check a sample against the live FB listings before trusting the rest.")


def _print_report(matched, ambiguous, unmatched) -> None:
    table = Table(title="Matched (will link)")
    table.add_column("CCG #")
    table.add_column("Title")
    table.add_column("FB Listing ID")
    for ccg_item, fbm_listing in matched:
        table.add_row(str(ccg_item.get("ccgNumber", "")), _ccg_title(ccg_item), fbm_listing.id)
    console.print(table)

    if ambiguous:
        table = Table(title="Ambiguous (needs manual review — not guessed)")
        table.add_column("Title")
        table.add_column("CCG candidates")
        table.add_column("FB listings")
        for title, ccg_group, fbm_group in ambiguous:
            table.add_row(
                title,
                ", ".join(str(i.get("ccgNumber", i["id"])) for i in ccg_group),
                ", ".join(l.id for l in fbm_group),
            )
        console.print(table)

    if unmatched:
        table = Table(title="Unmatched (no FB listing found with this title)")
        table.add_column("CCG #")
        table.add_column("Title")
        for item in unmatched:
            table.add_row(str(item.get("ccgNumber", "")), _ccg_title(item))
        console.print(table)


if __name__ == "__main__":
    run_match_mode(dry_run="--apply" not in sys.argv)
