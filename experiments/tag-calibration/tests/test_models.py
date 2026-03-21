"""
Tests for Pydantic models: Card, Taxonomy, GoldTag, ValidationMetrics.
"""

import pytest
from src.models import Card, GoldTag, Taxonomy, TaxonomyCategory, ValidationMetrics


class TestCard:
    def test_basic_construction(self):
        card = Card(id="c1", type="article", title="Test")
        assert card.id == "c1"
        assert card.type == "article"
        assert card.tags == []
        assert card.metadata == {}

    def test_platform_from_metadata(self):
        card = Card(id="c1", metadata={"platform": "twitter"})
        assert card.platform == "twitter"

    def test_platform_default_unknown(self):
        card = Card(id="c1")
        assert card.platform == "unknown"

    def test_content_preview_short(self):
        card = Card(id="c1", content="Short text")
        assert card.content_preview() == "Short text"

    def test_content_preview_truncates(self):
        long_text = "a" * 2000
        card = Card(id="c1", content=long_text)
        preview = card.content_preview(max_len=100)
        assert len(preview) == 103  # 100 + "..."
        assert preview.endswith("...")

    def test_content_preview_none(self):
        card = Card(id="c1", content=None)
        assert card.content_preview() == ""

    def test_nullable_fields(self):
        card = Card(id="c1")
        assert card.title is None
        assert card.content is None
        assert card.url is None
        assert card.image_url is None

    def test_model_validate_from_dict(self):
        data = {
            "id": "c1",
            "type": "video",
            "title": "Test Video",
            "tags": ["music", "jazz"],
            "metadata": {"platform": "youtube"},
        }
        card = Card.model_validate(data)
        assert card.type == "video"
        assert card.tags == ["music", "jazz"]
        assert card.platform == "youtube"


class TestTaxonomyCategory:
    def test_basic(self):
        cat = TaxonomyCategory(
            name="primary",
            description="Core topics",
            vocabulary=["ml", "web-design"],
            min_tags=1,
            max_tags=3,
        )
        assert cat.name == "primary"
        assert len(cat.vocabulary) == 2

    def test_defaults(self):
        cat = TaxonomyCategory(name="test", description="test")
        assert cat.min_tags == 1
        assert cat.max_tags == 2
        assert cat.vocabulary == []
        assert cat.rules == []


class TestTaxonomy:
    def test_get_category(self, sample_taxonomy):
        primary = sample_taxonomy.get_category("primary")
        assert primary is not None
        assert primary.name == "primary"

    def test_get_category_missing(self, sample_taxonomy):
        assert sample_taxonomy.get_category("nonexistent") is None

    def test_all_vocabulary(self, sample_taxonomy):
        vocab = sample_taxonomy.all_vocabulary()
        assert "machine-learning" in vocab
        assert "tutorial" in vocab
        assert "dark-mode" in vocab

    def test_blocked_set(self, sample_taxonomy):
        blocked = sample_taxonomy.blocked_set()
        assert "website" in blocked
        assert "twitter" in blocked
        assert "machine-learning" not in blocked

    def test_taxonomy_from_fixture(self, sample_taxonomy):
        assert sample_taxonomy.version == "1.0"
        assert len(sample_taxonomy.categories) == 3
        assert len(sample_taxonomy.blocked_tags) > 0
        assert "twitter" in sample_taxonomy.platform_guidelines


class TestGoldTag:
    def test_from_categorized(self):
        gold = GoldTag.from_categorized(
            card_id="c1",
            categorized_tags={"primary": ["ml"], "contextual": ["tutorial"], "style": ["raw"]},
            reasoning="Test",
        )
        assert gold.card_id == "c1"
        assert gold.flat_tags == ["ml", "tutorial", "raw"]
        assert gold.tags["primary"] == ["ml"]
        assert gold.confidence == 0.85

    def test_from_categorized_custom_confidence(self):
        gold = GoldTag.from_categorized(
            card_id="c1",
            categorized_tags={"primary": ["ml"]},
            confidence=0.5,
        )
        assert gold.confidence == 0.5

    def test_flat_tags_flattens_all_categories(self):
        gold = GoldTag.from_categorized(
            card_id="c1",
            categorized_tags={"a": ["t1", "t2"], "b": ["t3"]},
        )
        assert set(gold.flat_tags) == {"t1", "t2", "t3"}

    def test_model_validate(self):
        data = {
            "card_id": "c1",
            "tags": {"primary": ["ml"]},
            "flat_tags": ["ml"],
            "reasoning": "test",
            "confidence": 0.9,
        }
        gold = GoldTag.model_validate(data)
        assert gold.card_id == "c1"


class TestValidationMetrics:
    def test_defaults(self):
        m = ValidationMetrics()
        assert m.total_cards == 0
        assert m.micro_f1 == 0.0

    def test_with_values(self):
        m = ValidationMetrics(total_cards=100, micro_f1=0.75, style_coverage=0.95)
        assert m.total_cards == 100
        assert m.micro_f1 == 0.75
