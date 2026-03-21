"""
Shared pytest fixtures for the tag-calibration experiment.
"""

import json
from pathlib import Path

import pytest

from src.models import Card, GoldTag, Taxonomy

FIXTURES_DIR = Path(__file__).parent / "tests" / "fixtures"


@pytest.fixture
def sample_cards() -> list[Card]:
    raw = json.loads((FIXTURES_DIR / "sample_cards.json").read_text())
    return [Card.model_validate(r) for r in raw]


@pytest.fixture
def sample_taxonomy() -> Taxonomy:
    raw = json.loads((FIXTURES_DIR / "sample_taxonomy.json").read_text())
    return Taxonomy.model_validate(raw)


@pytest.fixture
def sample_gold_tags() -> dict[str, GoldTag]:
    raw = json.loads((FIXTURES_DIR / "sample_gold_tags.json").read_text())
    return {cid: GoldTag.model_validate(entry) for cid, entry in raw.items()}
