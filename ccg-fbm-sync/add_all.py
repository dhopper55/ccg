"""Re-list on Facebook Marketplace, one CCG item at a time, at your own pace. See ARCHITECTURE.md.

Walks every for-sale CCG item that has no fb_listing_id and that you haven't already said NO to
(regardless of Reverb / Gear Exchange status). For each one:

  1. Shows the item (title, price, shipping, Reverb/GX status, admin link).
  2. List on FBM?  YES / NO / Quit.
     - NO  -> remembered in CCG (fb_sync_state = "excluded"); never asked again.
              Undo with --undo-no <CCG number>.
     - YES -> 3..6 below.
  3. AI reframe of the title + description (same as the item page's Reframe button). You see
     old vs new and pick Accept / Regenerate / Keep original.
  4. Price, tax and shipping are taken from the CCG item as-is (not asked). FB gets shipping
     only if the item allows it AND is under $500.
  5. Saves to CCG with a normal save — which updates the EXISTING Reverb / GX listings in place
     (title, description, price, shipping); nothing is ended or relisted there. If Reverb or GX
     rejects it, the save is aborted and you choose: retry with the original text, or skip.
  6. Post to which groups? 1 Music (3) / 2 General (5) / 3 All (8) / 4 None — saved in CCG as
     fb_groups after a successful publish.
  7. PUBLISHES on FB (offers off; the chosen groups ticked, every other known group unticked)
     with the CURRENT title and description, and links its id in CCG — so a YES is never asked
     again either. Group lists: MUSIC_GROUPS / GENERAL_GROUPS in fbm_client.py.
     FB description = the item's sale description + Serial/Year/Finish lines, NO canned footer.

Ctrl-C any time; the next run picks up where you left off.

    ./venv/bin/python add_all.py
    ./venv/bin/python add_all.py --ccg-id 123456      # just this one item
    ./venv/bin/python add_all.py --undo-no 123456     # forget a NO so it's asked again
"""
from __future__ import annotations

import argparse

from playwright.sync_api import sync_playwright
from rich.console import Console

from ccg_client import CCGClient
from fbm_client import GENERAL_GROUPS, MUSIC_GROUPS, create_draft_listing, fb_description, open_draft_browser
from reconcile import item_title

console = Console()


