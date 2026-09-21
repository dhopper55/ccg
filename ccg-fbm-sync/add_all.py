"""Add All mode — bulk re-list every for-sale CCG item on Facebook Marketplace. See
ARCHITECTURE.md. Meant to run after delete_all.py, but defensively skips any item that
already has an fb_listing_id (safe to re-run if a previous pass was interrupted).

For each for-sale, unlinked CCG item: prints its current price/shipping/tax facts, asks
whether to list it at all, then walks you through each editable field (Sale Price, Regular
Price, Sales Tax Included, Allow Shipping, Shipping Price) with the current value pre-filled
so Enter keeps it. CCG is updated with whatever you land on regardless of whether you go on
to draft it on Facebook. Only drafts on FB (never publishes) — same safety model as
approve.py's to_post flow. Run with:

    ./venv/bin/python add_all.py

Test mode — scope the run down to one CCG item (matches its internal id or its CCG-XXXXXX
number), to verify the field-editing flow and create_draft_listing()'s shipping fields
against a single real item before trusting either at scale:

    ./venv/bin/python add_all.py --ccg-id 123456
"""
from __future__ import annotations

import argparse

import questionary
from playwright.sync_api import sync_playwright
from rich.console import Console

from ccg_client import CCGClient
from fbm_client import create_draft_listing, open_draft_browser
from reconcile import item_title

console = Console()


def _ask_yes_no(prompt: str) -> bool:
    console.print(f"\n[bold]{prompt}[/bold]")
    console.print("  1. Yes")
    console.print("  2. No")
    while True:
        choice = input("> ").strip()
        if choice in ("1", "2"):
            return choice == "1"
        console.print("Enter 1 or 2.")


def _ask_money(label: str, current: float) -> float:
    answer = questionary.text(f"New {label}:", default=f"{current:.2f}").ask()
    if answer is None:
        return current
    try:
        return float(answer.strip() or 0)
    except ValueError:
        console.print(f"  Couldn't parse '{answer}' as a number — keeping {current:.2f}.")
        return current


def _absolute_image_urls(item: dict, base_url: str) -> list[str]:
    urls = item.get("imageUrls") or []
    return [u if u.startswith("http") else f"{base_url}{u}" for u in urls]


def run_add_all(only_id: str | None = None) -> None:
    client = CCGClient()

    console.print("[bold]Fetching CCG inventory...[/bold]")
    ccg_items = client.get_all_inventory()
    candidates = [i for i in ccg_items if i.get("forSale") and not i.get("fbListingId")]
    console.print(f"  {len(candidates)} for-sale item(s) not yet linked to FB out of {len(ccg_items)} total.\n")

    if only_id:
        candidates = [
            i for i in candidates
            if str(i["id"]) == only_id or str(i.get("ccgNumber") or "") == only_id
        ]
        if not candidates:
            console.print(f"No for-sale, unlinked CCG item found matching id {only_id} — nothing to do.")
            return
        console.print(f"[bold]Test mode: scoped to CCG item {only_id} only.[/bold]\n")

    playwright = sync_playwright().start()
    browser, context = open_draft_browser(playwright)

    listed = skipped = drafts_failed = 0
    try:
        for item in candidates:
            ccg_number = item.get("ccgNumber") or item["id"]
            title = item_title(item)
            sale_price = float(item.get("salePrice") or 0)
            regular_price = float(item.get("regularPrice") or 0)
            sales_tax_included = bool(item.get("salesTaxIncluded"))
            allow_shipping = bool(item.get("allowShipping"))
            shipping_cost = float(item.get("fixedShippingAmount") or 0)
            unit_cost = item.get("unitPurchasePrice")

            console.print(f"\n[bold]Item 'CCG-{ccg_number}' ({title}) is for sale on CCG and not FBM.[/bold]")
            console.print(f"  Unit cost: ${unit_cost if unit_cost is not None else 0:.2f}")
            console.print(f"  Sale price: ${sale_price:.2f}")
            console.print(f"  Regular price: ${regular_price:.2f}")
            console.print(f"  Sales tax included: {sales_tax_included}")
            console.print(f"  Allow shipping: {allow_shipping}")
            console.print(f"  Shipping price: ${shipping_cost:.2f}")

            if not _ask_yes_no("Do you want to list on FBM?"):
                skipped += 1
                continue

            sale_price = _ask_money("Sale Price", sale_price)
            regular_price = _ask_money("Regular Price", regular_price)
            sales_tax_included = questionary.confirm("Sales tax included?", default=sales_tax_included).ask()
            allow_shipping = questionary.confirm("Allow shipping?", default=allow_shipping).ask()
            if allow_shipping:
                shipping_cost = _ask_money("Shipping Price", shipping_cost)

            updated_record = dict(item)
            updated_record["salePrice"] = sale_price
            updated_record["regularPrice"] = regular_price
            updated_record["salesTaxIncluded"] = sales_tax_included
            updated_record["allowShipping"] = allow_shipping
            updated_record["fixedShippingAmount"] = shipping_cost
            client.update_item(item["id"], updated_record)
            console.print("  CCG updated.")

            if not _ask_yes_no("List on FBM now?"):
                continue

            new_listing_id = create_draft_listing(
                context,
                title=title,
                price=sale_price,
                condition=item.get("condition") or "",
                description=item.get("saleDescription") or "",
                image_urls=_absolute_image_urls(item, client.base_url),
                allow_shipping=allow_shipping,
                shipping_cost=shipping_cost,
            )
            if new_listing_id:
                client.set_fb_listing_id(item["id"], new_listing_id)
                listed += 1
                console.print(f"  drafted on FB (id {new_listing_id}) and linked.")
            else:
                drafts_failed += 1
                console.print("  draft not saved — see the warning above. CCG values were still saved.")
    finally:
        browser.close()
        playwright.stop()

    console.print("\n[bold]Summary[/bold]")
    console.print(f"  Listed (drafted + linked): {listed}")
    console.print(f"  Skipped (no / CCG-only): {skipped}")
    console.print(f"  Draft failed (CCG values saved, FB side needs a retry): {drafts_failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--ccg-id",
        help="Test mode: only process this one CCG item (matches its internal id or its "
        "CCG-XXXXXX number), instead of every for-sale, unlinked item.",
    )
    args = parser.parse_args()
    run_add_all(only_id=args.ccg_id)
