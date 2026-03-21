"""
Tests for Phase 3: DSPy Calibration.

Covers metric functions, signature building, and module output shapes.
No live API calls — uses mock objects for DSPy predictions/examples.
"""

from types import SimpleNamespace

import pytest

from src.models import Taxonomy, TaxonomyCategory
from src.phase3_dspy.metrics import (
    blocked_tag_check,
    format_check,
    make_composite_metric,
    tag_f1,
    taxonomy_adherence,
)
from src.phase3_dspy.signatures import build_signature


# ---------------------------------------------------------------------------
# Helpers: mock DSPy Example/Prediction as SimpleNamespace
# ---------------------------------------------------------------------------

def make_example(flat_tags=None, primary_tags=None, contextual_tags=None, style_tag=None):
    """Create a mock DSPy Example."""
    return SimpleNamespace(
        flat_tags=flat_tags or [],
        primary_tags=primary_tags or [],
        contextual_tags=contextual_tags or [],
        style_tag=style_tag or "",
    )


def make_prediction(primary_tags=None, contextual_tags=None, style_tag=None):
    """Create a mock DSPy Prediction."""
    return SimpleNamespace(
        primary_tags=primary_tags or [],
        contextual_tags=contextual_tags or [],
        style_tag=style_tag or "",
    )


# ---------------------------------------------------------------------------
# tag_f1
# ---------------------------------------------------------------------------

class TestTagF1:
    def test_perfect_match(self):
        example = make_example(flat_tags=["ml", "tutorial", "raw"])
        prediction = make_prediction(primary_tags=["ml"], contextual_tags=["tutorial"], style_tag="raw")
        score = tag_f1(example, prediction)
        assert score == 1.0

    def test_no_overlap(self):
        example = make_example(flat_tags=["ml", "tutorial"])
        prediction = make_prediction(primary_tags=["web-design"], contextual_tags=["showcase"])
        score = tag_f1(example, prediction)
        assert score == 0.0

    def test_partial_overlap(self):
        example = make_example(flat_tags=["ml", "tutorial", "raw"])
        prediction = make_prediction(primary_tags=["ml"], contextual_tags=["showcase"], style_tag="raw")
        score = tag_f1(example, prediction)
        # tp=2 (ml, raw), pred=3, gold=3
        # precision=2/3, recall=2/3, F1=2/3
        assert abs(score - 2 / 3) < 0.01

    def test_both_empty(self):
        example = make_example(flat_tags=[])
        prediction = make_prediction()
        score = tag_f1(example, prediction)
        assert score == 1.0

    def test_gold_empty_pred_nonempty(self):
        example = make_example(flat_tags=[])
        prediction = make_prediction(primary_tags=["ml"])
        score = tag_f1(example, prediction)
        assert score == 0.0

    def test_bootstrapping_mode(self):
        example = make_example(flat_tags=["ml", "tutorial"])
        prediction = make_prediction(primary_tags=["ml"], contextual_tags=["tutorial"])
        # With trace (bootstrapping), should return bool
        result = tag_f1(example, prediction, trace="some_trace")
        assert isinstance(result, bool)
        assert result is True  # F1=1.0 >= 0.5

    def test_bootstrapping_rejects_low_score(self):
        example = make_example(flat_tags=["ml", "tutorial", "raw"])
        prediction = make_prediction(primary_tags=["web-design"])
        result = tag_f1(example, prediction, trace="some_trace")
        assert result is False


# ---------------------------------------------------------------------------
# taxonomy_adherence
# ---------------------------------------------------------------------------

class TestTaxonomyAdherence:
    def test_fully_compliant(self, sample_taxonomy):
        example = make_example()
        prediction = make_prediction(
            primary_tags=["machine-learning"],
            contextual_tags=["tutorial"],
            style_tag="dark-mode",
        )
        score = taxonomy_adherence(example, prediction, sample_taxonomy)
        assert score > 0.8

    def test_blocked_tag_penalized(self, sample_taxonomy):
        example = make_example()
        prediction = make_prediction(
            primary_tags=["website"],  # blocked
            contextual_tags=["tutorial"],
            style_tag="dark-mode",
        )
        score = taxonomy_adherence(example, prediction, sample_taxonomy)
        # Should be lower due to blocked tag
        compliant_prediction = make_prediction(
            primary_tags=["machine-learning"],
            contextual_tags=["tutorial"],
            style_tag="dark-mode",
        )
        compliant_score = taxonomy_adherence(example, compliant_prediction, sample_taxonomy)
        assert score < compliant_score

    def test_out_of_vocab_penalized(self, sample_taxonomy):
        example = make_example()
        prediction = make_prediction(
            primary_tags=["completely-made-up-tag"],
            contextual_tags=["another-fake-tag"],
            style_tag="fake-style",
        )
        score = taxonomy_adherence(example, prediction, sample_taxonomy)
        # Vocab compliance should be 0 — overall score should be low
        assert score < 0.7


