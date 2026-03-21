"""
Phase 1 — Discover the optimal tag taxonomy from a card sample.

Sends 10 batches of ~20 cards to GLM 4.7, each returning a partial taxonomy
proposal, then synthesises a single canonical taxonomy.

Usage:
    python -m src.phase1_taxonomy.discover
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from tqdm import tqdm

from src.config import DATA_DIR, GLM_RPM
from src.models import Card, Taxonomy, TaxonomyCategory
from src.utils.claude_client import call_claude
from src.utils.rate_limiter import RateLimiter

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SAMPLE_PATH = DATA_DIR / "cards_sample.json"
TAXONOMY_OUTPUT = DATA_DIR / "taxonomy.json"
PARTIALS_DIR = DATA_DIR / "taxonomy_partials"

# ---------------------------------------------------------------------------
# Tuning knobs
# ---------------------------------------------------------------------------
NUM_BATCHES = 10
GLM_TEMPERATURE = 0.3
GLM_MAX_TOKENS = 4000

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

TAXONOMY_DISCOVERY_PROMPT = """\
You are a senior information architect designing a tagging taxonomy for a \
personal knowledge library. The library contains bookmarks, images, notes, \
articles, and screenshots saved from across the web.

### Your goal

Analyze the batch of cards below and propose the BEST tag categories and \
vocabulary. Optimise for two things simultaneously:

1. **Retrieval precision** — a user typing one tag should surface exactly the \
   cards they want, not hundreds of vaguely related items.
2. **Serendipitous cross-disciplinary discovery** — tags are connective tissue \
   that links a Brutalist architecture photo to a dark-mode UI concept to a \
   concrete-texture mood board. The taxonomy should *invite* unexpected but \
   meaningful connections between disparate content.

### Context on the existing system

The current system has ~50 aesthetic terms (dark-mode, film-grain, editorial, \
glassmorphism, brutalist, retro-futurism...) and ~15 vibe terms (kinetic, \
atmospheric, contemplative, tactile...). You are NOT constrained by these — \
they exist only for context. Discover what is truly optimal.

### What to propose

Return a JSON object with this structure:

```json
{
  "categories": [
    {
      "name": "category-slug",
      "description": "What this category captures and why it matters.",
      "vocabulary": ["tag-a", "tag-b", "...up to 30 terms"],
      "min_tags": 1,
      "max_tags": 3,
      "rules": [
        "Rule describing when/how to apply tags in this category."
      ]
    }
  ],
  "blocked_tags": ["generic", "cool", "nice", "interesting", "misc"],
  "platform_guidelines": {
    "twitter": "Guideline for tagging tweets/threads.",
    "dribbble": "Guideline for tagging Dribbble shots.",
    "general": "Default guideline."
  }
}
```

### Category design principles

- **Concrete over abstract.** Prefer tags you could point at in a photograph \
  (film-grain, split-complementary, monospace) over vague feelings (beautiful, \
  innovative, creative).
- **Compound specificity.** A tag like "dark-mode" is more useful than "dark" \
  because "dark" matches too broadly. Hyphenated compounds are great.
- **Controlled vocabulary with room to grow.** Give 15-30 terms per category \
  as a starting set, but note that new terms can be added. The vocabulary is a \
  guide, not a prison.
- **Mutual exclusivity between categories.** A tag should belong to exactly one \
  category. If "minimalist" could be style or mood, pick the one where it's \
  most actionable for retrieval.
- **Platform awareness.** A tweet screenshot needs different tagging emphasis \
  than a Dribbble shot or a long-form article. Include platform-specific notes.

### Blocked tags

Identify terms that SHOULD NEVER be used because they add no retrieval value: \
generic praise ("cool", "nice"), overly broad terms ("design", "web"), or \
ambiguous terms that mean different things in different contexts.

### Think step by step

1. Read through every card in this batch.
2. Note recurring themes, visual patterns, content domains, and moods.
3. Design categories that capture orthogonal dimensions of the content.
4. Fill vocabulary with concrete, specific, hyphenated-when-useful terms.
5. Write clear rules so a junior tagger could apply tags consistently.
6. Add platform-specific guidance.
7. List blocked tags.

Respond ONLY with the JSON object. No markdown fences, no commentary.\
"""

TAXONOMY_SYNTHESIS_PROMPT = """\
You are a senior information architect. You have received {n} independent \
taxonomy proposals from analysts who each reviewed a different slice of a \
personal knowledge library. Your job is to SYNTHESISE these into ONE canonical \
taxonomy.

### Synthesis rules

1. **Merge overlapping categories.** If two proposals have "visual-style" and \
   "aesthetic-style", merge them — pick the clearest name.
2. **Deduplicate vocabulary.** A tag must appear in exactly one category. If \
   it shows up in multiple proposals under different categories, assign it to \
   the single best-fit category.
