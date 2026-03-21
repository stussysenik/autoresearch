"""
Custom DSPy metrics for tag classification evaluation.

Provides composable metric functions that DSPy's optimizers use during
bootstrapping and evaluation. Metrics must follow DSPy's contract:

  - Signature: metric(example, prediction, trace=None)
  - When trace is not None (during bootstrapping): return bool
  - When trace is None (during evaluation): return float

The factory pattern (make_*) lets us bind the taxonomy at metric creation
time while keeping the function signature DSPy expects.
"""

from __future__ import annotations

import re
from collections import Counter

from src.models import Taxonomy


# ---------------------------------------------------------------------------
# 1. Tag F1 — Micro F1 of flat (all-category) tags against gold
# ---------------------------------------------------------------------------

def tag_f1(example, prediction, trace=None) -> float | bool:
    """Compute micro-F1 between predicted and gold flat tags.

    Collects all tags across categories into flat sets, then computes
    precision, recall, and F1. This is the primary quality signal.

    During bootstrapping (trace is not None), returns True if F1 >= 0.5
    so the optimizer has a lenient filter for candidate demonstrations.
    """
    gold_tags = _extract_gold_flat(example)
    pred_tags = _extract_pred_flat(prediction)

    if not gold_tags and not pred_tags:
        score = 1.0
    elif not gold_tags or not pred_tags:
        score = 0.0
    else:
        gold_set = set(gold_tags)
        pred_set = set(pred_tags)
        tp = len(gold_set & pred_set)
        precision = tp / len(pred_set) if pred_set else 0.0
        recall = tp / len(gold_set) if gold_set else 0.0
        score = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    if trace is not None:
        return score >= 0.5
    return score


# ---------------------------------------------------------------------------
# 2. Taxonomy Adherence — Vocabulary + count constraints
# ---------------------------------------------------------------------------

def taxonomy_adherence(example, prediction, taxonomy: Taxonomy, trace=None) -> float | bool:
    """Check that predictions respect taxonomy constraints.

    Scores three aspects equally:
      - Vocabulary compliance: fraction of predicted tags in the approved vocab
      - Count compliance: whether each category has the right number of tags
      - Blocked tag avoidance: fraction of predicted tags NOT in the blocked set

    Args:
        example: DSPy Example (unused but required by contract).
        prediction: DSPy Prediction with primary_tags, contextual_tags, style_tag.
        taxonomy: The Phase 1 taxonomy defining vocabulary and constraints.
        trace: DSPy trace (not None during bootstrapping).

    Returns:
        float in [0, 1] or bool during bootstrapping.
    """
    all_vocab = taxonomy.all_vocabulary()
    blocked = taxonomy.blocked_set()

    # -- Vocabulary compliance --
    pred_flat = _extract_pred_flat(prediction)
    if pred_flat:
        vocab_score = sum(1 for t in pred_flat if t in all_vocab) / len(pred_flat)
    else:
        vocab_score = 0.0

    # -- Count compliance --
    count_checks = []
    for cat_name, pred_tags in _extract_pred_by_category(prediction).items():
        cat = taxonomy.get_category(cat_name)
        if cat is not None:
            n = len(pred_tags)
            if cat.min_tags <= n <= cat.max_tags:
                count_checks.append(1.0)
            else:
                # Partial credit: how far off are we?
                if n < cat.min_tags:
                    count_checks.append(n / cat.min_tags if cat.min_tags > 0 else 0.0)
                else:  # n > cat.max_tags
                    count_checks.append(cat.max_tags / n if n > 0 else 0.0)
        else:
            count_checks.append(1.0)  # No constraint defined for this category
    count_score = sum(count_checks) / len(count_checks) if count_checks else 1.0

    # -- Blocked tag avoidance --
    blocked_score = blocked_tag_check(pred_flat, blocked)

    # Equal weight across the three aspects
    score = (vocab_score + count_score + blocked_score) / 3.0

    if trace is not None:
        return score >= 0.7
    return score


# ---------------------------------------------------------------------------
# 3. Composite Metric (factory) — 60% F1 + 25% adherence + 15% style
# ---------------------------------------------------------------------------

