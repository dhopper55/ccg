"""Reads current Facebook Marketplace listings.

Manual paste for now (ARCHITECTURE.md Section 6, decided 2026-09-13). Swapping this
for browser automation later only means replacing this file — reconcile.py, approve.py,
and match_mode.py never call FBM directly.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FbListing:
    id: str
    title: str


def get_active_listings() -> list[FbListing]:
    print("Paste your current Facebook Marketplace listings, one per line, as:")
    print("  <listing id>,<title>")
    print("Finish with a blank line.\n")

    listings: list[FbListing] = []
    while True:
        try:
            line = input().strip()
        except EOFError:
            break
        if not line:
            break
        if "," not in line:
            print(f"  Skipping (expected 'id,title'): {line}")
            continue
        listing_id, title = line.split(",", 1)
        listings.append(FbListing(id=listing_id.strip(), title=title.strip()))
    return listings
