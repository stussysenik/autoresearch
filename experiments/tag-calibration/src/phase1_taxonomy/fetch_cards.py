"""
Phase 1 — Fetch a diverse sample of cards from Supabase.

Pulls ~200 cards stratified by platform and content type so the taxonomy
discovery step sees a representative cross-section of the library.

Also provides `fetch_all_cards()` for Phase 2 gold-tagging, which downloads
every non-deleted, non-archived card.

Usage:
    python -m src.phase1_taxonomy.fetch_cards          # sample only
    python -m src.phase1_taxonomy.fetch_cards --all     # sample + full dump
"""

from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from typing import Any

from tqdm import tqdm

from src.config import DATA_DIR, SUPABASE_URL, SUPABASE_SERVICE_KEY, get_supabase
from src.models import Card

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SAMPLE_TARGET = 200          # desired sample size for taxonomy discovery
PAGE_SIZE = 1000             # Supabase max rows per request
SAMPLE_OUTPUT = DATA_DIR / "cards_sample.json"
ALL_OUTPUT = DATA_DIR / "cards_all.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _paginate_query(
    supabase,
    table: str = "cards",
    select: str = "*",
    filters: dict[str, Any] | None = None,
    order_by: str = "created_at",
) -> list[dict]:
    """Fetch all rows from a Supabase table, paginating in PAGE_SIZE chunks.

    Supabase caps a single request at 1 000 rows, so we walk through the
    full result set using `.range(start, end)`.

    Args:
        supabase:  Authenticated Supabase client.
        table:     Table name to query.
        select:    Column selection string (default ``"*"``).
        filters:   Optional dict of ``{column: value}`` equality filters.
        order_by:  Column to order by (keeps pages deterministic).

    Returns:
        List of row dicts.
    """
    all_rows: list[dict] = []
    offset = 0

    while True:
        query = (
            supabase.table(table)
            .select(select)
            .is_("deleted_at", "null")
            .is_("archived_at", "null")
            .order(order_by)
            .range(offset, offset + PAGE_SIZE - 1)
        )
        # Apply any extra equality filters.
        if filters:
            for col, val in filters.items():
                query = query.eq(col, val)

        response = query.execute()
        rows = response.data or []
        all_rows.extend(rows)

        if len(rows) < PAGE_SIZE:
            break  # last page
        offset += PAGE_SIZE

    return all_rows


def _rows_to_cards(rows: list[dict]) -> list[Card]:
    """Convert raw Supabase rows into validated Card models.

    Silently skips rows that fail validation so one bad record doesn't
    blow up the whole pipeline.
    """
    cards: list[Card] = []
    for row in rows:
        try:
            cards.append(Card.model_validate(row))
        except Exception:
            # Skip malformed rows — log if you want observability later.
            continue
    return cards


def _stratified_sample(cards: list[Card], target: int = SAMPLE_TARGET) -> list[Card]:
    """Return a stratified sample aiming for even coverage across
    (platform, content_type) buckets.

    Strategy:
        1. Group cards by (platform, type).
        2. Compute per-bucket quota = ceil(target / num_buckets).
        3. Draw up to quota from each bucket.
        4. If total < target, top up from the largest remaining buckets.
    """
    # --- bucket cards ---
    buckets: dict[tuple[str, str], list[Card]] = defaultdict(list)
    for card in cards:
        key = (card.platform, card.type)
        buckets[key].append(card)

    num_buckets = len(buckets)
    if num_buckets == 0:
        return []

    quota = math.ceil(target / num_buckets)
    sampled: list[Card] = []
    leftover: list[Card] = []

    for key, bucket in buckets.items():
        take = min(quota, len(bucket))
        sampled.extend(bucket[:take])
        leftover.extend(bucket[take:])

    # --- top-up if we're short ---
    deficit = target - len(sampled)
    if deficit > 0 and leftover:
        sampled.extend(leftover[:deficit])

    # --- trim if we overshot ---
    return sampled[:target]


def _save_cards(cards: list[Card], path) -> None:
    """Serialize a list of Cards to JSON."""
    data = [card.model_dump(mode="json") for card in cards]
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_sample_cards() -> list[Card]:
    """Fetch ~200 diverse cards from Supabase and save to data/cards_sample.json.

    Returns:
        The sampled list of Card models.
    """
    print(f"Connecting to Supabase at {SUPABASE_URL[:40]}...")
    sb = get_supabase()

    print("Fetching all active cards (paginated)...")
    rows = _paginate_query(sb)
    print(f"  Retrieved {len(rows)} total active cards.")

    cards = _rows_to_cards(rows)
    print(f"  Parsed {len(cards)} valid Card objects.")

    # --- stratify ---
    sample = _stratified_sample(cards, SAMPLE_TARGET)
    print(f"  Stratified sample: {len(sample)} cards.")

    # --- summarize distribution ---
    platform_counts: dict[str, int] = defaultdict(int)
    type_counts: dict[str, int] = defaultdict(int)
    for card in sample:
        platform_counts[card.platform] += 1
        type_counts[card.type] += 1

    print("\n  Platform distribution:")
    for plat, count in sorted(platform_counts.items(), key=lambda x: -x[1]):
        print(f"    {plat:20s}  {count}")

    print("\n  Content-type distribution:")
    for ctype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {ctype:20s}  {count}")

    # --- persist ---
    _save_cards(sample, SAMPLE_OUTPUT)
    print(f"\n  Saved sample to {SAMPLE_OUTPUT}")

    return sample


def fetch_all_cards() -> list[Card]:
    """Fetch ALL non-deleted, non-archived cards and save to data/cards_all.json.

    Used by Phase 2 (gold-tagging) to tag the complete library.

    Returns:
        The full list of Card models.
    """
    print(f"Connecting to Supabase at {SUPABASE_URL[:40]}...")
    sb = get_supabase()

    print("Fetching ALL active cards (paginated)...")
    rows = _paginate_query(sb)
    print(f"  Retrieved {len(rows)} total active cards.")

    cards = _rows_to_cards(rows)
    print(f"  Parsed {len(cards)} valid Card objects.")

    _save_cards(cards, ALL_OUTPUT)
    print(f"  Saved full dump to {ALL_OUTPUT}")

    return cards


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    fetch_sample_cards()

    if "--all" in sys.argv:
        print("\n--- Fetching ALL cards for Phase 2 ---\n")
        fetch_all_cards()

    print("\nDone.")