def _choose(prompt: str, options: list[str]) -> str:
    console.print(f"\n[bold]{prompt}[/bold]")
    for n, option in enumerate(options, 1):
        console.print(f"  {n}. {option}")
    while True:
        choice = input("> ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return options[int(choice) - 1]
        console.print(f"Enter 1-{len(options)}.")


def _ccg_number(item: dict) -> str:
    return str(item.get("ccgNumber") or item["id"]).upper().removeprefix("CCG-")


def _find(items: list[dict], wanted: str) -> list[dict]:
    wanted = wanted.strip().upper().removeprefix("CCG-")
    return [i for i in items if str(i["id"]) == wanted or _ccg_number(i) == wanted]


def _reframe_step(client: CCGClient, title: str, description: str) -> tuple[str, str]:
    """Returns the (title, description) to use: the reframed pair or the original."""
    while True:
        console.print("  Reframing...")
        new = None
        for attempt in range(3):  # the AI call 502s now and then; a retry almost always works
            try:
                new = client.reframe(title, description)
                break
            except Exception as error:
                last_error = error
        if new is None:
            console.print(f"  [red]Reframe failed 3 times: {last_error}[/red]")
            if _choose("Reframe didn't work.", ["Try again", "Keep original"]) == "Try again":
                continue
            return title, description

        console.print("\n[bold]OLD title:[/bold] " + title)
        console.print("[bold green]NEW title:[/bold green] " + new["title"])
        console.print("\n[bold]OLD description:[/bold]\n" + description)
        console.print("\n[bold green]NEW description:[/bold green]\n" + new["description"])
        choice = _choose(
            "Use the new title + description? (this also goes to Reverb / GX if listed there)",
            ["Accept", "Regenerate", "Keep original"],
        )
        if choice == "Accept":
            return new["title"], new["description"]
        if choice == "Keep original":
            return title, description


def _save(client: CCGClient, item_id, record: dict) -> bool:
    try:
        client.update_item(item_id, record)
        return True
    except Exception as error:
        console.print(f"  [red]Save failed (CCG unchanged): {error}[/red]")
        return False


# Stored in CCG as fb_groups (ccg_inventory_items_addtl): 1 music, 2 general, 3 all, 4 none.
FB_GROUP_CHOICES = {
    1: ("Music groups", MUSIC_GROUPS),
    2: ("General groups", GENERAL_GROUPS),
    3: ("All groups (music + general)", MUSIC_GROUPS + GENERAL_GROUPS),
    4: ("No groups (Marketplace only)", []),
}


def _ask_groups() -> int:
    labels = [f"{label} ({len(groups)})" if groups else label for label, groups in FB_GROUP_CHOICES.values()]
    choice = _choose("Post to which groups?", labels)
    return labels.index(choice) + 1


def _publish_on_fb(client: CCGClient, item_id, record: dict, footer: str | None, fb_groups: int) -> bool:
    groups = list(FB_GROUP_CHOICES[fb_groups][1])
    title = item_title(record)

    # Browser opened only around the draft: Playwright's sync API keeps an asyncio loop running
    # while open, which breaks questionary's prompts.
    playwright = sync_playwright().start()
    browser, context = open_draft_browser(playwright)
    try:
        new_listing_id = create_draft_listing(
            context,
            title=title,
            price=float(record.get("salePrice") or 0),
            condition=record.get("condition") or "",
            description=record.get("saleDescription") or "",
            image_urls=client.get_public_image_urls(item_id),
            allow_shipping=bool(record.get("allowShipping")),
            shipping_cost=float(record.get("fixedShippingAmount") or 0),
            footer=footer,
            full_description=fb_description(record),
            publish_groups=groups,
        )
    finally:
        browser.close()
        playwright.stop()

    if not new_listing_id:
        console.print(
            "  [red]Not published — see the warning above. It'll come up again next run "
            "(check your FB selling page first if it said it may have published).[/red]"
        )
        return False
    if new_listing_id == "PUBLISHED_NO_ID":
        console.print(
            "  [yellow]Published on FB, but the new listing's ID wasn't captured. Open the listing on "
            "FB and copy the number from its URL (facebook.com/marketplace/item/<ID>).[/yellow]"
        )
        new_listing_id = input("  Paste the FB listing ID (or Enter to skip): ").strip()
        if not new_listing_id:
            console.print(
                "  [red]Not linked in CCG — set FB Listing ID on the item by hand, or the next run "
                "will offer it again (duplicate listing).[/red]"
            )
            return False
    try:
        client.set_fb_listing_id(item_id, new_listing_id)
    except Exception as error:
        console.print(
            f"  [red]Published on FB (id {new_listing_id}) but linking it in CCG failed: {error}[/red]\n"
            f"  Set FB Listing ID = {new_listing_id} on the item by hand, or the next run will "
            "offer it again (duplicate listing)."
        )
        return False
    console.print(f"  [green]Published on FB (id {new_listing_id}) and linked.[/green]")
    try:
        client.set_fb_groups(item_id, fb_groups)
    except Exception as error:
        console.print(f"  [yellow]Couldn't save the group choice ({fb_groups}) in CCG: {error}[/yellow]")
    return True


def run(only_id: str | None = None) -> None:
    client = CCGClient()
    footer = client.get_sale_description_postfix()

    console.print("[bold]Fetching CCG inventory...[/bold]")
    all_items = client.get_all_inventory()
    candidates = [
        i for i in all_items
        if i.get("forSale") and not i.get("isSold") and not i.get("fbListingId")
        and i.get("fbSyncState") != "excluded"
    ]
    said_no = sum(1 for i in all_items if i.get("forSale") and i.get("fbSyncState") == "excluded")
    console.print(f"  {len(candidates)} for-sale item(s) still to decide ({said_no} already answered NO).")

    if only_id:
        candidates = _find(candidates, only_id)
        if not candidates:
            console.print(f"No undecided for-sale item matches {only_id}.")
            return

    base = client.base_url
    listed = said_no_now = 0
    for n, item in enumerate(candidates, 1):
        item_id = item["id"]
        on_reverb = "yes" if item.get("reverbListingId") else "no"
        on_gx = "yes" if item.get("gxListingId") and item.get("gxStatus") != "sold" else "no"
        console.rule(f"[{n}/{len(candidates)}]  CCG-{_ccg_number(item)}")
        console.print(f"[bold]{item_title(item)}[/bold]")
        console.print(
            f"  Price ${float(item.get('salePrice') or 0):.2f}"
            f"  |  Ships: {'$%.2f' % float(item.get('fixedShippingAmount') or 0) if item.get('allowShipping') else 'no'}"
            f"  |  Reverb: {on_reverb}  |  GX: {on_gx}"
        )
        console.print(f"  {base}/admin/inventory-item?id={item_id}")

        choice = _choose("List on FBM?", ["YES", "NO (don't ask again)", "Quit"])
        if choice == "Quit":
            break
        if choice.startswith("NO"):
            try:
                client.exclude_from_fbm(item_id)
                said_no_now += 1
                console.print("  Remembered — won't ask again.")
            except Exception as error:
                console.print(f"  [red]Couldn't save the NO ({error}) — it'll come up again next run.[/red]")
            continue

        # Fresh full record (not the list row from the start of the run).
        record = dict(client.get_item(item_id))
        original_title = record.get("saleTitle") or ""
        original_description = record.get("saleDescription") or ""
        if original_title and original_description:
            new_title, new_description = _reframe_step(client, original_title, original_description)
        else:
            console.print("  [yellow]No sale title/description to reframe — keeping as is.[/yellow]")
            new_title, new_description = original_title, original_description

        # Price, tax and shipping come straight from the CCG item — not asked (David 2026-11-26).
        # FB shipping follows the item's Allow Shipping, except never at $500+ (fbm_client).
        if (new_title, new_description) != (original_title, original_description):
            record["saleTitle"], record["saleDescription"] = new_title, new_description
            console.print("  Saving new title/description to CCG (updates Reverb / GX if listed)...")
            saved = _save(client, item_id, record)
            if not saved:
                retry = _choose("Save was rejected.", ["List on FB with the ORIGINAL title/description", "Skip this item for now"])
                if not retry.startswith("List"):
                    console.print("  Skipped — it'll come up again next run.")
                    continue
            else:
                console.print("  CCG saved.")
        # else: nothing changed — no save, Reverb/GX untouched.

        fb_groups = _ask_groups()
        if _publish_on_fb(client, item_id, client.get_item(item_id), footer, fb_groups):
            listed += 1

    console.print("\n[bold]This session[/bold]")
    console.print(f"  Published on FB: {listed}")
    console.print(f"  Answered NO:   {said_no_now}")


def undo_no(ccg_id: str) -> None:
    client = CCGClient()
    matches = _find(client.get_all_inventory(), ccg_id)
    if not matches:
        console.print(f"No CCG item matches {ccg_id}.")
        return
    client.clear_fb_sync_state(matches[0]["id"])
    console.print(f"CCG-{_ccg_number(matches[0])} will be offered again on the next run.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ccg-id", help="Only this item (internal id or CCG-XXXXXX number).")
    parser.add_argument("--undo-no", help="Forget a NO for this item so it's offered again.")
    args = parser.parse_args()
    if args.undo_no:
        undo_no(args.undo_no)
    else:
        run(only_id=args.ccg_id)
