"""
Phase 2 — Batch Parallel Gold Tagging (SPEED MODE).

Sends 5 cards per claude -p call × 10 parallel workers.
~5x faster than single-card tagger.

Usage:
    python -m src.phase2_gold.batch_tagger
    python -m src.phase2_gold.batch_tagger --batch-size 5 --workers 10
"""

from __future__ import annotations

import json
import logging
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

from src.config import DATA_DIR
from src.models import Card, GoldTag, Taxonomy
from src.phase2_gold.checkpoint import load_checkpoint, save_checkpoint
from src.phase2_gold.tagger import _build_taxonomy_block
from src.utils.claude_client import call_claude

logger = logging.getLogger(__name__)

CHECKPOINT_PATH = DATA_DIR / "gold_checkpoint.json"
OUTPUT_PATH = DATA_DIR / "gold_tags.json"
CHECKPOINT_INTERVAL = 25


def _build_batch_system_prompt(taxonomy: Taxonomy) -> str:
    taxonomy_block = _build_taxonomy_block(taxonomy)
    return f"""You are an expert content tagger. Tag MULTIPLE cards at once.

{taxonomy_block}

## Instructions

For EACH card below, assign tags per the taxonomy. Return a JSON ARRAY — one object per card, in the same order as the input.

Each object must have:
- "card_id": the card's ID
- One key per taxonomy category (using exact category names)
- "reasoning": brief explanation

Example output format:
[
  {{"card_id": "abc-123", "entity": ["apple"], "domain": ["ui-ux"], "aesthetic": ["minimalist"], "format": ["design-screenshot"], "mood": ["serene"], "cultural-context": [], "intent": ["visual-inspiration"], "reasoning": "..."}},
  {{"card_id": "def-456", "entity": [], "domain": ["literature"], "format": ["book-entry"], "mood": ["contemplative"], "cultural-context": [], "intent": ["to-read"], "reasoning": "..."}}
]

Return ONLY the JSON array. No markdown fences, no extra text."""


def _build_batch_user_prompt(cards: list[Card]) -> str:
    parts = []
    for i, card in enumerate(cards, 1):
        lines = [f"### Card {i}"]
        lines.append(f"ID: {card.id}")
        lines.append(f"Type: {card.type}")
        if card.title:
            lines.append(f"Title: {card.title}")
        if card.url:
            lines.append(f"URL: {card.url}")
        platform = card.platform
        if platform != "unknown":
            lines.append(f"Platform: {platform}")
        preview = card.content_preview(max_len=800)
        if preview:
            lines.append(f"Content: {preview}")
        if card.tags:
            lines.append(f"Existing tags: {', '.join(card.tags)}")
        parts.append("\n".join(lines))
    return "\n\n---\n\n".join(parts)


def _parse_batch_response(raw: str, cards: list[Card], taxonomy: Taxonomy) -> list[GoldTag]:
    """Parse a batch JSON array response into GoldTag objects."""
    # Extract JSON array
    fenced = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
    if fenced:
        raw = fenced.group(1)
    raw = raw.strip()

    # Find the array
    start = raw.find("[")
    end = raw.rfind("]")
    if start != -1 and end != -1 and end > start:
        raw = raw[start:end + 1]

    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        parsed = [parsed]

    # Map results back to cards
    card_ids = {c.id for c in cards}
    results = []

    for item in parsed:
        card_id = item.get("card_id", "")
        if card_id not in card_ids:
            # Try to match by position if IDs don't match
            continue

        reasoning = item.pop("reasoning", None)
        item.pop("card_id", None)

        categorized: dict[str, list[str]] = {}
        for cat in taxonomy.categories:
            raw_tags = item.get(cat.name, [])
            if isinstance(raw_tags, str):
                raw_tags = [raw_tags]
            categorized[cat.name] = [str(t).strip() for t in raw_tags if str(t).strip()]

        results.append(GoldTag.from_categorized(
            card_id=card_id,
            categorized_tags=categorized,
            reasoning=reasoning,
            confidence=0.85,
        ))

    return results


