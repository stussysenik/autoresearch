"""
Tests for Phase 2: Gold Tagging.

Covers checkpoint save/load, tag validation, prompt building, and
the tag_card function with mocked GLM responses.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.models import Card, GoldTag, Taxonomy, TaxonomyCategory
from src.phase2_gold.checkpoint import load_checkpoint, save_checkpoint
from src.phase2_gold.tagger import (
    _build_system_prompt,
    _build_taxonomy_block,
    _build_user_prompt,
    _validate_tags,
)


# ---------------------------------------------------------------------------
# Checkpoint tests
# ---------------------------------------------------------------------------

class TestCheckpoint:
    def test_save_and_load(self, tmp_path):
        path = tmp_path / "checkpoint.json"
        gold = GoldTag.from_categorized(
            card_id="c1",
            categorized_tags={"primary": ["ml"], "style": ["raw"]},
            reasoning="test",
        )
        results = {"c1": gold}

        save_checkpoint(results, path)
        assert path.exists()

        loaded = load_checkpoint(path)
        assert "c1" in loaded
        assert loaded["c1"].card_id == "c1"
        assert loaded["c1"].flat_tags == gold.flat_tags

    def test_load_missing_file(self, tmp_path):
        path = tmp_path / "nonexistent.json"
        result = load_checkpoint(path)
        assert result == {}

    def test_load_corrupt_file(self, tmp_path):
        path = tmp_path / "corrupt.json"
        path.write_text("not valid json {{{")
        result = load_checkpoint(path)
        assert result == {}

    def test_atomic_write(self, tmp_path):
        """Ensure no .tmp file remains after successful save."""
        path = tmp_path / "checkpoint.json"
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"]})
        save_checkpoint({"c1": gold}, path)

        tmp_file = path.with_suffix(".tmp")
        assert not tmp_file.exists()
        assert path.exists()

    def test_multiple_cards(self, tmp_path):
        path = tmp_path / "checkpoint.json"
        results = {
            f"c{i}": GoldTag.from_categorized(f"c{i}", {"primary": [f"tag-{i}"]})
            for i in range(10)
        }
        save_checkpoint(results, path)
        loaded = load_checkpoint(path)
        assert len(loaded) == 10


# ---------------------------------------------------------------------------
# Tag validation
# ---------------------------------------------------------------------------

class TestValidateTags:
    def test_valid_tags(self, sample_taxonomy):
        categorized = {
            "primary": ["machine-learning"],
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
        }
        errors = _validate_tags(categorized, sample_taxonomy)
        assert errors == []

    def test_too_few_tags(self, sample_taxonomy):
        categorized = {
            "primary": [],  # min is 1
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
        }
        errors = _validate_tags(categorized, sample_taxonomy)
        assert any("minimum" in e for e in errors)

    def test_too_many_tags(self, sample_taxonomy):
        categorized = {
            "primary": ["ml", "web", "react", "python"],  # max is 3
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
        }
        errors = _validate_tags(categorized, sample_taxonomy)
        assert any("maximum" in e for e in errors)

    def test_blocked_tag(self, sample_taxonomy):
        categorized = {
            "primary": ["website"],  # blocked
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
        }
        errors = _validate_tags(categorized, sample_taxonomy)
        assert any("blocked" in e for e in errors)

    def test_missing_category(self, sample_taxonomy):
        """Missing a category entirely should trigger min_tags violation."""
        categorized = {
            "primary": ["ml"],
            # "contextual" missing — min is 1
            "style": ["dark-mode"],
        }
        errors = _validate_tags(categorized, sample_taxonomy)
        assert any("contextual" in e and "minimum" in e for e in errors)


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

class TestPromptBuilding:
    def test_taxonomy_block_includes_categories(self, sample_taxonomy):
        block = _build_taxonomy_block(sample_taxonomy)
        assert "primary" in block
        assert "contextual" in block
        assert "style" in block

    def test_taxonomy_block_includes_vocabulary(self, sample_taxonomy):
        block = _build_taxonomy_block(sample_taxonomy)
        assert "machine-learning" in block
        assert "tutorial" in block

    def test_taxonomy_block_includes_blocked(self, sample_taxonomy):
        block = _build_taxonomy_block(sample_taxonomy)
        assert "Blocked" in block
        assert "website" in block

    def test_system_prompt_structure(self, sample_taxonomy):
        prompt = _build_system_prompt(sample_taxonomy)
        assert "expert content tagger" in prompt.lower()
        assert "JSON" in prompt
        assert "reasoning" in prompt

    def test_user_prompt_includes_card_info(self):
        card = Card(
            id="c1",
            type="article",
            title="Test Title",
            url="https://example.com",
            content="Test content here",
            metadata={"platform": "github"},
        )
        prompt = _build_user_prompt(card)
        assert "c1" in prompt
        assert "article" in prompt
        assert "Test Title" in prompt
        assert "https://example.com" in prompt
        assert "github" in prompt


# ---------------------------------------------------------------------------
# tag_card with mocked GLM
# ---------------------------------------------------------------------------

class TestTagCard:
    @patch("src.phase2_gold.tagger.call_claude")
    def test_successful_tag(self, mock_claude, sample_taxonomy):
        response = {
            "primary": ["machine-learning"],
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
            "reasoning": "Test reasoning",
        }
        mock_claude.return_value = json.dumps(response)
        card = Card(id="c1", type="article", title="ML Tutorial", content="Learn ML")

        from src.phase2_gold.tagger import tag_card
        result = tag_card(card, sample_taxonomy)
        assert result.card_id == "c1"
        assert "machine-learning" in result.flat_tags
        assert result.confidence == 0.85

    @patch("src.phase2_gold.tagger.call_claude")
    def test_retry_on_validation_failure(self, mock_claude, sample_taxonomy):
        """First response has too many primary tags, second is correct."""
        bad_response = json.dumps({
            "primary": ["ml", "web", "react", "python"],  # too many (max 3)
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
        })
        good_response = json.dumps({
            "primary": ["ml"],
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
            "reasoning": "Fixed",
        })
        mock_claude.side_effect = [bad_response, good_response]

        card = Card(id="c1", type="article", content="Test")
        from src.phase2_gold.tagger import tag_card
        result = tag_card(card, sample_taxonomy)
        assert result.confidence == 0.85  # Succeeded on retry

    @patch("src.phase2_gold.tagger.call_claude")
    def test_fallback_on_all_retries_failed(self, mock_claude, sample_taxonomy):
        """All attempts produce validation errors — returns best-effort."""
        bad_response = json.dumps({
            "primary": [],  # min is 1
            "contextual": ["tutorial"],
            "style": ["dark-mode"],
        })
        mock_claude.return_value = bad_response
        card = Card(id="c1", type="article", content="Test")

        from src.phase2_gold.tagger import tag_card
        result = tag_card(card, sample_taxonomy)
        assert result.confidence == 0.5  # Best-effort fallback
        assert "VALIDATION WARNINGS" in (result.reasoning or "")
