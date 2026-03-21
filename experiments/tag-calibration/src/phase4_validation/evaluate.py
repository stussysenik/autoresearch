"""
Phase 4 — Validation: run the best optimized program on the full dataset.

Loads the best DSPy-optimized Gemma program (comparing bootstrap vs MIPRO),
runs it on every card with gold tags, computes per-card and aggregate metrics,
and writes predictions + a validation report to disk.

Usage:
    python -m src.phase4_validation.evaluate
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from pathlib import Path

import dspy
from tqdm import tqdm

from src.config import DATA_DIR, OLLAMA_BASE, OLLAMA_MODEL
from src.models import Card, GoldTag, Taxonomy, ValidationMetrics

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
TAXONOMY_PATH = DATA_DIR / "taxonomy.json"
GOLD_TAGS_PATH = DATA_DIR / "gold_tags.json"
CARDS_ALL_PATH = DATA_DIR / "cards_all.json"
CARDS_SAMPLE_PATH = DATA_DIR / "cards_sample.json"
BOOTSTRAP_PATH = DATA_DIR / "optimized_prompts" / "bootstrap_fewshot"
MIPRO_PATH = DATA_DIR / "optimized_prompts" / "mipro_v2"
SUMMARY_PATH = DATA_DIR / "optimized_prompts" / "optimization_summary.json"
PREDICTIONS_OUTPUT = DATA_DIR / "gemma_predictions.json"
REPORT_OUTPUT = DATA_DIR / "validation_report.json"


# ---------------------------------------------------------------------------
# Metrics helpers (inline so we don't depend on an unwritten Phase 3 module)
# ---------------------------------------------------------------------------

def _tag_f1(predicted: set[str], gold: set[str]) -> float:
    """Compute F1 between two tag sets."""
    if not predicted and not gold:
        return 1.0
    if not predicted or not gold:
        return 0.0
    tp = len(predicted & gold)
    precision = tp / len(predicted)
    recall = tp / len(gold)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def _taxonomy_adherence(predicted_tags: list[str], vocab: set[str]) -> float:
    """Fraction of predicted tags that belong to the taxonomy vocabulary."""
    if not predicted_tags:
        return 1.0
    return sum(1 for t in predicted_tags if t in vocab) / len(predicted_tags)


def _blocked_count(predicted_tags: list[str], blocked: set[str]) -> int:
    """Count how many predicted tags are on the blocked list."""
    return sum(1 for t in predicted_tags if t in blocked)


def _has_style_tag(predicted_tags: list[str], style_vocab: set[str]) -> bool:
    """Whether at least one predicted tag comes from the style category."""
    return any(t in style_vocab for t in predicted_tags)


# ---------------------------------------------------------------------------
# MetricsAccumulator
# ---------------------------------------------------------------------------

class MetricsAccumulator:
    """Accumulates per-card metrics and computes aggregate statistics.

    This class collects F1, adherence, style coverage, and blocked-tag counts
    across all evaluated cards, then provides aggregate views (micro/macro F1,
    per-platform breakdowns, worst/best cards, etc.).
    """

    def __init__(self, taxonomy: Taxonomy):
        self.taxonomy = taxonomy
        self.vocab = taxonomy.all_vocabulary()
        self.blocked = taxonomy.blocked_set()

        # Find style category vocabulary (if it exists)
        style_cat = taxonomy.get_category("style")
        self.style_vocab: set[str] = set(style_cat.vocabulary) if style_cat else set()

        # Per-card accumulators
        self.card_f1s: list[float] = []
        self.adherence_scores: list[float] = []
        self.style_present: list[bool] = []
        self.blocked_counts: list[int] = []

        # Breakdown accumulators
        self.platform_scores: dict[str, list[float]] = defaultdict(list)
        self.category_scores: dict[str, list[float]] = defaultdict(list)

        # For worst/best tracking
        self._card_details: list[dict] = []

        # For micro-F1 computation
        self._total_tp: int = 0
        self._total_pred: int = 0
        self._total_gold: int = 0

    def add(self, prediction: list[str], gold: GoldTag, platform: str, card_id: str) -> None:
        """Record metrics for a single card prediction.

        Args:
            prediction: Flat list of predicted tags from the optimized program.
            gold: The gold-standard GoldTag for this card.
            platform: The platform the card came from (for per-platform breakdown).
            card_id: The card's unique identifier (for worst/best tracking).
        """
        pred_set = set(prediction)
        gold_set = set(gold.flat_tags)

        # --- F1 ---
        f1 = _tag_f1(pred_set, gold_set)
        self.card_f1s.append(f1)

        # --- Micro-F1 accumulators ---
        tp = len(pred_set & gold_set)
        self._total_tp += tp
        self._total_pred += len(pred_set)
        self._total_gold += len(gold_set)

        # --- Adherence ---
        adh = _taxonomy_adherence(prediction, self.vocab)
        self.adherence_scores.append(adh)

        # --- Style ---
        has_style = _has_style_tag(prediction, self.style_vocab)
        self.style_present.append(has_style)

        # --- Blocked ---
        blocked = _blocked_count(prediction, self.blocked)
        self.blocked_counts.append(blocked)

        # --- Platform ---
        self.platform_scores[platform].append(f1)

        # --- Per-category F1 ---
        for cat in self.taxonomy.categories:
            cat_gold = set(gold.tags.get(cat.name, []))
            cat_pred = set(t for t in prediction if t in set(cat.vocabulary))
            cat_f1 = _tag_f1(cat_pred, cat_gold)
            self.category_scores[cat.name].append(cat_f1)

        # --- Detail record for worst/best ---
        self._card_details.append({
            "card_id": card_id,
            "platform": platform,
            "f1": f1,
            "adherence": adh,
            "blocked_count": blocked,
            "predicted": sorted(prediction),
            "gold": sorted(gold.flat_tags),
        })

    def micro_f1(self) -> float:
        """Micro-averaged F1 across all cards (global TP/FP/FN)."""
        if self._total_pred == 0 and self._total_gold == 0:
            return 1.0
        if self._total_pred == 0 or self._total_gold == 0:
            return 0.0
        precision = self._total_tp / self._total_pred
        recall = self._total_tp / self._total_gold
        if precision + recall == 0:
            return 0.0
        return 2 * precision * recall / (precision + recall)

    def macro_f1(self) -> float:
        """Macro-averaged F1: mean of per-card F1 scores."""
        if not self.card_f1s:
            return 0.0
        return sum(self.card_f1s) / len(self.card_f1s)

    def exact_match_rate(self) -> float:
        """Fraction of cards where predicted tags exactly match gold tags."""
        if not self.card_f1s:
            return 0.0
        return sum(1 for f1 in self.card_f1s if f1 == 1.0) / len(self.card_f1s)

    def mean_adherence(self) -> float:
        """Mean taxonomy adherence across all cards."""
        if not self.adherence_scores:
            return 1.0
        return sum(self.adherence_scores) / len(self.adherence_scores)

    def style_coverage(self) -> float:
        """Fraction of cards that received at least one style tag."""
        if not self.style_present:
            return 0.0
        return sum(1 for s in self.style_present if s) / len(self.style_present)

    def blocked_tag_rate(self) -> float:
        """Fraction of cards that contain at least one blocked tag."""
        if not self.blocked_counts:
            return 0.0
        return sum(1 for b in self.blocked_counts if b > 0) / len(self.blocked_counts)

    def per_platform_scores(self) -> dict[str, float]:
        """Mean F1 per platform."""
        return {
            platform: sum(scores) / len(scores)
            for platform, scores in sorted(self.platform_scores.items())
            if scores
        }

    def per_category_scores(self) -> dict[str, dict[str, float]]:
        """Per-category metrics: mean F1 and count for each taxonomy category."""
        result: dict[str, dict[str, float]] = {}
        for cat_name, scores in sorted(self.category_scores.items()):
            if scores:
                result[cat_name] = {
                    "mean_f1": sum(scores) / len(scores),
                    "count": len(scores),
                }
        return result

    def worst_n(self, n: int = 10) -> list[dict]:
        """Return the N cards with the lowest F1 scores."""
        return sorted(self._card_details, key=lambda d: d["f1"])[:n]

    def best_n(self, n: int = 10) -> list[dict]:
        """Return the N cards with the highest F1 scores."""
        return sorted(self._card_details, key=lambda d: -d["f1"])[:n]

    def to_validation_metrics(self) -> ValidationMetrics:
        """Collapse accumulated results into a ValidationMetrics model."""
        return ValidationMetrics(
            total_cards=len(self.card_f1s),
            micro_f1=round(self.micro_f1(), 4),
            macro_f1=round(self.macro_f1(), 4),
            exact_match_rate=round(self.exact_match_rate(), 4),
            taxonomy_adherence=round(self.mean_adherence(), 4),
            style_coverage=round(self.style_coverage(), 4),
            blocked_tag_rate=round(self.blocked_tag_rate(), 4),
            per_platform=self.per_platform_scores(),
            per_category=self.per_category_scores(),
        )


# ---------------------------------------------------------------------------
# Loading helpers
# ---------------------------------------------------------------------------

def _load_taxonomy() -> Taxonomy:
    """Load the taxonomy from disk."""
    raw = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    return Taxonomy.model_validate(raw)


def _load_gold_tags() -> dict[str, GoldTag]:
    """Load gold tags, returning card_id -> GoldTag mapping.

    Handles both formats:
    - List of GoldTag dicts (Phase 2 `_save_final` output)
    - Dict keyed by card_id (checkpoint format)
    """
    raw = json.loads(GOLD_TAGS_PATH.read_text(encoding="utf-8"))
    results: dict[str, GoldTag] = {}

    if isinstance(raw, list):
        for entry in raw:
            gold = GoldTag.model_validate(entry)
            results[gold.card_id] = gold
    elif isinstance(raw, dict):
        for card_id, entry in raw.items():
            results[card_id] = GoldTag.model_validate(entry)

    return results


def _load_cards() -> dict[str, Card]:
    """Load all cards, returning card_id -> Card mapping.

    Tries cards_all.json first, falls back to cards_sample.json.
    """
    for path in (CARDS_ALL_PATH, CARDS_SAMPLE_PATH):
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            cards: dict[str, Card] = {}
            for item in raw:
                card = Card.model_validate(item)
                cards[card.id] = card
            return cards
    raise FileNotFoundError(f"No card files found in {DATA_DIR}")


def _load_best_program(taxonomy: Taxonomy) -> tuple[dspy.Module, str]:
    """Load the best optimized DSPy program, comparing bootstrap vs MIPRO.

    Uses the optimization_summary.json from Phase 3 to determine the winner,
    then loads the corresponding saved program directory using TagClassifier.

    Args:
        taxonomy: The Phase 1 taxonomy (needed to construct TagClassifier).

    Returns:
        Tuple of (loaded TagClassifier, optimizer name that won).
    """
    from src.phase3_dspy.modules import TagClassifier

    # Try to use the optimization summary first
    if SUMMARY_PATH.exists():
        summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
        winner = summary.get("winner", "BootstrapFewShot")
        if "mipro" in winner.lower():
            winner_name = "mipro_v2"
            path = MIPRO_PATH
        else:
            winner_name = "bootstrap_fewshot"
            path = BOOTSTRAP_PATH
        logger.info("Summary says winner is %s (score: %s)",
                     winner, summary.get(f"{winner_name}_score", "?"))
    else:
        # Fallback: pick whichever directory exists, prefer mipro
        bootstrap_score = -1.0
        mipro_score = -1.0

        bs_meta = BOOTSTRAP_PATH / "metadata.json"
        if bs_meta.exists():
            bootstrap_score = json.loads(bs_meta.read_text()).get("score", -1.0)

        mipro_meta = MIPRO_PATH / "metadata.json"
        if mipro_meta.exists():
            mipro_score = json.loads(mipro_meta.read_text()).get("score", -1.0)

        if bootstrap_score < 0 and mipro_score < 0:
            raise FileNotFoundError(
                f"No optimized programs found. Expected at least one of:\n"
                f"  {BOOTSTRAP_PATH}\n  {MIPRO_PATH}"
            )

        if mipro_score > bootstrap_score:
            winner_name = "mipro_v2"
            path = MIPRO_PATH
        else:
            winner_name = "bootstrap_fewshot"
            path = BOOTSTRAP_PATH

    logger.info("Loading %s program from %s", winner_name, path)
    program = TagClassifier(taxonomy)
    program.load(str(path))
    return program, winner_name


# ---------------------------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------------------------

def evaluate() -> ValidationMetrics:
    """Run the optimized program on all gold-tagged cards and compute metrics.

    Steps:
        1. Load taxonomy, gold tags, cards, and the best optimized program.
        2. Configure DSPy with Gemma via Ollama as the student LM.
        3. For each card that has a gold tag, run the program and score.
        4. Aggregate metrics and save results.

    Returns:
        The computed ValidationMetrics.
    """
    print("=" * 60)
    print("Phase 4 — Validation")
    print("=" * 60)

    # --- Load data ---
    print("\nLoading taxonomy...")
    taxonomy = _load_taxonomy()
    print(f"  {len(taxonomy.categories)} categories, "
          f"{len(taxonomy.all_vocabulary())} vocab tags, "
          f"{len(taxonomy.blocked_tags)} blocked tags")

    print("Loading gold tags...")
    gold_tags = _load_gold_tags()
    print(f"  {len(gold_tags)} gold-tagged cards")

    print("Loading cards...")
    cards = _load_cards()
    print(f"  {len(cards)} total cards")

    print("Loading best optimized program...")
    program, winner = _load_best_program(taxonomy)
    print(f"  Winner: {winner}")

    # --- Configure DSPy with Gemma ---
    print(f"\nConfiguring DSPy with {OLLAMA_MODEL} at {OLLAMA_BASE}...")
    student_lm = dspy.LM(
        model=f"ollama_chat/{OLLAMA_MODEL}",
        api_base=OLLAMA_BASE,
        temperature=0.0,
        max_tokens=512,
    )
    dspy.configure(lm=student_lm)

    # --- Evaluate ---
    accumulator = MetricsAccumulator(taxonomy)
    predictions: dict[str, dict] = {}
    errors: list[dict] = []

    # Only evaluate cards that have gold tags
    eval_card_ids = [cid for cid in gold_tags if cid in cards]
    print(f"\nEvaluating {len(eval_card_ids)} cards with gold tags...\n")

    for card_id in tqdm(eval_card_ids, desc="Evaluating", unit="card"):
        card = cards[card_id]
        gold = gold_tags[card_id]

        try:
            # Run the optimized program (TagClassifier.forward signature)
            result = program(
                title=card.title or "",
                content=card.content_preview(),
                url=card.url or "",
                platform=card.platform,
            )

            # Extract predicted tags from per-category fields
            predicted_tags = []

            for attr in ("primary_tags", "contextual_tags"):
                val = getattr(result, attr, [])
                if isinstance(val, list):
                    predicted_tags.extend(str(t).strip() for t in val if str(t).strip())
                elif isinstance(val, str) and val.strip():
                    predicted_tags.extend(t.strip() for t in val.split(",") if t.strip())

            style = getattr(result, "style_tag", "")
            if isinstance(style, str) and style.strip():
                predicted_tags.append(style.strip())
            elif isinstance(style, list) and style:
                predicted_tags.append(str(style[0]).strip())

            # Normalize to lowercase for fair comparison
            predicted_tags = [t.lower() for t in predicted_tags]
            gold_flat_lower = [t.lower() for t in gold.flat_tags]
            gold_lower = GoldTag(
                card_id=gold.card_id,
                tags={k: [t.lower() for t in v] for k, v in gold.tags.items()},
                flat_tags=gold_flat_lower,
                reasoning=gold.reasoning,
                confidence=gold.confidence,
            )

            # Record metrics
            accumulator.add(
                prediction=predicted_tags,
                gold=gold_lower,
                platform=card.platform,
                card_id=card_id,
            )

            # Store prediction
            predictions[card_id] = {
                "card_id": card_id,
                "platform": card.platform,
                "predicted_tags": predicted_tags,
                "gold_tags": gold_flat_lower,
            }

        except Exception as exc:
            logger.warning("Error evaluating card %s: %s", card_id, exc)
            errors.append({"card_id": card_id, "error": str(exc)})
            continue

    # --- Compute final metrics ---
    metrics = accumulator.to_validation_metrics()

    print(f"\n{'=' * 60}")
    print("Validation Results")
    print(f"{'=' * 60}")
    print(f"  Total cards evaluated:  {metrics.total_cards}")
    print(f"  Micro F1:               {metrics.micro_f1:.4f}")
    print(f"  Macro F1:               {metrics.macro_f1:.4f}")
    print(f"  Exact match rate:       {metrics.exact_match_rate:.4f}")
    print(f"  Taxonomy adherence:     {metrics.taxonomy_adherence:.4f}")
    print(f"  Style coverage:         {metrics.style_coverage:.4f}")
    print(f"  Blocked tag rate:       {metrics.blocked_tag_rate:.4f}")
    if errors:
        print(f"  Errors:                 {len(errors)}")

    # --- Save predictions ---
    print(f"\nSaving predictions to {PREDICTIONS_OUTPUT}...")
    with open(PREDICTIONS_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(predictions, f, indent=2, ensure_ascii=False)

    # --- Save validation report ---
    report = {
        "metrics": metrics.model_dump(),
        "optimizer_winner": winner,
        "bootstrap_path": str(BOOTSTRAP_PATH),
        "mipro_path": str(MIPRO_PATH),
        "worst_10": accumulator.worst_n(10),
        "best_10": accumulator.best_n(10),
        "per_platform": accumulator.per_platform_scores(),
        "per_category": accumulator.per_category_scores(),
        "errors": errors,
    }

    print(f"Saving validation report to {REPORT_OUTPUT}...")
    with open(REPORT_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("\nDone.")
    return metrics


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    evaluate()
