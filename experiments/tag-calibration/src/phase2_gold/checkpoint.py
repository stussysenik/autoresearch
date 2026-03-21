"""
Simple checkpoint system for resumable batch processing.

Saves and loads intermediate gold-tagging results so that a crashed or
interrupted run can pick up where it left off without re-tagging cards
that have already been processed.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from src.models import GoldTag

logger = logging.getLogger(__name__)


def load_checkpoint(path: Path) -> dict[str, GoldTag]:
    """Load checkpoint file, returning card_id -> GoldTag mapping.

    If the checkpoint file does not exist or is corrupt, returns an empty dict
    so the caller can start fresh.

    Args:
        path: Path to the JSON checkpoint file.

    Returns:
        Mapping of card_id to its GoldTag result.
    """
    if not path.exists():
        logger.info("No checkpoint file found at %s — starting fresh", path)
        return {}

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        results: dict[str, GoldTag] = {}
        for card_id, entry in raw.items():
            results[card_id] = GoldTag.model_validate(entry)
        logger.info("Loaded checkpoint with %d completed cards from %s", len(results), path)
        return results
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Corrupt checkpoint at %s (%s) — starting fresh", path, exc)
        return {}


def save_checkpoint(results: dict[str, GoldTag], path: Path) -> None:
    """Save current results as checkpoint.

    Writes atomically by first writing to a temp file then renaming,
    preventing corruption if the process is killed mid-write.

    Args:
        results: Mapping of card_id to GoldTag.
        path: Destination path for the checkpoint JSON.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    # Build serializable dict
    data = {card_id: gold.model_dump() for card_id, gold in results.items()}

    # Atomic write: write to temp file, then rename
    tmp_path = path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp_path.rename(path)

    logger.debug("Checkpoint saved: %d cards → %s", len(results), path)
