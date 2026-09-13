import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from reconcile import fuzzy_match, reconcile


@dataclass
class FbListing:
    id: str
    title: str


def ccg_item(id_, title, for_sale=True, fb_listing_id=None):
    return {"id": id_, "saleTitle": title, "forSale": for_sale, "fbListingId": fb_listing_id}


def test_linked_item_matching_live_listing_is_in_sync():
    ccg = [ccg_item(1, "Fender Stratocaster", fb_listing_id="fb1")]
    fbm = [FbListing(id="fb1", title="Fender Stratocaster (used)")]

    b = reconcile(ccg, fbm)

    assert b["in_sync"] == [(ccg[0], fbm[0])]
    assert b["to_post"] == []
    assert b["stale_fb_id"] == []
    assert b["possible_link"] == []
    assert b["unknown_fbm"] == []


def test_unlinked_for_sale_item_with_no_fb_match_is_to_post():
    ccg = [ccg_item(1, "Gibson Les Paul")]
    fbm: list = []

    b = reconcile(ccg, fbm)

    assert b["to_post"] == [ccg[0]]


def test_not_for_sale_item_is_ignored_entirely():
    ccg = [ccg_item(1, "Gibson Les Paul", for_sale=False)]
    fbm: list = []

    b = reconcile(ccg, fbm)

    assert b["to_post"] == []
    assert b["in_sync"] == []


def test_fb_listing_with_similar_title_to_unlinked_item_is_possible_link_not_auto_linked():
    ccg = [ccg_item(1, "Fender Player Stratocaster HSS Plus Top Blue Burst")]
    fbm = [FbListing(id="fb1", title="Fender Player Stratocaster HSS Plus Top - Blue Burst")]

    b = reconcile(ccg, fbm)

    assert b["possible_link"] == [(ccg[0], fbm[0])]
    assert b["to_post"] == []  # matched candidate is pulled out of to_post
    assert b["unknown_fbm"] == []


def test_fb_listing_with_no_similar_title_is_unknown():
    ccg = [ccg_item(1, "Fender Player Stratocaster")]
    fbm = [FbListing(id="fb1", title="Totally unrelated vintage lamp")]

    b = reconcile(ccg, fbm)

    assert b["unknown_fbm"] == [fbm[0]]
    assert b["possible_link"] == []
    assert b["to_post"] == [ccg[0]]  # untouched, no plausible match found


def test_linked_item_missing_from_live_listings_is_stale():
    ccg = [ccg_item(1, "Gibson Les Paul", fb_listing_id="fb1")]
    fbm: list = []  # nothing live on FB right now

    b = reconcile(ccg, fbm)

    assert b["stale_fb_id"] == [ccg[0]]
    assert b["in_sync"] == []


def test_possible_link_only_matches_each_ccg_candidate_once():
    ccg = [ccg_item(1, "MXR Phase 90 Pedal")]
    fbm = [
        FbListing(id="fb1", title="MXR Phase 90 Pedal"),
        FbListing(id="fb2", title="MXR Phase 90 Pedal"),
    ]

    b = reconcile(ccg, fbm)

    # First listing claims the only candidate; second must not also claim it.
    assert len(b["possible_link"]) == 1
    assert len(b["unknown_fbm"]) == 1


def test_fuzzy_match_respects_threshold():
    candidates = [{"id": 1, "saleTitle": "Fender Stratocaster"}]

    assert fuzzy_match("Fender Stratocaster", candidates) is not None
    assert fuzzy_match("Completely different item name", candidates, threshold=0.6) is None
