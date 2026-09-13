import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fbm_client import FbListing
from match_mode import compute_matches


def ccg_item(id_, title, ccg_number=None):
    return {"id": id_, "saleTitle": title, "ccgNumber": ccg_number or f"CCG-{id_}"}


def test_unique_title_on_both_sides_matches():
    ccg = [ccg_item(1, "Fender Stratocaster 1975")]
    fbm = [FbListing(id="fb1", title="Fender Stratocaster 1975")]

    matched, ambiguous, unmatched = compute_matches(ccg, fbm)

    assert matched == [(ccg[0], fbm[0])]
    assert ambiguous == []
    assert unmatched == []


def test_duplicate_title_on_ccg_side_is_ambiguous_not_guessed():
    ccg = [ccg_item(1, "Boss DS-1 Distortion"), ccg_item(2, "Boss DS-1 Distortion")]
    fbm = [FbListing(id="fb1", title="Boss DS-1 Distortion")]

    matched, ambiguous, unmatched = compute_matches(ccg, fbm)

    assert matched == []
    assert len(ambiguous) == 1
    assert unmatched == []


def test_duplicate_title_on_fbm_side_is_ambiguous_not_guessed():
    ccg = [ccg_item(1, "Boss DS-1 Distortion")]
    fbm = [FbListing(id="fb1", title="Boss DS-1 Distortion"), FbListing(id="fb2", title="Boss DS-1 Distortion")]

    matched, ambiguous, unmatched = compute_matches(ccg, fbm)

    assert matched == []
    assert len(ambiguous) == 1
    assert unmatched == []


def test_no_fbm_listing_with_that_title_is_unmatched():
    ccg = [ccg_item(1, "Gibson Les Paul Custom")]
    fbm = [FbListing(id="fb1", title="Something Else Entirely")]

    matched, ambiguous, unmatched = compute_matches(ccg, fbm)

    assert matched == []
    assert ambiguous == []
    assert unmatched == [ccg[0]]


def test_falls_back_to_title_when_sale_title_missing():
    ccg = [{"id": 1, "saleTitle": "", "title": "Internal Name", "ccgNumber": "CCG-1"}]
    fbm = [FbListing(id="fb1", title="Internal Name")]

    matched, ambiguous, unmatched = compute_matches(ccg, fbm)

    assert matched == [(ccg[0], fbm[0])]
