"""
Tests for Phase 4: Validation.

Covers MetricsAccumulator correctness and report generation.
"""

import json
from pathlib import Path

import pytest

from src.models import GoldTag, Taxonomy, TaxonomyCategory, ValidationMetrics
from src.phase4_validation.evaluate import MetricsAccumulator


@pytest.fixture
def simple_taxonomy():
    """Minimal taxonomy for testing metrics."""
    return Taxonomy(
        categories=[
            TaxonomyCategory(
                name="primary",
                description="Topics",
                vocabulary=["ml", "web", "react", "python"],
                min_tags=1,
                max_tags=3,
            ),
            TaxonomyCategory(
                name="contextual",
                description="Format",
                vocabulary=["tutorial", "reference", "deep-dive"],
                min_tags=1,
                max_tags=2,
            ),
            TaxonomyCategory(
                name="style",
                description="Vibe",
                vocabulary=["raw", "editorial", "dark-mode", "minimalist"],
                min_tags=1,
                max_tags=1,
            ),
        ],
        blocked_tags=["website", "link", "page"],
    )


@pytest.fixture
def accumulator(simple_taxonomy):
    return MetricsAccumulator(simple_taxonomy)


class TestMetricsAccumulator:
    def test_perfect_predictions(self, accumulator):
        gold = GoldTag.from_categorized(
            "c1",
            {"primary": ["ml"], "contextual": ["tutorial"], "style": ["raw"]},
        )
        accumulator.add(
            prediction=["ml", "tutorial", "raw"],
            gold=gold,
            platform="twitter",
            card_id="c1",
        )
        assert accumulator.micro_f1() == 1.0
        assert accumulator.macro_f1() == 1.0
        assert accumulator.exact_match_rate() == 1.0

    def test_no_overlap(self, accumulator):
        gold = GoldTag.from_categorized(
            "c1",
            {"primary": ["ml"], "contextual": ["tutorial"], "style": ["raw"]},
        )
        accumulator.add(
            prediction=["web", "reference", "editorial"],
            gold=gold,
            platform="github",
            card_id="c1",
        )
        assert accumulator.micro_f1() == 0.0
        assert accumulator.macro_f1() == 0.0

    def test_partial_overlap(self, accumulator):
        gold = GoldTag.from_categorized(
            "c1",
            {"primary": ["ml"], "contextual": ["tutorial"], "style": ["raw"]},
        )
        accumulator.add(
            prediction=["ml", "reference", "raw"],
            gold=gold,
            platform="twitter",
            card_id="c1",
        )
        # tp=2 (ml, raw), pred=3, gold=3 => F1 = 2/3
        assert abs(accumulator.macro_f1() - 2 / 3) < 0.01

    def test_multiple_cards(self, accumulator):
        gold1 = GoldTag.from_categorized("c1", {"primary": ["ml"], "style": ["raw"]})
        gold2 = GoldTag.from_categorized("c2", {"primary": ["web"], "style": ["editorial"]})

        accumulator.add(["ml", "raw"], gold1, "twitter", "c1")  # perfect
        accumulator.add(["python", "dark-mode"], gold2, "github", "c2")  # no overlap

        # macro F1 = (1.0 + 0.0) / 2 = 0.5
        assert abs(accumulator.macro_f1() - 0.5) < 0.01

    def test_style_coverage(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"], "style": ["raw"]})
        accumulator.add(["ml", "raw"], gold, "twitter", "c1")
        assert accumulator.style_coverage() == 1.0

    def test_style_coverage_missing(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"], "style": ["raw"]})
        accumulator.add(["ml", "tutorial"], gold, "twitter", "c1")  # no style tag
        assert accumulator.style_coverage() == 0.0

    def test_blocked_tag_rate(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"]})
        accumulator.add(["ml", "website"], gold, "twitter", "c1")  # "website" is blocked
        assert accumulator.blocked_tag_rate() == 1.0  # 1 of 1 cards has blocked tag

    def test_blocked_tag_rate_clean(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"]})
        accumulator.add(["ml", "tutorial"], gold, "twitter", "c1")
        assert accumulator.blocked_tag_rate() == 0.0

    def test_per_platform_scores(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"]})
        accumulator.add(["ml"], gold, "twitter", "c1")
        accumulator.add(["ml"], gold, "github", "c2")

        per_platform = accumulator.per_platform_scores()
        assert "twitter" in per_platform
        assert "github" in per_platform

    def test_worst_n(self, accumulator):
        for i in range(5):
            gold = GoldTag.from_categorized(f"c{i}", {"primary": ["ml"]})
            pred = ["ml"] if i > 0 else ["web"]  # c0 gets F1=0
            accumulator.add(pred, gold, "twitter", f"c{i}")

        worst = accumulator.worst_n(2)
        assert len(worst) == 2
        assert worst[0]["card_id"] == "c0"
        assert worst[0]["f1"] == 0.0

    def test_best_n(self, accumulator):
        gold = GoldTag.from_categorized("c0", {"primary": ["ml"]})
        accumulator.add(["ml"], gold, "twitter", "c0")  # perfect
        gold2 = GoldTag.from_categorized("c1", {"primary": ["ml"]})
        accumulator.add(["web"], gold2, "github", "c1")  # no match

        best = accumulator.best_n(1)
        assert len(best) == 1
        assert best[0]["card_id"] == "c0"

    def test_to_validation_metrics(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"], "style": ["raw"]})
        accumulator.add(["ml", "raw"], gold, "twitter", "c1")

        metrics = accumulator.to_validation_metrics()
        assert isinstance(metrics, ValidationMetrics)
        assert metrics.total_cards == 1
        assert metrics.micro_f1 == 1.0

    def test_empty_accumulator(self, accumulator):
        assert accumulator.micro_f1() == 1.0  # No predictions, no gold
        assert accumulator.macro_f1() == 0.0
        assert accumulator.style_coverage() == 0.0
        assert accumulator.blocked_tag_rate() == 0.0

    def test_taxonomy_adherence(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"]})
        accumulator.add(["ml", "tutorial", "raw"], gold, "twitter", "c1")
        # All tags are in vocabulary
        assert accumulator.mean_adherence() == 1.0

    def test_taxonomy_adherence_out_of_vocab(self, accumulator):
        gold = GoldTag.from_categorized("c1", {"primary": ["ml"]})
        accumulator.add(["made-up-tag", "another-fake"], gold, "twitter", "c1")
        # No tags in vocabulary
        assert accumulator.mean_adherence() == 0.0
