#!/usr/bin/env python3
"""
south_broadway_businesses.py

Walks the South Broadway corridor from Broadway & Speer (Denver) to
Broadway & Belleview (Englewood/Littleton) and pulls every business
listing via the Google Places Nearby Search API.

Outputs a CSV with: name, address, type

Usage:
    python scripts/south_broadway_businesses.py --api-key YOUR_KEY
    python scripts/south_broadway_businesses.py --api-key YOUR_KEY --output my_file.csv
    python scripts/south_broadway_businesses.py --api-key YOUR_KEY --all   # skip Broadway-address filter

Requirements:
    None — uses Python standard library only (no pip install needed)
"""

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request

# ── Corridor endpoints ────────────────────────────────────────────────────────
# Broadway & Speer, Denver
START = (39.7192, -104.9878)
# Broadway & Belleview, Englewood/Littleton
END   = (39.6228, -104.9852)

# ── Search tuning ─────────────────────────────────────────────────────────────
STEP_METERS   = 200   # spacing between sample points along the corridor
RADIUS_METERS = 250   # search radius per point (wider to handle Broadway's slight westward drift)

PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

# Only include businesses that match at least one of these Google type tags
ALLOWED_TYPES = {"bar", "cafe", "night_club", "point_of_interest", "store"}


def interpolate(start, end, n_steps):
    """Generate n_steps+1 evenly-spaced (lat, lng) tuples from start to end."""
    points = []
    for i in range(n_steps + 1):
        t = i / n_steps
        lat = start[0] + t * (end[0] - start[0])
        lng = start[1] + t * (end[1] - start[1])
        points.append((lat, lng))
    return points


def corridor_waypoints(start, end, step_meters):
    """Return waypoints spaced ~step_meters apart along the corridor."""
    lat_span = abs(start[0] - end[0])
    total_meters = lat_span * 111_000          # rough conversion near Denver
    n_steps = max(1, round(total_meters / step_meters))
    return interpolate(start, end, n_steps)


def http_get_json(url: str, params: dict, retries: int = 2) -> dict | None:
    """Fetch a URL with query params and return parsed JSON, or None on error."""
    full_url = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(1, retries + 2):
        try:
            with urllib.request.urlopen(full_url, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"    HTTP {e.code} on attempt {attempt}", file=sys.stderr)
            if attempt <= retries:
                time.sleep(3 * attempt)
            else:
                return None
        except urllib.error.URLError as e:
            print(f"    URL error on attempt {attempt}: {e.reason}", file=sys.stderr)
            if attempt <= retries:
                time.sleep(3 * attempt)
            else:
                return None


def fetch_nearby(api_key, lat, lng, radius):
    """Yield all place dicts from a Nearby Search, handling pagination."""
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": "establishment",
        "key": api_key,
    }
    page = 0
    while True:
        data = http_get_json(PLACES_URL, params)
        if data is None:
            break

        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            print(f"    API status: {status}", file=sys.stderr)
            break

        yield from data.get("results", [])
        page += 1

        next_token = data.get("next_page_token")
        if not next_token or page >= 3:   # max 3 pages = 60 results per point
            break

        # Google requires a short pause before the next_page_token is usable
        time.sleep(2.2)
        params = {"pagetoken": next_token, "key": api_key}


def is_allowed(place) -> bool:
    return bool(set(place.get("types", [])) & ALLOWED_TYPES)


STRIP_TYPES = {"establishment", "geocode"}

def matched_type(place) -> str:
    """Return all meaningful type tags for this place, pipe-delimited."""
    types = [t.replace("_", " ") for t in place.get("types", []) if t not in STRIP_TYPES]
    return " | ".join(types)


PHOTO_URL  = "https://maps.googleapis.com/maps/api/place/photo"
STATIC_MAP = "https://maps.googleapis.com/maps/api/staticmap"


def photo_url(place, api_key: str) -> str:
    photos = place.get("photos")
    if not photos:
        return ""
    ref = photos[0].get("photo_reference", "")
    if not ref:
        return ""
    return f"{PHOTO_URL}?maxwidth=400&photoreference={ref}&key={api_key}"


def map_url(place, api_key: str) -> str:
    loc = place.get("geometry", {}).get("location", {})
    lat = loc.get("lat")
    lng = loc.get("lng")
    if lat is None or lng is None:
        return ""
    center = f"{lat},{lng}"
    return (
        f"{STATIC_MAP}?center={center}&zoom=17&size=400x300"
        f"&markers=color:red%7C{center}&key={api_key}"
    )


def is_broadway_address(vicinity: str) -> bool:
    """True when the place's address is on Broadway (not a side street)."""
    v = vicinity.lower()
    return "broadway" in v


def main():
    parser = argparse.ArgumentParser(
        description="Fetch South Broadway businesses via Google Places API"
    )
    parser.add_argument("--api-key", required=True, help="Google Places API key")
    parser.add_argument(
        "--output",
        default="south_broadway_businesses.csv",
        help="Output CSV path (default: south_broadway_businesses.csv)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="all_results",
        help="Include businesses on side streets (skip Broadway-address filter)",
    )
    args = parser.parse_args()

    waypoints = corridor_waypoints(START, END, STEP_METERS)
    total = len(waypoints)
    print(
        f"Sampling {total} points along South Broadway "
        f"({STEP_METERS}m spacing, {RADIUS_METERS}m radius) ...",
        file=sys.stderr,
    )

    seen: dict[str, dict] = {}   # place_id → row dict
    order: list[str] = []        # place_ids in discovery order (north→south)

    for i, (lat, lng) in enumerate(waypoints, 1):
        print(f"  [{i:>3}/{total}] {lat:.5f}, {lng:.6f}", end="  ", file=sys.stderr)
        count_before = len(seen)

        for place in fetch_nearby(args.api_key, lat, lng, RADIUS_METERS):
            pid = place.get("place_id")
            if not pid or pid in seen:
                continue
            vicinity = place.get("vicinity", "")
            if not args.all_results and not is_broadway_address(vicinity):
                continue
            seen[pid] = {
                "name":       place.get("name", ""),
                "address":    vicinity,
                "type":       matched_type(place),
                "google_url": f"https://www.google.com/maps/place/?q=place_id:{pid}",
                "photo_url":  photo_url(place, args.api_key),
                "map_url":    map_url(place, args.api_key),
            }
            order.append(pid)

        new_count = len(seen) - count_before
        print(f"+{new_count} new  (total: {len(seen)})", file=sys.stderr)

        # Write progress after every waypoint so a crash doesn't lose everything
        if new_count > 0:
            rows = [seen[pid] for pid in order]
            with open(args.output, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=["name", "address", "type", "google_url", "photo_url", "map_url"])
                writer.writeheader()
                writer.writerows(rows)

        time.sleep(0.15)   # stay well within API rate limits

    print(f"\n{len(seen)} unique businesses found. Saved to: {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
