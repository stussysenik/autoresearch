"""
Phase 2 — Parallel Gold Tagging.

Runs N concurrent claude -p workers to tag cards ~10x faster.
Checkpoint-resumable, same validation/retry logic as sequential tagger.

Usage:
    python -m src.phase2_gold.parallel_tagger          # 10 workers (default)
    python -m src.phase2_gold.parallel_tagger --workers 5
"""

from __future__ import annotations

import json
import logging
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

from src.config import DATA_DIR
from src.models import Card, GoldTag, Taxonomy
from src.phase2_gold.checkpoint import load_checkpoint, save_checkpoint
from src.phase2_gold.tagger import (
    _build_system_prompt,
    _build_user_prompt,
    _build_retry_prompt,
    _validate_tags,
    MAX_RETRIES,
)
from src.utils.claude_client import call_claude

logger = logging.getLogger(__name__)

CHECKPOINT_PATH = DATA_DIR / "gold_checkpoint.json"
OUTPUT_PATH = DATA_DIR / "gold_tags.json"
CHECKPOINT_INTERVAL = 25  # Save more often with parallel workers


def tag_card_standalone(card: Card, taxonomy: Taxonomy, system_prompt: str) -> GoldTag:
    """Tag a single card — self-contained for thread safety."""
    import re as _re

    user_prompt = _build_user_prompt(card)
    errors: list[str] = []

    for attempt in range(1 + MAX_RETRIES):
        if attempt > 0 and errors:
            current_user_prompt = _build_retry_prompt(card, taxonomy, errors)
        else:
            current_user_prompt = user_prompt

        try:
            raw_text = call_claude(system_prompt, current_user_prompt)
        except Exception as exc:
            logger.warning("Claude error card %s (attempt %d): %s", card.id[:12], attempt + 1, exc)
            if attempt == MAX_RETRIES:
                return GoldTag.from_categorized(card.id, {}, reasoning=f"FAILED: {exc}", confidence=0.0)
            continue

        try:
            fenced = _re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw_text, _re.DOTALL)
            if fenced:
                raw_text = fenced.group(1)
            raw_text = raw_text.strip()
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                raw_text = raw_text[start:end + 1]
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            errors = ["Response was not valid JSON"]
            if attempt == MAX_RETRIES:
                return GoldTag.from_categorized(card.id, {}, reasoning="FAILED: bad JSON", confidence=0.0)
            continue

        reasoning = parsed.pop("reasoning", None)
        categorized: dict[str, list[str]] = {}
        for cat in taxonomy.categories:
            raw_tags = parsed.get(cat.name, [])
            if isinstance(raw_tags, str):
                raw_tags = [raw_tags]
            categorized[cat.name] = [str(t).strip() for t in raw_tags if str(t).strip()]

        errors = _validate_tags(categorized, taxonomy)
        if not errors:
            return GoldTag.from_categorized(card.id, categorized, reasoning=reasoning, confidence=0.85)

    return GoldTag.from_categorized(card.id, categorized,
                                     reasoning=(reasoning or "") + f" [WARNINGS: {'; '.join(errors)}]",
                                     confidence=0.5)


def parallel_tag_all(num_workers: int = 10) -> None:
    """Tag all cards using parallel workers."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

    # Load taxonomy
    taxonomy_path = DATA_DIR / "taxonomy.json"
    if not taxonomy_path.exists():
        logger.error("Taxonomy not found — run Phase 1 first")
        sys.exit(1)
    taxonomy = Taxonomy.model_validate_json(taxonomy_path.read_text())
    system_prompt = _build_system_prompt(taxonomy)
    logger.info("Loaded taxonomy v%s with %d categories", taxonomy.version, len(taxonomy.categories))

    # Load cards
    cards_path = DATA_DIR / "cards_all.json"
    if not cards_path.exists():
        cards_path = DATA_DIR / "cards_sample.json"
    cards = [Card.model_validate(c) for c in json.loads(cards_path.read_text())]
    logger.info("Loaded %d cards", len(cards))

    # Load checkpoint
    results = load_checkpoint(CHECKPOINT_PATH)
    remaining = [c for c in cards if c.id not in results]
    logger.info("%d already tagged, %d remaining, %d workers", len(results), len(remaining), num_workers)

    if not remaining:
        logger.info("All cards already tagged")
        _save_final(results)
        return

    # Lock for thread-safe checkpoint writes
    lock = threading.Lock()
    completed_since_checkpoint = 0

    def _on_complete(card_id: str, gold: GoldTag):
        nonlocal completed_since_checkpoint
        with lock:
            results[card_id] = gold
            completed_since_checkpoint += 1
            if completed_since_checkpoint >= CHECKPOINT_INTERVAL:
                save_checkpoint(results, CHECKPOINT_PATH)
                completed_since_checkpoint = 0

    # Run parallel workers
    try:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(tag_card_standalone, card, taxonomy, system_prompt): card
                for card in remaining
            }

            with tqdm(total=len(remaining), desc=f"Tagging ({num_workers} workers)", unit="card") as pbar:
                for future in as_completed(futures):
                    card = futures[future]
                    try:
                        gold = future.result(timeout=600)
                        _on_complete(card.id, gold)
                    except Exception as exc:
                        logger.error("Card %s failed: %s", card.id[:12], exc)
                        _on_complete(card.id, GoldTag.from_categorized(
                            card.id, {}, reasoning=f"FAILED: {exc}", confidence=0.0
                        ))
                    pbar.update(1)

    except KeyboardInterrupt:
        logger.warning("Interrupted — saving partial results")
    finally:
        save_checkpoint(results, CHECKPOINT_PATH)

    _save_final(results)


def _save_final(results: dict[str, GoldTag]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = [gold.model_dump() for gold in results.values()]
    OUTPUT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    logger.info("Saved %d gold tags to %s", len(data), OUTPUT_PATH)


if __name__ == "__main__":
    workers = 10
    if "--workers" in sys.argv:
        idx = sys.argv.index("--workers")
        workers = int(sys.argv[idx + 1])
    parallel_tag_all(num_workers=workers)
