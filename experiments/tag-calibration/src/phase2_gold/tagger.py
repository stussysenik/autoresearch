"""
Phase 2 — Gold Tagging.

Batch re-tags ALL cards using GLM 4.7 and the discovered taxonomy from
Phase 1. Each card is tagged with per-category labels that respect the
taxonomy vocabulary, tag-count constraints, and blocked-tag list.

Results are saved to ``data/gold_tags.json`` with periodic checkpointing
so runs are resumable.

Usage::

    python -m src.phase2_gold.tagger
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from tqdm import tqdm

from src.config import DATA_DIR, GLM_RPM
from src.models import Card, GoldTag, Taxonomy, TaxonomyCategory
from src.phase2_gold.checkpoint import load_checkpoint, save_checkpoint
from src.utils.claude_client import call_claude
from src.utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CHECKPOINT_PATH = DATA_DIR / "gold_checkpoint.json"
OUTPUT_PATH = DATA_DIR / "gold_tags.json"
CHECKPOINT_INTERVAL = 50  # save every N cards
MAX_RETRIES = 2

# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def _build_taxonomy_block(taxonomy: Taxonomy) -> str:
    """Render the full taxonomy as a structured text block for the system prompt."""
    lines: list[str] = []
    lines.append("# Tagging Taxonomy\n")
    if taxonomy.description:
        lines.append(f"{taxonomy.description}\n")

    lines.append("## Categories\n")
    for cat in taxonomy.categories:
        lines.append(f"### {cat.name}")
        lines.append(f"Description: {cat.description}")
        lines.append(f"Min tags: {cat.min_tags} | Max tags: {cat.max_tags}")
        if cat.vocabulary:
            lines.append(f"Preferred vocabulary: {', '.join(cat.vocabulary)}")
        if cat.rules:
            lines.append("Rules:")
            for rule in cat.rules:
                lines.append(f"  - {rule}")
        lines.append("")

    if taxonomy.blocked_tags:
        lines.append("## Blocked Tags (NEVER use these)")
        lines.append(", ".join(taxonomy.blocked_tags))
        lines.append("")

    if taxonomy.platform_guidelines:
        lines.append("## Platform-Specific Guidelines")
        for platform, guideline in taxonomy.platform_guidelines.items():
            lines.append(f"- **{platform}**: {guideline}")
        lines.append("")

    return "\n".join(lines)


def _build_system_prompt(taxonomy: Taxonomy) -> str:
    """Build the system prompt that embeds the full taxonomy."""
    taxonomy_block = _build_taxonomy_block(taxonomy)

    return f"""\
You are an expert content tagger. Your job is to assign precise, taxonomy-
compliant tags to a card (a bookmarked article, image, or note).

{taxonomy_block}

## Instructions

1. Read the card's title, content preview, URL, and type carefully.
2. For EACH category defined in the taxonomy, assign an appropriate list of
   tags that respect the min/max constraints.
3. Prefer vocabulary terms when they fit. You MAY introduce a new term only
   if no existing vocabulary word adequately describes the content — and you
   must justify it in your reasoning.
4. NEVER use any tag from the blocked list.
5. Include a short "reasoning" field explaining your tag choices.

## Output Format

Return a single JSON object with one key per taxonomy category (using the
exact category name), plus a "reasoning" key. Example:

{{
  "primary": ["machine-learning", "nlp"],
  "contextual": ["research-paper"],
  "style": ["technical"],
  "reasoning": "The article discusses transformer architectures for NLP tasks..."
}}

Return ONLY valid JSON. No markdown fences, no extra text."""


def _build_user_prompt(card: Card) -> str:
    """Build the per-card user prompt."""
    parts: list[str] = []
    parts.append(f"Card ID: {card.id}")
    parts.append(f"Type: {card.type}")
    if card.title:
        parts.append(f"Title: {card.title}")
    if card.url:
        parts.append(f"URL: {card.url}")
    if card.platform != "unknown":
        parts.append(f"Platform: {card.platform}")
    parts.append(f"\nContent:\n{card.content_preview()}")
    if card.tags:
        parts.append(f"\nExisting tags (for reference only, may be inaccurate): {', '.join(card.tags)}")
    return "\n".join(parts)


def _build_retry_prompt(card: Card, taxonomy: Taxonomy, errors: list[str]) -> str:
    """Build a stricter user prompt after validation failure."""
    base = _build_user_prompt(card)
    error_block = "\n".join(f"  - {e}" for e in errors)
    return f"""{base}

