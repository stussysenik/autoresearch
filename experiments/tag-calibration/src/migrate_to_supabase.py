"""
Migrate gold tags to Supabase production.

Reads gold_tags.json, flattens 7-category tags into text[],
and batch-updates the cards table.

Usage:
    python -m src.migrate_to_supabase
    python -m src.migrate_to_supabase --dry-run
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from tqdm import tqdm

from src.config import DATA_DIR, get_supabase

logger = logging.getLogger(__name__)

GOLD_TAGS_PATH = DATA_DIR / "gold_tags.json"
BATCH_SIZE = 50


def flatten_tags(gold: dict) -> list[str]:
    """Flatten 7-category tags into a single list for the text[] column."""
    tags = gold.get("tags", {})
    flat = []
    for category in ["entity", "domain", "aesthetic", "format", "mood", "cultural-context", "intent"]:
        cat_tags = tags.get(category, [])
        if isinstance(cat_tags, list):
            flat.extend(cat_tags)
        elif isinstance(cat_tags, str) and cat_tags:
            flat.append(cat_tags)
    # Deduplicate while preserving order
    seen = set()
    result = []
    for t in flat:
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result


def migrate(dry_run: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

    # Load gold tags
    gold_data = json.loads(GOLD_TAGS_PATH.read_text())
    logger.info("Loaded %d gold tags", len(gold_data))

    # Filter to good tags only
    good = [g for g in gold_data if g.get("confidence", 0) > 0]
    logger.info("Good tags: %d (skipping %d failed)", len(good), len(gold_data) - len(good))

    if dry_run:
        # Show 5 examples
        for g in good[:5]:
            flat = flatten_tags(g)
            logger.info("  %s → %s", g["card_id"][:12], flat)
        logger.info("DRY RUN — no changes made")
        return

    # Connect to Supabase
    sb = get_supabase()
    logger.info("Connected to Supabase")

    # Batch update
    updated = 0
    errors = 0

    for i in tqdm(range(0, len(good), BATCH_SIZE), desc="Migrating", unit="batch"):
        batch = good[i:i + BATCH_SIZE]

        for g in batch:
            flat = flatten_tags(g)
            card_id = g["card_id"]

            try:
                sb.table("cards").update({"tags": flat}).eq("id", card_id).execute()
                updated += 1
            except Exception as exc:
                logger.error("Failed to update card %s: %s", card_id[:12], exc)
                errors += 1

    logger.info("Migration complete: %d updated, %d errors", updated, errors)


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    migrate(dry_run=dry_run)