3. **Resolve conflicts.** If proposals disagree on min/max tags, pick the \
   value that balances precision (fewer tags) with recall (more tags). \
   Generally 1-3 per category is ideal.
4. **Trim low-value categories.** If a proposed category has fewer than 5 \
   vocabulary terms and its scope could be absorbed by another category, merge \
   it rather than keeping a thin standalone category.
5. **Expand blocked tags.** Union all blocked tags from every proposal.
6. **Merge platform guidelines.** Combine advice, keeping it concise.
7. **Final vocabulary size.** Each category should have 15-40 terms. Fewer is \
   under-specified; more becomes unwieldy.
8. **Category count.** Aim for 4-7 categories total. Fewer than 4 is too \
   coarse; more than 7 introduces decision fatigue.

### Output format

Return a single JSON object:

```json
{{
  "version": "1.0",
  "description": "One-sentence description of the taxonomy's purpose.",
  "categories": [
    {{
      "name": "category-slug",
      "description": "What this category captures.",
      "vocabulary": ["tag-a", "tag-b", "..."],
      "min_tags": 1,
      "max_tags": 3,
      "rules": ["Rule 1.", "Rule 2."]
    }}
  ],
  "blocked_tags": ["generic", "cool", "..."],
  "platform_guidelines": {{
    "twitter": "...",
    "dribbble": "...",
    "article": "...",
    "image": "...",
    "general": "..."
  }}
}}
```

Respond ONLY with the JSON object. No markdown fences, no commentary.

---

Here are the {n} partial taxonomy proposals:

{partials}\
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_sample() -> list[Card]:
    """Load the card sample from disk."""
    if not SAMPLE_PATH.exists():
        raise FileNotFoundError(
            f"{SAMPLE_PATH} not found — run fetch_cards first:\n"
            "  python -m src.phase1_taxonomy.fetch_cards"
        )
    with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [Card.model_validate(r) for r in raw]


def _partition(cards: list[Card], n_batches: int = NUM_BATCHES) -> list[list[Card]]:
    """Split cards into roughly equal batches."""
    batch_size = math.ceil(len(cards) / n_batches)
    return [cards[i : i + batch_size] for i in range(0, len(cards), batch_size)]


def _cards_to_prompt_block(cards: list[Card]) -> str:
    """Format a batch of cards as a numbered block for the user message."""
    lines: list[str] = []
    for i, card in enumerate(cards, 1):
        parts = [f"### Card {i}"]
        parts.append(f"- **id:** {card.id}")
        parts.append(f"- **type:** {card.type}")
        parts.append(f"- **platform:** {card.platform}")
        if card.title:
            parts.append(f"- **title:** {card.title}")
        if card.url:
            parts.append(f"- **url:** {card.url}")
        if card.tags:
            parts.append(f"- **existing_tags:** {', '.join(card.tags)}")
        preview = card.content_preview(max_len=800)
        if preview:
            parts.append(f"- **content_preview:**\n{preview}")
        lines.append("\n".join(parts))
    return "\n\n---\n\n".join(lines)


def _extract_json(text: str) -> dict:
    """Robustly extract a JSON object from an LLM response.

    Handles:
        - Clean JSON
        - JSON wrapped in markdown code fences (```json ... ```)
        - Leading/trailing whitespace or commentary
        - Partial JSON (attempts recovery by finding outermost braces)
    """
    # Strip markdown code fences if present.
    fenced = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)

    # Try direct parse first.
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: find the outermost { ... } pair.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from LLM response:\n{text[:500]}")


def _call_llm(
    system: str,
    user: str,
    rate_limiter: RateLimiter,
) -> str:
    """Send a prompt to Claude via CLI with rate limiting.

    Returns the raw text content from the response.
    """
    rate_limiter.acquire_sync()
    return call_claude(system, user)


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