# ---------------------------------------------------------------------------
# composite metric
# ---------------------------------------------------------------------------

class TestCompositeMetric:
    def test_perfect_prediction(self, sample_taxonomy):
        metric = make_composite_metric(sample_taxonomy)
        example = make_example(
            flat_tags=["machine-learning", "tutorial", "dark-mode"],
        )
        prediction = make_prediction(
            primary_tags=["machine-learning"],
            contextual_tags=["tutorial"],
            style_tag="dark-mode",
        )
        score = metric(example, prediction)
        assert isinstance(score, float)
        assert score > 0.8

    def test_zero_score(self, sample_taxonomy):
        metric = make_composite_metric(sample_taxonomy)
        example = make_example(flat_tags=["ml", "tutorial", "raw"])
        prediction = make_prediction()  # All empty
        score = metric(example, prediction)
        assert score < 0.3

    def test_bootstrapping_returns_bool(self, sample_taxonomy):
        metric = make_composite_metric(sample_taxonomy)
        example = make_example(flat_tags=["machine-learning"])
        prediction = make_prediction(primary_tags=["machine-learning"], style_tag="dark-mode")
        result = metric(example, prediction, trace="some_trace")
        assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# blocked_tag_check
# ---------------------------------------------------------------------------

class TestBlockedTagCheck:
    def test_no_blocked_tags(self):
        score = blocked_tag_check(["ml", "tutorial"], {"website", "link"})
        assert score == 1.0

    def test_all_blocked(self):
        score = blocked_tag_check(["website", "link"], {"website", "link"})
        assert score == 0.0

    def test_some_blocked(self):
        score = blocked_tag_check(["ml", "website"], {"website"})
        assert score == 0.5

    def test_empty_tags(self):
        score = blocked_tag_check([], {"website"})
        assert score == 1.0


# ---------------------------------------------------------------------------
# format_check
# ---------------------------------------------------------------------------

class TestFormatCheck:
    def test_all_valid(self):
        score = format_check(["machine-learning", "web-design", "tutorial"])
        assert score == 1.0

    def test_spaces_invalid(self):
        score = format_check(["machine learning", "web-design"])
        assert score == 0.5

    def test_uppercase_invalid(self):
        score = format_check(["Machine-Learning", "tutorial"])
        assert score == 0.5

    def test_empty_list(self):
        score = format_check([])
        assert score == 1.0

    def test_single_word_valid(self):
        score = format_check(["tutorial"])
        assert score == 1.0

    def test_numbers_valid(self):
        score = format_check(["web3", "css-grid-2"])
        assert score == 1.0


# ---------------------------------------------------------------------------
# build_signature
# ---------------------------------------------------------------------------

class TestBuildSignature:
    def test_returns_signature_class(self, sample_taxonomy):
        sig = build_signature(sample_taxonomy)
        assert sig is not None
        # Should have the expected fields in annotations
        annotations = getattr(sig, "__annotations__", {})
        assert "title" in annotations
        assert "primary_tags" in annotations
        assert "style_tag" in annotations

    def test_enriched_docstring(self, sample_taxonomy):
        sig = build_signature(sample_taxonomy)
        doc = sig.__doc__ or ""
        # Should include vocabulary from taxonomy
        assert "machine-learning" in doc or "PRIMARY TAGS" in doc

    def test_handles_missing_categories(self):
        """If taxonomy has no 'primary' category, should still work."""
        taxonomy = Taxonomy(
            categories=[
                TaxonomyCategory(name="custom", description="Custom tags", vocabulary=["a", "b"]),
            ]
        )
        sig = build_signature(taxonomy)
        assert sig is not None
