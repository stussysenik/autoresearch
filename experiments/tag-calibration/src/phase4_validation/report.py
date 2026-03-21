"""
Phase 4 — Report: generate ANALYSIS.md from validation results.

Reads the validation report JSON produced by ``evaluate.py`` and renders a
human-readable Markdown report with metric summaries, per-platform and
per-category breakdowns, worst/best card examples, and an optimizer
recommendation.

Usage:
    python -m src.phase4_validation.report
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from src.config import DATA_DIR

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPORT_INPUT = DATA_DIR / "validation_report.json"
ANALYSIS_OUTPUT = Path(__file__).parent.parent.parent / "ANALYSIS.md"

# Target thresholds for the summary table
TARGETS = {
    "micro_f1": 0.70,
    "macro_f1": 0.65,
    "exact_match_rate": 0.30,
    "taxonomy_adherence": 0.95,
    "style_coverage": 0.80,
    "blocked_tag_rate": 0.02,  # lower is better
}


# ---------------------------------------------------------------------------
# Markdown helpers
# ---------------------------------------------------------------------------

def _status_emoji(metric: str, value: float) -> str:
    """Return a pass/fail indicator for a metric relative to its target.

    Uses plain text markers instead of emoji for maximum compatibility.
    """
    target = TARGETS.get(metric)
    if target is None:
        return ""

    # For blocked_tag_rate, lower is better
    if metric == "blocked_tag_rate":
        return "PASS" if value <= target else "FAIL"
    return "PASS" if value >= target else "FAIL"


def _fmt_pct(value: float) -> str:
    """Format a 0-1 float as a percentage string."""
    return f"{value * 100:.1f}%"


def _fmt_f1(value: float) -> str:
    """Format an F1 score to 4 decimal places."""
    return f"{value:.4f}"


# ---------------------------------------------------------------------------
# Report sections
# ---------------------------------------------------------------------------

def _section_summary(metrics: dict) -> str:
    """Build the summary metrics table."""
    rows = [
        ("Micro F1", "micro_f1", _fmt_f1),
        ("Macro F1", "macro_f1", _fmt_f1),
        ("Exact Match Rate", "exact_match_rate", _fmt_pct),
        ("Taxonomy Adherence", "taxonomy_adherence", _fmt_pct),
        ("Style Coverage", "style_coverage", _fmt_pct),
        ("Blocked Tag Rate", "blocked_tag_rate", _fmt_pct),
    ]

    lines = [
        "## Summary Metrics",
        "",
        f"**Total cards evaluated:** {metrics.get('total_cards', 0)}",
        "",
        "| Metric | Value | Target | Status |",
        "|--------|-------|--------|--------|",
    ]

    for label, key, fmt in rows:
        value = metrics.get(key, 0.0)
        target = TARGETS.get(key)
        target_str = _fmt_pct(target) if key in ("exact_match_rate", "taxonomy_adherence",
                                                   "style_coverage", "blocked_tag_rate") else _fmt_f1(target) if target else "—"

        # Adjust target display for blocked_tag_rate (lower is better)
        if key == "blocked_tag_rate":
            target_str = f"<= {target_str}"

        status = _status_emoji(key, value)
        lines.append(f"| {label} | {fmt(value)} | {target_str} | {status} |")

    return "\n".join(lines)


def _section_platform(per_platform: dict) -> str:
    """Build the per-platform breakdown table."""
    if not per_platform:
        return "## Per-Platform Breakdown\n\nNo platform data available."

    lines = [
        "## Per-Platform Breakdown",
        "",
        "| Platform | Mean F1 | Cards |",
        "|----------|---------|-------|",
    ]

    for platform, score in sorted(per_platform.items(), key=lambda x: -x[1]):
        # Score might be a float directly or could be more complex
        if isinstance(score, dict):
            f1 = score.get("mean_f1", 0.0)
            count = int(score.get("count", 0))
        else:
            f1 = float(score)
            count = "—"
        lines.append(f"| {platform} | {_fmt_f1(f1)} | {count} |")

    return "\n".join(lines)


def _section_category(per_category: dict) -> str:
    """Build the per-category breakdown table."""
    if not per_category:
        return "## Per-Category Breakdown\n\nNo category data available."

    lines = [
        "## Per-Category Breakdown",
        "",
        "| Category | Mean F1 | Cards |",
        "|----------|---------|-------|",
    ]

    for cat_name, data in sorted(per_category.items()):
        if isinstance(data, dict):
            f1 = data.get("mean_f1", 0.0)
            count = int(data.get("count", 0))
        else:
            f1 = float(data)
            count = "—"
        lines.append(f"| {cat_name} | {_fmt_f1(f1)} | {count} |")

    return "\n".join(lines)


def _section_worst(worst: list[dict], n: int = 10) -> str:
    """Build the worst-N cards table for debugging."""
    if not worst:
        return "## Worst Cards\n\nNo data available."

    lines = [
        f"## Worst {n} Cards",
        "",
        "Cards with the lowest F1 scores, useful for debugging tagging failures.",
        "",
        "| # | Card ID | Platform | F1 | Adherence | Predicted | Gold |",
        "|---|---------|----------|----|-----------|-----------|------|",
    ]

    for i, card in enumerate(worst[:n], 1):
        card_id = card.get("card_id", "?")
        platform = card.get("platform", "?")
        f1 = card.get("f1", 0.0)
        adherence = card.get("adherence", 0.0)
        predicted = ", ".join(card.get("predicted", [])[:5])
        gold = ", ".join(card.get("gold", [])[:5])

        # Truncate long tag lists
        if len(card.get("predicted", [])) > 5:
            predicted += ", ..."
        if len(card.get("gold", [])) > 5:
            gold += ", ..."

        lines.append(
            f"| {i} | `{card_id[:12]}` | {platform} | {_fmt_f1(f1)} | "
            f"{_fmt_pct(adherence)} | {predicted} | {gold} |"
        )

    return "\n".join(lines)


def _section_best(best: list[dict], n: int = 10) -> str:
    """Build the best-N cards table for showcase."""
    if not best:
        return "## Best Cards\n\nNo data available."

    lines = [
        f"## Best {n} Cards",
        "",
        "Cards with the highest F1 scores, showcasing optimal tagging.",
        "",
        "| # | Card ID | Platform | F1 | Predicted | Gold |",
        "|---|---------|----------|----|-----------|------|",
    ]

    for i, card in enumerate(best[:n], 1):
        card_id = card.get("card_id", "?")
        platform = card.get("platform", "?")
        f1 = card.get("f1", 0.0)
        predicted = ", ".join(card.get("predicted", [])[:5])
        gold = ", ".join(card.get("gold", [])[:5])

        if len(card.get("predicted", [])) > 5:
            predicted += ", ..."
        if len(card.get("gold", [])) > 5:
            gold += ", ..."

        lines.append(
            f"| {i} | `{card_id[:12]}` | {platform} | {_fmt_f1(f1)} | "
            f"{predicted} | {gold} |"
        )

    return "\n".join(lines)


def _section_recommendation(report: dict) -> str:
    """Build the optimizer recommendation section."""
    winner = report.get("optimizer_winner", "unknown")
    metrics = report.get("metrics", {})

    lines = [
        "## Optimizer Recommendation",
        "",
    ]

    # Try to extract both scores from the report paths
    bootstrap_path = report.get("bootstrap_path", "")
    mipro_path = report.get("mipro_path", "")

    # Load scores if the files exist
    bootstrap_score = None
    mipro_score = None
    try:
        if bootstrap_path and Path(bootstrap_path).exists():
            bs_data = json.loads(Path(bootstrap_path).read_text(encoding="utf-8"))
            bootstrap_score = bs_data.get("score")
    except Exception:
        pass

    try:
        if mipro_path and Path(mipro_path).exists():
            mp_data = json.loads(Path(mipro_path).read_text(encoding="utf-8"))
            mipro_score = mp_data.get("score")
    except Exception:
        pass

    lines.append(f"**Winning optimizer:** {winner.upper()}")
    lines.append("")

    if bootstrap_score is not None and mipro_score is not None:
        diff = abs(bootstrap_score - mipro_score)
        lines.append(f"| Optimizer | Validation Score |")
        lines.append(f"|-----------|-----------------|")
        lines.append(f"| Bootstrap | {bootstrap_score:.4f} |")
        lines.append(f"| MIPRO     | {mipro_score:.4f} |")
        lines.append(f"")
        lines.append(f"**Margin:** {diff:.4f} ({diff * 100:.1f} percentage points)")
    elif bootstrap_score is not None:
        lines.append(f"Bootstrap score: {bootstrap_score:.4f}")
        lines.append("MIPRO: not available")
    elif mipro_score is not None:
        lines.append("Bootstrap: not available")
        lines.append(f"MIPRO score: {mipro_score:.4f}")
    else:
        lines.append(f"Optimizer scores not available from saved files. "
                      f"Winner was determined during evaluation.")

    lines.append("")
    lines.append(f"The {winner} optimizer was used for the full validation run above, "
                 f"achieving a macro F1 of **{_fmt_f1(metrics.get('macro_f1', 0.0))}** "
                 f"across **{metrics.get('total_cards', 0)}** cards.")

    return "\n".join(lines)


def _section_errors(errors: list[dict]) -> str:
    """Build the errors section, if any."""
    if not errors:
        return ""

    lines = [
        "## Evaluation Errors",
        "",
        f"{len(errors)} card(s) failed during evaluation:",
        "",
    ]

    for err in errors[:20]:  # Cap at 20 to keep the report readable
        lines.append(f"- `{err.get('card_id', '?')}`: {err.get('error', 'unknown')}")

    if len(errors) > 20:
        lines.append(f"- ... and {len(errors) - 20} more")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main report generation
# ---------------------------------------------------------------------------

def generate_report() -> Path:
    """Generate ANALYSIS.md from the validation report JSON.

    Reads ``data/validation_report.json`` and writes a comprehensive Markdown
    report to ``ANALYSIS.md`` in the experiment root directory.

    Returns:
        Path to the generated ANALYSIS.md file.
    """
    print("=" * 60)
    print("Phase 4 — Report Generation")
    print("=" * 60)

    print(f"\nLoading validation report from {REPORT_INPUT}...")
    raw = json.loads(REPORT_INPUT.read_text(encoding="utf-8"))

    metrics = raw.get("metrics", {})
    per_platform = raw.get("per_platform", {})
    per_category = raw.get("per_category", {})
    worst_10 = raw.get("worst_10", [])
    best_10 = raw.get("best_10", [])
    errors = raw.get("errors", [])

    # --- Assemble report ---
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    sections = [
        f"# Tag Calibration — Validation Report",
        "",
        f"Generated: {timestamp}",
        "",
        "---",
        "",
        _section_summary(metrics),
        "",
        "---",
        "",
        _section_platform(per_platform),
        "",
        "---",
        "",
        _section_category(per_category),
        "",
        "---",
        "",
        _section_worst(worst_10),
        "",
        "---",
        "",
        _section_best(best_10),
        "",
        "---",
        "",
        _section_recommendation(raw),
    ]

    # Only add errors section if there were errors
    error_section = _section_errors(errors)
    if error_section:
        sections.extend(["", "---", "", error_section])

    sections.append("")  # trailing newline

    report_md = "\n".join(sections)

    # --- Write ---
    print(f"Writing report to {ANALYSIS_OUTPUT}...")
    ANALYSIS_OUTPUT.write_text(report_md, encoding="utf-8")

    # --- Print summary to console ---
    total = metrics.get("total_cards", 0)
    passing = sum(
        1 for metric, target in TARGETS.items()
        if (metric == "blocked_tag_rate" and metrics.get(metric, 1.0) <= target)
        or (metric != "blocked_tag_rate" and metrics.get(metric, 0.0) >= target)
    )
    total_targets = len(TARGETS)

    print(f"\nReport written. {passing}/{total_targets} targets passing across {total} cards.")
    print(f"  -> {ANALYSIS_OUTPUT}")
    print("\nDone.")

    return ANALYSIS_OUTPUT


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    generate_report()