def tag_batch(cards: list[Card], taxonomy: Taxonomy, system_prompt: str) -> list[GoldTag]:
    """Tag a batch of cards in a single claude -p call."""
    user_prompt = _build_batch_user_prompt(cards)

    try:
        raw = call_claude(system_prompt, user_prompt, timeout=600)
        results = _parse_batch_response(raw, cards, taxonomy)

        # If we didn't get all cards back, tag missing ones individually
        tagged_ids = {g.card_id for g in results}
        for card in cards:
            if card.id not in tagged_ids:
                results.append(GoldTag.from_categorized(
                    card.id, {}, reasoning="MISSED in batch", confidence=0.0
                ))

        return results
    except Exception as exc:
        logger.warning("Batch failed (%d cards): %s", len(cards), exc)
        # Return failures for all cards in batch
        return [
            GoldTag.from_categorized(c.id, {}, reasoning=f"BATCH FAILED: {exc}", confidence=0.0)
            for c in cards
        ]


def batch_tag_all(batch_size: int = 5, num_workers: int = 10) -> None:
    """Tag all cards using batched parallel workers."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

    # Load taxonomy
    taxonomy_path = DATA_DIR / "taxonomy.json"
    taxonomy = Taxonomy.model_validate_json(taxonomy_path.read_text())
    system_prompt = _build_batch_system_prompt(taxonomy)
    logger.info("Loaded taxonomy v%s with %d categories", taxonomy.version, len(taxonomy.categories))

    # Load cards
    cards_path = DATA_DIR / "cards_all.json"
    if not cards_path.exists():
        cards_path = DATA_DIR / "cards_sample.json"
    cards = [Card.model_validate(c) for c in json.loads(cards_path.read_text())]
    logger.info("Loaded %d cards", len(cards))

    # Load checkpoint
    results = load_checkpoint(CHECKPOINT_PATH)
    # Clean out any failed entries
    results = {cid: g for cid, g in results.items() if g.confidence > 0}
    remaining = [c for c in cards if c.id not in results]
    logger.info("%d good tags, %d remaining, batch=%d, workers=%d",
                len(results), len(remaining), batch_size, num_workers)

    if not remaining:
        logger.info("All cards tagged!")
        _save_final(results)
        return

    # Split remaining into batches
    batches = [remaining[i:i + batch_size] for i in range(0, len(remaining), batch_size)]
    logger.info("%d batches to process", len(batches))

    lock = threading.Lock()
    completed_since_checkpoint = 0

    def _on_batch_complete(golds: list[GoldTag]):
        nonlocal completed_since_checkpoint
        with lock:
            for g in golds:
                results[g.card_id] = g
            completed_since_checkpoint += len(golds)
            if completed_since_checkpoint >= CHECKPOINT_INTERVAL:
                save_checkpoint(results, CHECKPOINT_PATH)
                completed_since_checkpoint = 0

    try:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(tag_batch, batch, taxonomy, system_prompt): batch
                for batch in batches
            }

            with tqdm(total=len(remaining), desc=f"Batch tagging ({num_workers}w×{batch_size}b)",
                       unit="card") as pbar:
                for future in as_completed(futures):
                    batch = futures[future]
                    try:
                        golds = future.result(timeout=900)
                        _on_batch_complete(golds)
                        pbar.update(len(batch))
                    except Exception as exc:
                        logger.error("Batch of %d failed: %s", len(batch), exc)
                        fails = [GoldTag.from_categorized(c.id, {}, reasoning=f"FAILED: {exc}", confidence=0.0)
                                 for c in batch]
                        _on_batch_complete(fails)
                        pbar.update(len(batch))

    except KeyboardInterrupt:
        logger.warning("Interrupted — saving")
    finally:
        save_checkpoint(results, CHECKPOINT_PATH)

    _save_final(results)


def _save_final(results: dict[str, GoldTag]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = [gold.model_dump() for gold in results.values()]
    OUTPUT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    logger.info("Saved %d gold tags to %s", len(data), OUTPUT_PATH)


if __name__ == "__main__":
    batch_size = 5
    workers = 10
    args = sys.argv[1:]
    if "--batch-size" in args:
        batch_size = int(args[args.index("--batch-size") + 1])
    if "--workers" in args:
        workers = int(args[args.index("--workers") + 1])
    batch_tag_all(batch_size=batch_size, num_workers=workers)