def discover_taxonomy() -> Taxonomy:
    """Run the full taxonomy discovery pipeline.

    Steps:
        1. Load card sample.
        2. Partition into batches.
        3. Send each batch to GLM for partial taxonomy proposals.
        4. Synthesise all partials into one canonical taxonomy.
        5. Validate and save.

    Returns:
        The discovered Taxonomy model.
    """
    # --- Setup ---
    limiter = RateLimiter(rpm=GLM_RPM)
    PARTIALS_DIR.mkdir(parents=True, exist_ok=True)

    # --- Step 1: Load sample ---
    print("Loading card sample...")
    cards = _load_sample()
    print(f"  Loaded {len(cards)} cards.")

    # --- Step 2: Partition ---
    batches = _partition(cards, NUM_BATCHES)
    print(f"  Split into {len(batches)} batches "
          f"(~{len(batches[0]) if batches else 0} cards each).")

    # --- Step 3: Batch discovery ---
    partials: list[dict] = []
    print("\nDiscovering partial taxonomies...")

    for i, batch in enumerate(tqdm(batches, desc="Batch discovery")):
        user_msg = (
            f"Analyze the following {len(batch)} cards and propose a tag taxonomy.\n\n"
            + _cards_to_prompt_block(batch)
        )

        try:
            raw = _call_llm(TAXONOMY_DISCOVERY_PROMPT, user_msg, limiter)
            partial = _extract_json(raw)
            partials.append(partial)

            # Persist each partial for debugging / auditing.
            partial_path = PARTIALS_DIR / f"partial_{i:02d}.json"
            with open(partial_path, "w", encoding="utf-8") as f:
                json.dump(partial, f, indent=2, ensure_ascii=False)

            print(f"  Batch {i}: {len(partial.get('categories', []))} categories, "
                  f"{len(partial.get('blocked_tags', []))} blocked tags")

        except Exception as exc:
            print(f"  Batch {i}: FAILED — {exc}")
            # Continue with remaining batches rather than aborting.
            continue

    if not partials:
        raise RuntimeError("All batch requests failed — cannot synthesise taxonomy.")

    print(f"\n  Collected {len(partials)} partial proposals.")

    # --- Step 4: Synthesis ---
    print("\nSynthesising final taxonomy...")

    partials_block = "\n\n---\n\n".join(
        f"**Proposal {i + 1}:**\n```json\n{json.dumps(p, indent=2, ensure_ascii=False)}\n```"
        for i, p in enumerate(partials)
    )

    synthesis_system = TAXONOMY_SYNTHESIS_PROMPT.format(
        n=len(partials),
        partials=partials_block,
    )

    # The synthesis prompt is long — give the model more room to respond.
    raw_synthesis = _call_llm(
        synthesis_system,
        "Synthesise the proposals above into one canonical taxonomy. "
        "Return ONLY the JSON object.",
        limiter,
    )

    taxonomy_dict = _extract_json(raw_synthesis)

    # --- Step 5: Validate with Pydantic ---
    print("Validating taxonomy structure...")
    taxonomy = _parse_taxonomy(taxonomy_dict)

    # --- Step 6: Save ---
    with open(TAXONOMY_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(taxonomy.model_dump(mode="json"), f, indent=2, ensure_ascii=False)

    _print_summary(taxonomy)
    print(f"\nSaved canonical taxonomy to {TAXONOMY_OUTPUT}")

    return taxonomy


def _parse_taxonomy(data: dict) -> Taxonomy:
    """Parse a raw dict into a validated Taxonomy model.

    Handles minor structural differences the LLM might produce:
    - categories as a list of dicts (expected) or keyed by name
    - missing optional fields filled with defaults
    """
    # If the LLM returned categories as a dict keyed by name, convert.
    cats_raw = data.get("categories", [])
    if isinstance(cats_raw, dict):
        cats_raw = [
            {"name": k, **v} if isinstance(v, dict) else {"name": k}
            for k, v in cats_raw.items()
        ]

    categories: list[TaxonomyCategory] = []
    for cat_data in cats_raw:
        try:
            categories.append(TaxonomyCategory.model_validate(cat_data))
        except Exception as exc:
            print(f"  Warning: skipping malformed category — {exc}")
            continue

    return Taxonomy(
        version=data.get("version", "1.0"),
        description=data.get("description", "Discovered taxonomy for personal knowledge library"),
        categories=categories,
        blocked_tags=data.get("blocked_tags", []),
        platform_guidelines=data.get("platform_guidelines", {}),
    )


def _print_summary(taxonomy: Taxonomy) -> None:
    """Print a human-readable summary of the taxonomy."""
    print(f"\n{'=' * 60}")
    print(f"TAXONOMY v{taxonomy.version}")
    print(f"  {taxonomy.description}")
    print(f"{'=' * 60}")

    for cat in taxonomy.categories:
        print(f"\n  [{cat.name}] — {cat.description}")
        print(f"    Tags per card: {cat.min_tags}-{cat.max_tags}")
        print(f"    Vocabulary ({len(cat.vocabulary)} terms): "
              f"{', '.join(cat.vocabulary[:10])}{'...' if len(cat.vocabulary) > 10 else ''}")
        if cat.rules:
            for rule in cat.rules:
                print(f"    - {rule}")

    print(f"\n  Blocked tags ({len(taxonomy.blocked_tags)}): "
          f"{', '.join(taxonomy.blocked_tags[:15])}{'...' if len(taxonomy.blocked_tags) > 15 else ''}")

    if taxonomy.platform_guidelines:
        print("\n  Platform guidelines:")
        for plat, guide in taxonomy.platform_guidelines.items():
            print(f"    [{plat}] {guide[:100]}{'...' if len(guide) > 100 else ''}")

    total_vocab = len(taxonomy.all_vocabulary())
    print(f"\n  Total unique vocabulary: {total_vocab} terms across {len(taxonomy.categories)} categories")
    print(f"{'=' * 60}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    discover_taxonomy()
