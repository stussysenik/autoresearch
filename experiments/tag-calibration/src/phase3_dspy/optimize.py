"""
Phase 3: DSPy Calibration — Optimize tag classification prompts.

This pipeline takes the taxonomy (Phase 1) and gold tags (Phase 2) and uses
DSPy's optimizers to find the best prompt + few-shot configuration for the
student model (Gemma 3 12B via Ollama).

Two optimization strategies are run sequentially:

1. BootstrapFewShot: Uses the teacher LM (GLM 4.7) to generate reasoning
   traces, then selects the best few-shot demonstrations for the student.
   Fast, reliable baseline.

2. MIPROv2: Multi-prompt instruction proposal optimization. Generates and
   evaluates multiple instruction variants alongside few-shot selection.
   Slower but often finds better prompts.

Both optimized programs are saved to data/optimized_prompts/ for Phase 4
evaluation and production export.

Usage:
    uv run python -m src.phase3_dspy.optimize
"""

from __future__ import annotations

import json
import random
import sys
from collections import defaultdict
from pathlib import Path

import dspy
from dspy.teleprompt import BootstrapFewShot, MIPROv2

from src.config import (
    DATA_DIR,
    GLM_MODEL,
    OLLAMA_BASE,
    OLLAMA_MODEL,
    ZHIPU_API_BASE,
    ZHIPU_API_KEY,
)
from src.models import Card, GoldTag, Taxonomy

from .metrics import make_composite_metric, tag_f1
from .modules import TagClassifier


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_taxonomy() -> Taxonomy:
    """Load the Phase 1 taxonomy from data/taxonomy.json."""
    path = DATA_DIR / "taxonomy.json"
    if not path.exists():
        print(f"ERROR: Taxonomy not found at {path}")
        print("Run Phase 1 first: make phase1")
        sys.exit(1)
    with open(path) as f:
        return Taxonomy.model_validate(json.load(f))


def load_gold_tags() -> list[GoldTag]:
    """Load Phase 2 gold tags from data/gold_tags.json."""
    path = DATA_DIR / "gold_tags.json"
    if not path.exists():
        print(f"ERROR: Gold tags not found at {path}")
        print("Run Phase 2 first: make phase2")
        sys.exit(1)
    with open(path) as f:
        raw = json.load(f)
    return [GoldTag.model_validate(item) for item in raw]


def load_cards() -> dict[str, Card]:
    """Load cards, indexed by card ID.

    Tries cards_all.json first (Phase 2 full dump), then falls back
    to cards_sample.json (Phase 1 sample).
    """
    for name in ("cards_all.json", "cards_sample.json"):
        path = DATA_DIR / name
        if path.exists():
            with open(path) as f:
                raw = json.load(f)
            cards = {card["id"]: Card.model_validate(card) for card in raw}
            print(f"  Loaded {len(cards)} cards from {name}")
            return cards
    print(f"ERROR: No card file found in {DATA_DIR}")
    print("Run Phase 1 first: make phase1")
    sys.exit(1)


# ---------------------------------------------------------------------------
# DSPy Example construction
# ---------------------------------------------------------------------------

def build_examples(cards: dict[str, Card], gold_tags: list[GoldTag]) -> list[dspy.Example]:
    """Convert gold-tagged cards into DSPy Examples.

    Each Example carries the input fields (title, content, url, platform)
    and gold output fields (primary_tags, contextual_tags, style_tag,
    flat_tags) that DSPy metrics compare against.

    Args:
        cards: Card lookup by ID.
        gold_tags: Gold-standard tags from Phase 2.

    Returns:
        List of DSPy Examples with inputs properly declared.
    """
    examples = []
    skipped = 0

    for gold in gold_tags:
        card = cards.get(gold.card_id)
        if card is None:
            skipped += 1
            continue

        # Extract per-category gold tags
        primary = gold.tags.get("primary", [])
        contextual = gold.tags.get("contextual", [])
        style_tags = gold.tags.get("style", [])
        style = style_tags[0] if style_tags else ""

        example = dspy.Example(
            # Inputs
            title=card.title or "",
            content=card.content_preview(max_len=1500),
            url=card.url or "",
            platform=card.platform,
            # Gold outputs
            primary_tags=primary,
            contextual_tags=contextual,
            style_tag=style,
            flat_tags=gold.flat_tags,
        ).with_inputs("title", "content", "url", "platform")

        examples.append(example)

    if skipped:
        print(f"  Skipped {skipped} gold tags (card not found)")

    return examples


