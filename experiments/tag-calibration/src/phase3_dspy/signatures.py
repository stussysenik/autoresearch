"""
DSPy Signatures for tag classification.

Defines the input/output contract that DSPy uses to generate and optimize
prompts for the tag classification task. The docstring on TagClassification
becomes the base instruction — DSPy's optimizers will refine it during
BootstrapFewShot and MIPROv2 compilation.
"""

from __future__ import annotations

import dspy

from src.models import Taxonomy


class TagClassification(dspy.Signature):
    """Classify a saved web resource into structured tags.

    Given a title, content snippet, URL, and source platform, assign tags
    from three categories:

    - primary_tags: 1-3 high-level topic tags that capture what the resource
      is fundamentally about (e.g., "machine-learning", "web-design").
    - contextual_tags: 1-4 tags that describe the format, intent, or
      situational context (e.g., "tutorial", "reference", "opinion-piece").
    - style_tag: Exactly one tag capturing the aesthetic or tonal vibe
      (e.g., "technical", "casual", "visual-heavy").

    All tags must be lowercase, hyphenated (no spaces), and drawn from the
    approved vocabulary when one is provided.
    """

    # -- Inputs --
    title: str = dspy.InputField(desc="Title of the saved resource")
    content: str = dspy.InputField(desc="Truncated text content (up to ~1500 chars)")
    url: str = dspy.InputField(desc="Original URL of the resource", default="")
    platform: str = dspy.InputField(
        desc="Source platform (e.g., twitter, github, article, reddit)", default="unknown"
    )

    # -- Outputs --
    primary_tags: list[str] = dspy.OutputField(
        desc="1-3 high-level topic tags describing what the resource is about"
    )
    contextual_tags: list[str] = dspy.OutputField(
        desc="1-4 tags for format, intent, or situational context"
    )
    style_tag: str = dspy.OutputField(
        desc="Exactly one tag capturing the aesthetic or tonal vibe"
    )


def build_signature(taxonomy: Taxonomy) -> type[TagClassification]:
    """Dynamically update field descriptions with taxonomy vocabulary.

    DSPy reads field metadata at compile time — by injecting the discovered
    taxonomy into the descriptions, the optimizer gets concrete vocabulary
    constraints baked into every prompt variant it tries.

    Args:
        taxonomy: The Taxonomy object discovered in Phase 1, containing
                  category vocabularies, blocked tags, and platform guidelines.

    Returns:
        A new Signature subclass with enriched field descriptions.
    """
    # Build vocabulary strings per category
    primary_cat = taxonomy.get_category("primary")
    contextual_cat = taxonomy.get_category("contextual")
    style_cat = taxonomy.get_category("style")

    primary_vocab = sorted(primary_cat.vocabulary) if primary_cat else []
    contextual_vocab = sorted(contextual_cat.vocabulary) if contextual_cat else []
    style_vocab = sorted(style_cat.vocabulary) if style_cat else []

    primary_min = primary_cat.min_tags if primary_cat else 1
    primary_max = primary_cat.max_tags if primary_cat else 3
    contextual_min = contextual_cat.min_tags if contextual_cat else 1
    contextual_max = contextual_cat.max_tags if contextual_cat else 4

    # Build platform guidance section
    platform_lines = []
    for plat, guidance in taxonomy.platform_guidelines.items():
        platform_lines.append(f"  - {plat}: {guidance}")
    platform_section = "\n".join(platform_lines) if platform_lines else "  (no platform-specific guidance)"

    # Build blocked tags notice
    blocked_notice = ""
    if taxonomy.blocked_tags:
        blocked_sample = ", ".join(sorted(taxonomy.blocked_tags)[:15])
        blocked_notice = f"\n\nNEVER use these blocked tags: {blocked_sample}"

    # Compose enriched docstring
    enriched_doc = f"""Classify a saved web resource into structured tags.

Given a title, content snippet, URL, and source platform, assign tags from
three categories using ONLY the approved vocabulary below.

PRIMARY TAGS ({primary_min}-{primary_max} tags):
  Vocabulary: {', '.join(primary_vocab) if primary_vocab else '(any relevant topic tags)'}

CONTEXTUAL TAGS ({contextual_min}-{contextual_max} tags):
  Vocabulary: {', '.join(contextual_vocab) if contextual_vocab else '(any relevant context tags)'}

STYLE TAG (exactly 1):
  Vocabulary: {', '.join(style_vocab) if style_vocab else '(any relevant style tag)'}

Platform-specific guidance:
{platform_section}{blocked_notice}

All tags must be lowercase and hyphenated (no spaces)."""

    # Create a dynamic subclass with the enriched docstring and updated field descs
    enriched_fields = {}

    primary_desc = f"{primary_min}-{primary_max} high-level topic tags"
    if primary_vocab:
        primary_desc += f". Choose from: {', '.join(primary_vocab[:20])}"
        if len(primary_vocab) > 20:
            primary_desc += f" (and {len(primary_vocab) - 20} more)"

    contextual_desc = f"{contextual_min}-{contextual_max} format/intent/context tags"
    if contextual_vocab:
        contextual_desc += f". Choose from: {', '.join(contextual_vocab[:20])}"
        if len(contextual_vocab) > 20:
            contextual_desc += f" (and {len(contextual_vocab) - 20} more)"

    style_desc = "Exactly one aesthetic/tonal vibe tag"
    if style_vocab:
        style_desc += f". Choose from: {', '.join(style_vocab)}"

    # Build new signature class dynamically
    CalibratedTagClassification = type(
        "CalibratedTagClassification",
        (dspy.Signature,),
        {
            "__doc__": enriched_doc,
            "__annotations__": {
                "title": str,
                "content": str,
                "url": str,
                "platform": str,
                "primary_tags": list[str],
                "contextual_tags": list[str],
                "style_tag": str,
            },
            "title": dspy.InputField(desc="Title of the saved resource"),
            "content": dspy.InputField(desc="Truncated text content (up to ~1500 chars)"),
            "url": dspy.InputField(desc="Original URL of the resource", default=""),
            "platform": dspy.InputField(
                desc="Source platform (e.g., twitter, github, article, reddit)",
                default="unknown",
            ),
            "primary_tags": dspy.OutputField(desc=primary_desc),
            "contextual_tags": dspy.OutputField(desc=contextual_desc),
            "style_tag": dspy.OutputField(desc=style_desc),
        },
    )

    return CalibratedTagClassification