def make_composite_metric(taxonomy: Taxonomy):
    """Create a composite metric function with the taxonomy bound.

    Weights:
      - 60% tag_f1: Are the right tags predicted?
      - 25% taxonomy_adherence: Do predictions follow the rules?
      - 15% style_coverage + format_check: Style tag present and well-formed?

    During bootstrapping (trace is not None): returns bool (threshold >= 0.7).
    During evaluation (trace is None): returns float in [0, 1].

    Args:
        taxonomy: The Phase 1 taxonomy for vocabulary/constraint checking.

    Returns:
        A metric function with signature (example, prediction, trace) -> float | bool.
    """

    def composite_metric(example, prediction, trace=None) -> float | bool:
        # -- F1 component (60%) --
        f1_score = tag_f1(example, prediction, trace=None)  # Always get float

        # -- Adherence component (25%) --
        adhere_score = taxonomy_adherence(example, prediction, taxonomy, trace=None)

        # -- Style + format component (15%) --
        style = getattr(prediction, "style_tag", "")
        if isinstance(style, list):
            style = style[0] if style else ""
        style_present = 1.0 if style and style.strip() else 0.0

        all_pred_tags = _extract_pred_flat(prediction)
        fmt_score = format_check(all_pred_tags) if all_pred_tags else 0.0

        style_fmt_score = (style_present * 0.6 + fmt_score * 0.4)

        # -- Weighted composite --
        score = 0.60 * f1_score + 0.25 * adhere_score + 0.15 * style_fmt_score

        if trace is not None:
            return score >= 0.7
        return score

    return composite_metric


# ---------------------------------------------------------------------------
# 4. Blocked Tag Check
# ---------------------------------------------------------------------------

def blocked_tag_check(tags: list[str], blocked_set: set[str]) -> float:
    """Return the fraction of tags that are NOT in the blocked set.

    Args:
        tags: List of predicted tags.
        blocked_set: Set of tags that should never appear.

    Returns:
        Float in [0, 1]. 1.0 means no blocked tags were used.
    """
    if not tags:
        return 1.0
    clean_count = sum(1 for t in tags if t not in blocked_set)
    return clean_count / len(tags)


# ---------------------------------------------------------------------------
# 5. Format Check
# ---------------------------------------------------------------------------

def format_check(tags: list[str]) -> float:
    """Check that all tags are lowercase, hyphenated, with no spaces.

    Valid tag format: lowercase letters, digits, and hyphens only.
    Examples: "machine-learning", "web-design", "tutorial", "api-reference"

    Args:
        tags: List of predicted tags.

    Returns:
        Float in [0, 1]. Fraction of tags with valid formatting.
    """
    if not tags:
        return 1.0

    valid_pattern = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
    valid_count = sum(1 for t in tags if valid_pattern.match(t.strip()))
    return valid_count / len(tags)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _extract_gold_flat(example) -> list[str]:
    """Extract flat gold tags from a DSPy Example.

    Tries multiple attribute names to handle different Example formats:
    - example.flat_tags (from GoldTag model)
    - example.gold_tags (common convention)
    - example.tags (fallback)
    """
    for attr in ("flat_tags", "gold_tags", "tags"):
        val = getattr(example, attr, None)
        if val is not None:
            if isinstance(val, list):
                return [str(t) for t in val]
            if isinstance(val, str):
                return [t.strip() for t in val.split(",") if t.strip()]
    return []


def _extract_pred_flat(prediction) -> list[str]:
    """Collect all predicted tags into a flat list."""
    tags = []
    primary = getattr(prediction, "primary_tags", [])
    contextual = getattr(prediction, "contextual_tags", [])
    style = getattr(prediction, "style_tag", "")

    if isinstance(primary, list):
        tags.extend(str(t) for t in primary)
    elif isinstance(primary, str) and primary:
        tags.append(primary)

    if isinstance(contextual, list):
        tags.extend(str(t) for t in contextual)
    elif isinstance(contextual, str) and contextual:
        tags.append(contextual)

    if isinstance(style, list):
        tags.extend(str(t) for t in style if t)
    elif isinstance(style, str) and style.strip():
        tags.append(style.strip())

    return tags


def _extract_pred_by_category(prediction) -> dict[str, list[str]]:
    """Extract predicted tags organized by category name."""
    result = {}

    primary = getattr(prediction, "primary_tags", [])
    if isinstance(primary, list):
        result["primary"] = [str(t) for t in primary]
    elif isinstance(primary, str):
        result["primary"] = [primary] if primary else []

    contextual = getattr(prediction, "contextual_tags", [])
    if isinstance(contextual, list):
        result["contextual"] = [str(t) for t in contextual]
    elif isinstance(contextual, str):
        result["contextual"] = [contextual] if contextual else []

    style = getattr(prediction, "style_tag", "")
    if isinstance(style, list):
        result["style"] = [str(t) for t in style if t]
    elif isinstance(style, str):
        result["style"] = [style.strip()] if style.strip() else []

    return result