def stratified_split(
    examples: list[dspy.Example],
    train_ratio: float = 0.8,
    seed: int = 42,
) -> tuple[list[dspy.Example], list[dspy.Example]]:
    """Split examples 80/20, stratified by platform.

    Ensures each platform is proportionally represented in both train
    and dev sets, preventing evaluation bias.

    Args:
        examples: Full list of DSPy Examples.
        train_ratio: Fraction for training (default 0.8).
        seed: Random seed for reproducibility.

    Returns:
        (trainset, devset) tuple.
    """
    rng = random.Random(seed)

    # Group by platform
    by_platform: dict[str, list[dspy.Example]] = defaultdict(list)
    for ex in examples:
        platform = getattr(ex, "platform", "unknown")
        by_platform[platform].append(ex)

    trainset = []
    devset = []

    for platform, platform_examples in by_platform.items():
        rng.shuffle(platform_examples)
        split_idx = max(1, int(len(platform_examples) * train_ratio))
        trainset.extend(platform_examples[:split_idx])
        devset.extend(platform_examples[split_idx:])

    # Shuffle final sets so platforms are interleaved
    rng.shuffle(trainset)
    rng.shuffle(devset)

    return trainset, devset


# ---------------------------------------------------------------------------
# LM configuration
# ---------------------------------------------------------------------------

def configure_teacher() -> dspy.LM:
    """Configure GLM 4.7 as the teacher LM via OpenAI-compatible API.

    The teacher generates high-quality reasoning traces during
    BootstrapFewShot compilation. These traces become few-shot
    demonstrations for the student model.
    """
    if not ZHIPU_API_KEY:
        print("ERROR: ZHIPU_API_KEY not set in .env")
        print("The teacher LM (GLM 4.7) requires an API key.")
        sys.exit(1)

    return dspy.LM(
        f"openai/{GLM_MODEL}",
        api_base=ZHIPU_API_BASE,
        api_key=ZHIPU_API_KEY,
        temperature=0.7,
        max_tokens=1024,
    )


def configure_student() -> dspy.LM:
    """Configure Gemma 3 12B via Ollama as the student LM.

    This is the production model that will run locally. DSPy optimizes
    prompts specifically for this model's capabilities.
    """
    return dspy.LM(
        f"ollama_chat/{OLLAMA_MODEL}",
        api_base=OLLAMA_BASE,
        api_key="",
        temperature=0.3,
        max_tokens=512,
    )


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def evaluate_program(
    program: dspy.Module,
    devset: list[dspy.Example],
    metric_fn,
    label: str = "Program",
) -> float:
    """Run a DSPy program against the dev set and report aggregate score.

    Args:
        program: Optimized DSPy Module.
        devset: Evaluation examples.
        metric_fn: Metric function (example, prediction, trace=None) -> float.
        label: Display name for logging.

    Returns:
        Mean metric score across dev set.
    """
    evaluator = dspy.Evaluate(
        devset=devset,
        metric=metric_fn,
        num_threads=1,
        display_progress=True,
        display_table=5,
    )
    score = evaluator(program)
    print(f"\n  {label} dev score: {score:.4f}")
    return score


# ---------------------------------------------------------------------------
# Save / Load
# ---------------------------------------------------------------------------

