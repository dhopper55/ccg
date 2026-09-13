"""Pure reconciliation logic for the CCG <-> FBM sync — no I/O, see ARCHITECTURE.md Section 5.

Two features from the original design are deliberately NOT implemented (decided 2026-09-13):
`fb_sync_state` ("mark CCG-only, stop asking") and the `fb_ignore_list` (personal FB items,
not CCG inventory). Both are deferred to later. Practically this means:
- Every CCG for-sale item without a linked FB listing is always a `to_post` candidate —
  there's no way yet to tell the tool "don't ask about this one again."
- Every FB listing that doesn't match any CCG item falls into `unknown_fbm` every run —
  there's no way yet to say "that one's personal, stop asking."
Both are known, accepted limitations, not oversights.
"""
from __future__ import annotations

import difflib

FUZZY_MATCH_THRESHOLD = 0.6


def item_title(item: dict) -> str:
    return (item.get("saleTitle") or item.get("title") or "").strip()


def fuzzy_match(listing_title: str, candidates: list[dict], threshold: float = FUZZY_MATCH_THRESHOLD) -> dict | None:
    """Best title-similarity match above threshold, or None. Loose on purpose — this only
    ever produces a *suggestion* the user confirms in bucket `possible_link`, never a write."""
    best: dict | None = None
    best_ratio = 0.0
    for item in candidates:
        ratio = difflib.SequenceMatcher(None, listing_title.lower(), item_title(item).lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best = item
    return best if best is not None and best_ratio >= threshold else None


def reconcile(ccg_items: list[dict], fbm_listings: list) -> dict:
    """Buckets:
    - to_post: CCG for-sale, no fb_listing_id, and no plausible FB match found either.
    - in_sync: CCG item's fb_listing_id matches a live FB listing.
    - possible_link: an FB listing with no CCG match, but title-similar to an unlinked
      for-sale CCG item — needs a human decision, never auto-linked.
    - unknown_fbm: an FB listing with no CCG match and no plausible link.
    - stale_fb_id: a CCG item has a fb_listing_id that isn't in FB's current live listings
      (sold there, removed, or wrong id) — needs a human decision.
    """
    for_sale_items = [i for i in ccg_items if i.get("forSale")]
    to_post_pool = [i for i in for_sale_items if not i.get("fbListingId")]
    fb_id_lookup = {str(i["fbListingId"]): i for i in for_sale_items if i.get("fbListingId")}

    in_sync: list[tuple[dict, object]] = []
    possible_link: list[tuple[dict, object]] = []
    unknown_fbm: list = []
    linked_candidate_ids: set = set()

    for listing in fbm_listings:
        if listing.id in fb_id_lookup:
            in_sync.append((fb_id_lookup.pop(listing.id), listing))
            continue
        remaining_pool = [i for i in to_post_pool if i["id"] not in linked_candidate_ids]
        candidate = fuzzy_match(listing.title, remaining_pool)
        if candidate is not None:
            possible_link.append((candidate, listing))
            linked_candidate_ids.add(candidate["id"])
        else:
            unknown_fbm.append(listing)

    to_post = [i for i in to_post_pool if i["id"] not in linked_candidate_ids]
    stale_fb_id = list(fb_id_lookup.values())

    return {
        "to_post": to_post,
        "in_sync": in_sync,
        "possible_link": possible_link,
        "unknown_fbm": unknown_fbm,
        "stale_fb_id": stale_fb_id,
    }
