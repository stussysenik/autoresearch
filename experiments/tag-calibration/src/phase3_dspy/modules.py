"""
DSPy Module for tag classification.

Wraps the TagClassification signature with ChainOfThought so the model
reasons step-by-step before emitting tags. This intermediate reasoning
trace is what DSPy's BootstrapFewShot optimizes — it selects the best
teacher-generated rationales as few-shot demonstrations.
"""

from __future__ import annotations

import dspy

from src.models import Taxonomy
from .signatures import TagClassification, build_signature


class TagClassifier(dspy.Module):
    """Classify a saved resource into primary, contextual, and style tags.

    Uses ChainOfThought to encourage step-by-step reasoning before tag
    selection. The taxonomy vocabulary is baked into the signature at
    construction time via `build_signature`.

    Args:
        taxonomy: The discovered taxonomy from Phase 1. If None, uses the
                  base TagClassification signature without vocabulary constraints.
    """

    def __init__(self, taxonomy: Taxonomy | None = None):
        super().__init__()
        if taxonomy is not None:
            signature = build_signature(taxonomy)
        else:
            signature = TagClassification
        self.classify = dspy.ChainOfThought(signature)

    def forward(
        self,
        title: str,
        content: str,
        url: str = "",
        platform: str = "unknown",
    ) -> dspy.Prediction:
        """Run tag classification on a single resource.

        Content is truncated to 1500 characters to stay within context
        limits for smaller student models (Gemma 3 12B). Empty fields
        are normalized to empty strings to avoid None-handling issues
        in DSPy's prompt assembly.

        Args:
            title: Resource title.
            content: Full text content (will be truncated).
            url: Original URL.
            platform: Source platform identifier.

        Returns:
            dspy.Prediction with primary_tags, contextual_tags, style_tag.
        """
        # Truncate content for student model context windows
        truncated = content[:1500] if content else ""

        result = self.classify(
            title=title or "",
            content=truncated,
            url=url or "",
            platform=platform or "unknown",
        )

        # Normalize outputs — DSPy may return slightly different types
        # depending on the adapter, so we ensure consistent shapes
        primary = _ensure_list(result.primary_tags)
        contextual = _ensure_list(result.contextual_tags)
        style = _ensure_str(result.style_tag)

        return dspy.Prediction(
            primary_tags=primary,
            contextual_tags=contextual,
            style_tag=style,
        )


def _ensure_list(value) -> list[str]:
    """Coerce a value to list[str], handling common DSPy output quirks.

    DSPy adapters sometimes return a string representation of a list,
    a single string, or an actual list. This normalizes all cases.
    """
    if isinstance(value, list):
        return [str(v).strip() for v in value if v]
    if isinstance(value, str):
        # Handle string that looks like a Python list: "['tag-a', 'tag-b']"
        cleaned = value.strip().strip("[]")
        if cleaned:
            return [t.strip().strip("'\"") for t in cleaned.split(",") if t.strip()]
        return []
    return []


def _ensure_str(value) -> str:
    """Coerce a value to a single string tag."""
    if isinstance(value, list):
        return str(value[0]).strip() if value else ""
    return str(value).strip() if value else ""