def save_program(program: dspy.Module, name: str, score: float) -> Path:
    """Save an optimized program to data/optimized_prompts/.

    Args:
        program: The optimized DSPy Module.
        name: Filename stem (e.g., "bootstrap_fewshot").
        score: Evaluation score for metadata.

    Returns:
        Path to the saved program directory.
    """
    out_dir = DATA_DIR / "optimized_prompts" / name
    out_dir.mkdir(parents=True, exist_ok=True)
    program.save(str(out_dir))

    # Save metadata alongside
    meta = {"name": name, "score": score, "model": OLLAMA_MODEL}
    with open(out_dir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  Saved {name} to {out_dir}")
    return out_dir


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_optimization():
    """Execute the full Phase 3 optimization pipeline.

    Steps:
        1. Load taxonomy (Phase 1) and gold tags (Phase 2)
        2. Build DSPy Examples from gold-tagged cards
        3. Split 80/20 stratified by platform
        4. Configure teacher (GLM 4.7) and student (Gemma 3 12B) LMs
        5. Run BootstrapFewShot optimization
        6. Evaluate on dev set
        7. Run MIPROv2 optimization
        8. Evaluate on dev set
        9. Save both programs
        10. Print comparison
    """
    print("=" * 60)
    print("Phase 3: DSPy Calibration")
    print("=" * 60)

    # -- Step 1: Load data --
    print("\n[1/10] Loading taxonomy...")
    taxonomy = load_taxonomy()
    print(f"  Taxonomy v{taxonomy.version}: {len(taxonomy.categories)} categories, "
          f"{len(taxonomy.all_vocabulary())} total vocabulary terms")

    print("\n[2/10] Loading gold tags and cards...")
    gold_tags = load_gold_tags()
    cards = load_cards()
    print(f"  {len(gold_tags)} gold tags, {len(cards)} cards")

    # -- Step 2: Build examples --
    print("\n[3/10] Building DSPy examples...")
    examples = build_examples(cards, gold_tags)
    print(f"  {len(examples)} examples built")

    if len(examples) < 5:
        print("ERROR: Need at least 5 examples for train/dev split")
        sys.exit(1)

    # -- Step 3: Train/dev split --
    print("\n[4/10] Splitting train/dev (80/20, stratified by platform)...")
    trainset, devset = stratified_split(examples)
    print(f"  Train: {len(trainset)}, Dev: {len(devset)}")

    # -- Step 4: Configure LMs --
    print("\n[5/10] Configuring LMs...")
    teacher_lm = configure_teacher()
    student_lm = configure_student()
    print(f"  Teacher: {GLM_MODEL} (via Zhipu API)")
    print(f"  Student: {OLLAMA_MODEL} (via Ollama at {OLLAMA_BASE})")

    # -- Build metric --
    composite_metric = make_composite_metric(taxonomy)

    # -- Step 5: BootstrapFewShot --
    print("\n[6/10] Running BootstrapFewShot optimization...")
    print("  (Teacher generates reasoning traces, student learns from best demos)")

    bootstrap = BootstrapFewShot(
        metric=composite_metric,
        teacher_settings=dict(lm=teacher_lm),
        max_bootstrapped_demos=8,
        max_labeled_demos=4,
    )

    dspy.configure(lm=student_lm)
    optimized_bs = bootstrap.compile(
        TagClassifier(taxonomy),
        trainset=trainset,
    )

    # -- Step 6: Evaluate BootstrapFewShot --
    print("\n[7/10] Evaluating BootstrapFewShot on dev set...")
    bs_score = evaluate_program(optimized_bs, devset, composite_metric, "BootstrapFewShot")

    # -- Step 7: MIPROv2 --
    print("\n[8/10] Running MIPROv2 optimization...")
    print("  (Generating and evaluating multiple instruction variants)")

    mipro = MIPROv2(
        metric=composite_metric,
        auto="medium",
    )

    optimized_mipro = mipro.compile(
        TagClassifier(taxonomy),
        trainset=trainset,
    )

    # -- Step 8: Evaluate MIPROv2 --
    print("\n[9/10] Evaluating MIPROv2 on dev set...")
    mipro_score = evaluate_program(optimized_mipro, devset, composite_metric, "MIPROv2")

    # -- Step 9: Save both programs --
    print("\n[10/10] Saving optimized programs...")
    save_program(optimized_bs, "bootstrap_fewshot", bs_score)
    save_program(optimized_mipro, "mipro_v2", mipro_score)

    # -- Step 10: Comparison --
    print("\n" + "=" * 60)
    print("RESULTS COMPARISON")
    print("=" * 60)
    print(f"  BootstrapFewShot : {bs_score:.4f}")
    print(f"  MIPROv2          : {mipro_score:.4f}")

    winner = "MIPROv2" if mipro_score > bs_score else "BootstrapFewShot"
    best_score = max(bs_score, mipro_score)
    print(f"\n  Winner: {winner} ({best_score:.4f})")

    # Save summary
    summary = {
        "bootstrap_fewshot_score": bs_score,
        "mipro_v2_score": mipro_score,
        "winner": winner,
        "train_size": len(trainset),
        "dev_size": len(devset),
        "teacher_model": GLM_MODEL,
        "student_model": OLLAMA_MODEL,
    }
    summary_path = DATA_DIR / "optimized_prompts" / "optimization_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\n  Summary saved to {summary_path}")

    print("\nPhase 3 complete. Run `make phase4` for validation.")


if __name__ == "__main__":
    run_optimization()