IMPORTANT — Your previous response had validation errors:
{error_block}

Please fix these issues. Follow the taxonomy constraints EXACTLY:
{_format_constraints(taxonomy)}

Return ONLY valid JSON."""


def _format_constraints(taxonomy: Taxonomy) -> str:
    """Summarise constraints compactly for the retry prompt."""
    lines: list[str] = []
    for cat in taxonomy.categories:
        lines.append(f"  - {cat.name}: {cat.min_tags}–{cat.max_tags} tags"
                     + (f" from [{', '.join(cat.vocabulary[:10])}...]"
                        if cat.vocabulary else ""))
    if taxonomy.blocked_tags:
        lines.append(f"  - Blocked: {', '.join(taxonomy.blocked_tags)}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_tags(
    categorized: dict[str, list[str]],
    taxonomy: Taxonomy,
) -> list[str]:
    """Validate tags against taxonomy rules. Returns list of error strings."""
    errors: list[str] = []
    blocked = taxonomy.blocked_set()

    for cat in taxonomy.categories:
        tags = categorized.get(cat.name, [])

        # Check count constraints
        if len(tags) < cat.min_tags:
            errors.append(
                f"Category '{cat.name}': got {len(tags)} tags, minimum is {cat.min_tags}"
            )
        if len(tags) > cat.max_tags:
            errors.append(
                f"Category '{cat.name}': got {len(tags)} tags, maximum is {cat.max_tags}"
            )

        # Check blocked tags
        for tag in tags:
            if tag.lower() in {b.lower() for b in blocked}:
                errors.append(f"Tag '{tag}' is in the blocked list")

    return errors


# ---------------------------------------------------------------------------
# Core tagging
# ---------------------------------------------------------------------------

def tag_card(
    card: Card,
    taxonomy: Taxonomy,
    *,
    rate_limiter: RateLimiter | None = None,
    client=None,  # kept for test compatibility (unused)
) -> GoldTag:
    """Tag a single card using Claude CLI. Testable unit.

    Sends the card content alongside the full taxonomy to Claude and
    parses the structured JSON response into a GoldTag.  If validation
    fails, retries up to MAX_RETRIES times with a stricter prompt.

    Args:
        card: The card to tag.
        taxonomy: The taxonomy to enforce.
        rate_limiter: Optional rate limiter instance.
        client: Unused, kept for test compatibility.

    Returns:
        A validated GoldTag for the card.

    Raises:
        ValueError: If tagging fails after all retries.
    """
    system_prompt = _build_system_prompt(taxonomy)
    user_prompt = _build_user_prompt(card)
    errors: list[str] = []

    for attempt in range(1 + MAX_RETRIES):
        if rate_limiter is not None:
            rate_limiter.acquire_sync()

        # On retries, switch to the stricter prompt
        if attempt > 0 and errors:
            current_user_prompt = _build_retry_prompt(card, taxonomy, errors)
        else:
            current_user_prompt = user_prompt

        try:
            raw_text = call_claude(system_prompt, current_user_prompt)
        except Exception as exc:
            logger.warning("Claude error tagging card %s (attempt %d): %s", card.id, attempt + 1, exc)
            if attempt == MAX_RETRIES:
                raise ValueError(f"Claude error after {MAX_RETRIES + 1} attempts for card {card.id}: {exc}") from exc
            continue

        # Parse the response — handle markdown fences, etc.
        try:
            # Try to extract JSON from the response
            import re
            fenced = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw_text, re.DOTALL)
            if fenced:
                raw_text = fenced.group(1)
            raw_text = raw_text.strip()
            # Find outermost JSON object
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                raw_text = raw_text[start:end + 1]
            parsed = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.warning("Malformed JSON from Claude for card %s (attempt %d): %s", card.id, attempt + 1, exc)
            errors = [f"Response was not valid JSON: {exc}"]
            if attempt == MAX_RETRIES:
                raise ValueError(f"Malformed JSON after {MAX_RETRIES + 1} attempts for card {card.id}") from exc
            continue

        # Extract reasoning and category tags
        reasoning = parsed.pop("reasoning", None)
        categorized: dict[str, list[str]] = {}
        for cat in taxonomy.categories:
            raw_tags = parsed.get(cat.name, [])
            if isinstance(raw_tags, str):
                raw_tags = [raw_tags]
            categorized[cat.name] = [str(t).strip() for t in raw_tags if str(t).strip()]

        # Validate
        errors = _validate_tags(categorized, taxonomy)
        if not errors:
            return GoldTag.from_categorized(
                card_id=card.id,
                categorized_tags=categorized,
                reasoning=reasoning,
                confidence=0.85,
            )

        logger.info(
            "Validation errors for card %s (attempt %d/%d): %s",
            card.id, attempt + 1, MAX_RETRIES + 1, "; ".join(errors),
        )

    # If we exhaust retries, return best-effort result with lower confidence
    logger.warning("Card %s: returning best-effort tags after %d failed validations", card.id, MAX_RETRIES + 1)
    return GoldTag.from_categorized(
        card_id=card.id,
        categorized_tags=categorized,
        reasoning=(reasoning or "") + f" [VALIDATION WARNINGS: {'; '.join(errors)}]",
        confidence=0.5,
    )


# ---------------------------------------------------------------------------
# Batch entry point
# ---------------------------------------------------------------------------

def tag_all_cards() -> None:
    """Main entry point for batch tagging.

    Loads the taxonomy and card list, tags each card via GLM 4.7, and
    saves results to ``data/gold_tags.json`` with periodic checkpointing.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    # ---- Load taxonomy ----
    taxonomy_path = DATA_DIR / "taxonomy.json"
    if not taxonomy_path.exists():
        logger.error("Taxonomy file not found at %s — run Phase 1 first", taxonomy_path)
        sys.exit(1)

    taxonomy = Taxonomy.model_validate_json(taxonomy_path.read_text(encoding="utf-8"))
    logger.info("Loaded taxonomy v%s with %d categories", taxonomy.version, len(taxonomy.categories))

    # ---- Load cards ----
    cards_path = DATA_DIR / "cards_all.json"
    if not cards_path.exists():
        cards_path = DATA_DIR / "cards_sample.json"
    if not cards_path.exists():
        logger.error("No card file found (tried cards_all.json, cards_sample.json) in %s", DATA_DIR)
        sys.exit(1)

    raw_cards = json.loads(cards_path.read_text(encoding="utf-8"))
    cards = [Card.model_validate(c) for c in raw_cards]
    logger.info("Loaded %d cards from %s", len(cards), cards_path.name)

    # ---- Load checkpoint ----
    results = load_checkpoint(CHECKPOINT_PATH)
    remaining = [c for c in cards if c.id not in results]
    logger.info("%d cards already tagged, %d remaining", len(results), len(remaining))

    if not remaining:
        logger.info("All cards already tagged — writing final output")
        _save_final(results)
        return

    # ---- Set up rate limiter ----
    limiter = RateLimiter(rpm=GLM_RPM)

    # ---- Tag cards ----
    try:
        for i, card in enumerate(tqdm(remaining, desc="Tagging cards", unit="card"), start=1):
            try:
                gold = tag_card(card, taxonomy, rate_limiter=limiter)
                results[card.id] = gold
            except Exception as exc:
                logger.error("Failed to tag card %s: %s — skipping", card.id, exc)
                continue

            # Periodic checkpoint
            if i % CHECKPOINT_INTERVAL == 0:
                save_checkpoint(results, CHECKPOINT_PATH)
                logger.info("Checkpoint saved at %d / %d", i, len(remaining))

    except KeyboardInterrupt:
        logger.warning("Interrupted — saving partial results")
    except Exception as exc:
        logger.error("Unexpected error: %s — saving partial results", exc)
    finally:
        # Always save what we have
        save_checkpoint(results, CHECKPOINT_PATH)

    _save_final(results)


def _save_final(results: dict[str, GoldTag]) -> None:
    """Write the final gold_tags.json output."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = [gold.model_dump() for gold in results.values()]
    OUTPUT_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info("Saved %d gold tags to %s", len(data), OUTPUT_PATH)


# ---------------------------------------------------------------------------
# CLI entry
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tag_all_cards()
