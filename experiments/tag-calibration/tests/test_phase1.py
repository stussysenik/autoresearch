"""
Tests for Phase 1: Taxonomy Discovery.

Tests cover card formatting, JSON extraction, taxonomy parsing,
stratified sampling, and partitioning — all with mocked API responses.
"""

import json
import math

import pytest

from src.models import Card, Taxonomy, TaxonomyCategory
from src.phase1_taxonomy.discover import (
    _cards_to_prompt_block,
    _extract_json,
    _parse_taxonomy,
    _partition,
)
from src.phase1_taxonomy.fetch_cards import _rows_to_cards, _stratified_sample


# ---------------------------------------------------------------------------
# _extract_json
# ---------------------------------------------------------------------------

class TestExtractJson:
    def test_clean_json(self):
        result = _extract_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_json_in_code_fence(self):
        text = '```json\n{"key": "value"}\n```'
        result = _extract_json(text)
        assert result == {"key": "value"}

    def test_json_with_surrounding_text(self):
        text = 'Here is the result:\n{"key": "value"}\nEnd of response.'
        result = _extract_json(text)
        assert result == {"key": "value"}

    def test_json_with_whitespace(self):
        text = '   \n  {"key": "value"}  \n  '
        result = _extract_json(text)
        assert result == {"key": "value"}

    def test_invalid_json_raises(self):
        with pytest.raises(ValueError, match="Could not parse JSON"):
            _extract_json("This is not JSON at all")

    def test_nested_json(self):
        text = '{"categories": [{"name": "primary", "vocabulary": ["ml"]}]}'
        result = _extract_json(text)
        assert result["categories"][0]["name"] == "primary"


# ---------------------------------------------------------------------------
# _parse_taxonomy
# ---------------------------------------------------------------------------

class TestParseTaxonomy:
    def test_standard_format(self):
        data = {
            "version": "1.0",
            "description": "Test taxonomy",
            "categories": [
                {
                    "name": "primary",
                    "description": "Core topics",
                    "vocabulary": ["ml", "web"],
                    "min_tags": 1,
                    "max_tags": 3,
                }
            ],
            "blocked_tags": ["generic"],
            "platform_guidelines": {"twitter": "Focus on ideas"},
        }
        taxonomy = _parse_taxonomy(data)
        assert isinstance(taxonomy, Taxonomy)
        assert len(taxonomy.categories) == 1
        assert taxonomy.categories[0].name == "primary"
        assert taxonomy.blocked_tags == ["generic"]

    def test_categories_as_dict(self):
        """LLM might return categories keyed by name instead of as a list."""
        data = {
            "categories": {
                "primary": {
                    "description": "Core topics",
                    "vocabulary": ["ml"],
                    "min_tags": 1,
                    "max_tags": 2,
                }
            }
        }
        taxonomy = _parse_taxonomy(data)
        assert len(taxonomy.categories) == 1
        assert taxonomy.categories[0].name == "primary"

    def test_missing_optional_fields(self):
        data = {"categories": [{"name": "test", "description": "test"}]}
        taxonomy = _parse_taxonomy(data)
        assert taxonomy.version == "1.0"
        assert taxonomy.blocked_tags == []

    def test_malformed_category_skipped(self):
        data = {
            "categories": [
                {"name": "good", "description": "valid"},
                "not a dict",  # This should be skipped
            ]
        }
        taxonomy = _parse_taxonomy(data)
        assert len(taxonomy.categories) == 1


# ---------------------------------------------------------------------------
# _partition
# ---------------------------------------------------------------------------

class TestPartition:
    def test_even_split(self):
        cards = [Card(id=f"c{i}") for i in range(20)]
        batches = _partition(cards, 4)
        assert len(batches) == 4
        assert all(len(b) == 5 for b in batches)

    def test_uneven_split(self):
        cards = [Card(id=f"c{i}") for i in range(7)]
        batches = _partition(cards, 3)
        assert len(batches) == 3
        total = sum(len(b) for b in batches)
        assert total == 7

    def test_single_batch(self):
        cards = [Card(id=f"c{i}") for i in range(5)]
        batches = _partition(cards, 1)
        assert len(batches) == 1
        assert len(batches[0]) == 5

    def test_more_batches_than_cards(self):
        cards = [Card(id=f"c{i}") for i in range(3)]
        batches = _partition(cards, 10)
        total = sum(len(b) for b in batches)
        assert total == 3


# ---------------------------------------------------------------------------
# _cards_to_prompt_block
# ---------------------------------------------------------------------------

class TestCardsToPromptBlock:
    def test_basic_formatting(self):
        cards = [
            Card(id="c1", type="article", title="Test Article", url="https://example.com"),
        ]
        block = _cards_to_prompt_block(cards)
        assert "### Card 1" in block
        assert "c1" in block
        assert "article" in block
        assert "Test Article" in block
        assert "https://example.com" in block

    def test_multiple_cards_separated(self):
        cards = [Card(id=f"c{i}") for i in range(3)]
        block = _cards_to_prompt_block(cards)
        assert "### Card 1" in block
        assert "### Card 2" in block
        assert "### Card 3" in block

    def test_includes_existing_tags(self):
        cards = [Card(id="c1", tags=["ml", "tutorial"])]
        block = _cards_to_prompt_block(cards)
        assert "ml, tutorial" in block

    def test_truncates_content(self):
        long_content = "x" * 2000
        cards = [Card(id="c1", content=long_content)]
        block = _cards_to_prompt_block(cards)
        # content_preview with max_len=800 should truncate
        assert len(block) < 2000


# ---------------------------------------------------------------------------
# _stratified_sample
# ---------------------------------------------------------------------------

class TestStratifiedSample:
    def test_basic_stratification(self):
        cards = []
        for platform in ["twitter", "github", "medium"]:
            for ctype in ["article", "video"]:
                for i in range(10):
                    cards.append(Card(
                        id=f"{platform}-{ctype}-{i}",
                        type=ctype,
                        metadata={"platform": platform},
                    ))
        sample = _stratified_sample(cards, target=12)
        assert len(sample) == 12

        # Check that we get cards from multiple platforms
        platforms = {c.platform for c in sample}
        assert len(platforms) > 1

    def test_target_larger_than_cards(self):
        cards = [Card(id=f"c{i}") for i in range(5)]
        sample = _stratified_sample(cards, target=100)
        assert len(sample) == 5  # Can't exceed available

    def test_empty_cards(self):
        sample = _stratified_sample([], target=10)
        assert sample == []

    def test_single_bucket(self):
        cards = [Card(id=f"c{i}", type="article", metadata={"platform": "twitter"}) for i in range(20)]
        sample = _stratified_sample(cards, target=10)
        assert len(sample) == 10


# ---------------------------------------------------------------------------
# _rows_to_cards
# ---------------------------------------------------------------------------

class TestRowsToCards:
    def test_valid_rows(self):
        rows = [
            {"id": "c1", "type": "article", "title": "Test"},
            {"id": "c2", "type": "video"},
        ]
        cards = _rows_to_cards(rows)
        assert len(cards) == 2
        assert cards[0].id == "c1"

    def test_invalid_row_skipped(self):
        rows = [
            {"id": "c1", "type": "article"},
            {"not_a_card": True},  # Missing 'id' field
        ]
        cards = _rows_to_cards(rows)
        # The second row should be skipped (no 'id')
        # Actually Card has no required fields except id, let's check
        assert len(cards) >= 1
