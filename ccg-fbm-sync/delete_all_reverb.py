"""One-off script: end every Reverb listing linked to a CCG item, and clear the CCG link.

Unlike the FBM side of this tool, this needs no browser automation — Reverb has a real API,
and the existing admin "Delete From Reverb" endpoint (POST /api/inventory/:id/reverb-remove,
handleInventoryReverbRemove in crud2.ts) already does the real work server-side:
  1. Calls Reverb's own PUT /my/listings/:id/state/end to end the listing there.
  2. Only if that succeeds, clears reverb_listing_id (and sales_channel_reverb) on the CCG item.
It's fail-closed: if step 1 fails (a common case — already sold/ended on Reverb, rate limits,
etc.), CCG's link is deliberately left in place rather than force-cleared, so nothing drifts
out of sync silently. This script just calls that endpoint once per linked item and reports
which succeeded, which failed and why, so failures can be reviewed manually.

Requires typing "DELETE ALL REVERB" after reviewing a preview of every linked item. Run with:

    ./venv/bin/python delete_all_reverb.py

Test mode — scope to one CCG item (matches its internal id or its CCG-XXXXXX number):

    ./venv/bin/python delete_all_reverb.py --ccg-id 123456
"""
from __future__ import annotations

import argparse

from rich.console import Console

from ccg_client import CCGClient
from reconcile import item_title

console = Console()
CONFIRM_PHRASE = "DELETE ALL REVERB"


def run_delete_all_reverb(only_id: str | None = None) -> None:
    client = CCGClient()

    console.print("[bold]Fetching CCG inventory...[/bold]")
    ccg_items = client.get_all_inventory()
    linked = [i for i in ccg_items if i.get("reverbListingId")]
    console.print(f"  {len(linked)} item(s) linked to a Reverb listing out of {len(ccg_items)} total.\n")

    if only_id:
        wanted = only_id.strip().upper().removeprefix("CCG-")
        linked = [
            i for i in linked
            if str(i["id"]) == wanted or str(i.get("ccgNumber") or "").upper().removeprefix("CCG-") == wanted
        ]
        if not linked:
            console.print(f"No Reverb-linked CCG item found matching id {only_id} — nothing to do.")
            return
        console.print(f"[bold]Test mode: scoped to CCG item {only_id} only.[/bold]\n")

    if not linked:
        console.print("Nothing to do.")
        return

    console.print("[bold red]The following Reverb listings will be ENDED and their CCG links cleared:[/bold red]")
    for item in linked:
        ccg_number = str(item.get("ccgNumber") or item["id"]).upper().removeprefix("CCG-")
        console.print(f"  CCG-{ccg_number}  {item_title(item)}  (reverb id {item.get('reverbListingId')})")
    console.print(f"\n[bold red]{len(linked)} listing(s) total. Ending a Reverb listing cannot be undone.[/bold red]")

    typed = input(f"\nType '{CONFIRM_PHRASE}' to proceed, anything else to abort: ").strip()
    if typed != CONFIRM_PHRASE:
        console.print("Aborted — nothing was changed.")
        return

    cleared, failed = [], []
    for item in linked:
        ccg_number = str(item.get("ccgNumber") or item["id"]).upper().removeprefix("CCG-")
        try:
            client.remove_reverb_listing(item["id"])
            cleared.append(item)
            console.print(f"  cleared CCG-{ccg_number} ({item_title(item)})")
        except RuntimeError as error:
            failed.append((item, str(error)))
            console.print(f"  [yellow]FAILED[/yellow] CCG-{ccg_number} ({item_title(item)}): {error}")

    console.print(f"\n  {len(cleared)} ended and cleared, {len(failed)} failed.")
    if failed:
        console.print(
            "[bold yellow]Failed items still have their Reverb link in CCG (fail-closed, "
            "not force-cleared) — review manually, e.g. via the admin edit form's "
            "'Delete From Reverb' button, which surfaces the same Reverb error:[/bold yellow]"
        )
        for item, error in failed:
            ccg_number = str(item.get("ccgNumber") or item["id"]).upper().removeprefix("CCG-")
            console.print(f"  CCG-{ccg_number}: {error}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--ccg-id",
        help="Test mode: only process this one CCG item (matches its internal id or its "
        "CCG-XXXXXX number), instead of every Reverb-linked item.",
    )
    args = parser.parse_args()
    run_delete_all_reverb(only_id=args.ccg_id)
