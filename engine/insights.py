"""
Insights Agent — automatic data storytelling after analysis.

Reads engine results and produces human-readable narrative insights.
Can run standalone or be wired as a post-analysis hook.

Uses Claude CLI (`claude -p`) for narrative generation, falls back to
rule-based insights if CLI unavailable.

Usage:
    # After any analysis
    from engine.insights import generate_insights
    insights = generate_insights(ctx)
    print(insights)

    # Or from CLI
    python engine/insights.py overnight/batch_results/validation_report.txt
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np


def _try_claude_narrate(prompt: str, timeout: int = 30) -> Optional[str]:
    """Try to use Claude CLI for narrative generation."""
    try:
        result = subprocess.run(
            ["claude", "-p", prompt],
            capture_output=True, text=True, timeout=timeout,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return None


def _rule_based_insights(data: Dict[str, Any]) -> List[str]:
    """Generate insights from analysis results using rules."""
    insights = []

    # --- Transition graph insights ---
    transitions = data.get("transitions")
    if transitions:
        for from_move, targets in transitions.items():
            if targets:
                top_target, top_prob = targets[0]
                if top_prob > 0.5:
                    insights.append(
                        f"After {from_move}, dancers go to {top_target} "
                        f"{top_prob:.0%} of the time — this is a dominant pattern."
                    )

    # --- Signature discrimination ---
    disc_ratio = data.get("discrimination_ratio")
    if disc_ratio is not None:
        if disc_ratio > 1.5:
            insights.append(
                f"Move signatures clearly separate types (ratio {disc_ratio:.1f}x). "
                "The math is capturing real physical differences."
            )
        elif disc_ratio > 1.0:
            insights.append(
                f"Move signatures weakly separate types (ratio {disc_ratio:.1f}x). "
                "Detectable but needs stronger features."
            )
        else:
            insights.append(
                f"Move signatures don't yet separate types (ratio {disc_ratio:.1f}x). "
                "Individual variation dominates over move-type differences. "
                "Need to add structural features: is the body inverted? rotating? "
                "What's the contact pattern?"
            )

    # --- Physics insights ---
    physics = data.get("physics", {})
    peak_ke = physics.get("peak_kinetic_energy")
    mean_ke = physics.get("mean_kinetic_energy")
    if peak_ke and mean_ke and mean_ke > 0:
        burst_ratio = peak_ke / mean_ke
        if burst_ratio > 10:
            insights.append(
                f"Explosive movement detected — peak energy is {burst_ratio:.0f}x "
                f"the average. This dancer uses sharp bursts, not sustained flow."
            )
        elif burst_ratio > 5:
            insights.append(
                f"Dynamic range is strong ({burst_ratio:.0f}x peak/mean energy). "
                "Good mix of explosive and controlled movement."
            )

    peak_L = physics.get("peak_angular_momentum")
    mean_L = physics.get("mean_angular_momentum")
    if peak_L and mean_L and mean_L > 0:
        spin_ratio = peak_L / mean_L
        if spin_ratio > 5:
            insights.append(
                f"Strong rotational moments detected (peak/mean = {spin_ratio:.0f}x). "
                "Likely power moves or dynamic transitions with spins."
            )

    # --- Style insights ---
    style = data.get("style", {})
    mean_sim = style.get("mean_similarity")
    if mean_sim is not None:
        if mean_sim > 0.95:
            insights.append(
                "Dancers' styles are very similar in the graph metrics. "
                "This likely means the 3-category labels (toprock/power/footwork) "
                "are too coarse — sub-classification would reveal real style differences."
            )
        elif mean_sim < 0.7:
            insights.append(
                f"Wide style variation across dancers (mean similarity {mean_sim:.2f}). "
                "The graph captures genuine personal styles."
            )

    central_move = style.get("most_common_central")
    if central_move:
        insights.append(
            f"Most dancers' vocabulary revolves around {central_move} — "
            "it's the hub that connects different parts of their repertoire."
        )

    # --- Move-specific insights ---
    sigs = data.get("signatures", [])
    if sigs:
        # Find the most complex move
        most_complex = max(sigs, key=lambda s: s.get("complexity", 0))
        if most_complex.get("complexity", 0) > 0.9:
            insights.append(
                f"Highest complexity: {most_complex.get('type', 'unknown')} "
                f"({most_complex['complexity']:.3f}). "
                "High spectral complexity means diverse frequency content — "
                "the body is doing many different things simultaneously."
            )

        # Symmetry comparison
        sym_by_type = {}
        for s in sigs:
            t = s.get("type", "unknown")
            sym_by_type.setdefault(t, []).append(s.get("symmetry", 0))
        for t, syms in sym_by_type.items():
            mean_sym = np.mean(syms)
            if mean_sym > 0.7:
                insights.append(
                    f"{t.capitalize()} shows high bilateral symmetry ({mean_sym:.2f}) — "
                    "left and right sides move similarly. Expected for rotational moves."
                )
            elif mean_sym < 0.3:
                insights.append(
                    f"{t.capitalize()} is highly asymmetric ({mean_sym:.2f}) — "
                    "one side dominates. Could indicate a signature style or "
                    "a technique to work on."
                )

    return insights


def extract_data_from_context(ctx) -> Dict[str, Any]:
    """Extract structured data from an AnalysisContext for insight generation."""
    data = {}

    if hasattr(ctx, "results"):
        # Physics
        physics_result = ctx.results.get("physics")
        if physics_result:
            data["physics"] = dict(physics_result.metrics)

        # Motion
        motion_result = ctx.results.get("motion")
        if motion_result:
            data["motion"] = dict(motion_result.metrics)

    return data


def extract_data_from_report(report_path: str) -> Dict[str, Any]:
    """Parse a validation report text file into structured data."""
    data = {}
    lines = Path(report_path).read_text().splitlines()

    for i, line in enumerate(lines):
        # Transitions
        if "After toprock" in line or "After power" in line or "After footwork" in line:
            data.setdefault("transitions", {})
            parts = line.split("After ")[-1]
            move = parts.split(":")[0].strip()
            # Parse [(move, prob), ...]
            import re
            pairs = re.findall(r"\('(\w+)',\s*'([\d.]+)'\)", line)
            data["transitions"][move] = [(m, float(p)) for m, p in pairs]

        # Discrimination
        if "Discrimination ratio" in line:
            import re
            match = re.search(r"([\d.]+)x", line)
            if match:
                data["discrimination_ratio"] = float(match.group(1))

        # Physics
        if "peak_kinetic_energy:" in line:
            data.setdefault("physics", {})
            val = float(line.split(":")[-1].strip())
            data["physics"]["peak_kinetic_energy"] = val
        if "mean_kinetic_energy:" in line:
            data.setdefault("physics", {})
            val = float(line.split(":")[-1].strip())
            data["physics"]["mean_kinetic_energy"] = val
        if "peak_angular_momentum:" in line:
            data.setdefault("physics", {})
            val = float(line.split(":")[-1].strip())
            data["physics"]["peak_angular_momentum"] = val
        if "mean_angular_momentum:" in line:
            data.setdefault("physics", {})
            val = float(line.split(":")[-1].strip())
            data["physics"]["mean_angular_momentum"] = val

        # Signatures
        if "complexity=" in line and "smoothness=" in line:
            data.setdefault("signatures", [])
            import re
            # Extract move type from lines like "    toprock [0:232] (232 frames): complexity=..."
            parts = line.strip().split("[")[0].strip().split() if "[" in line else []
            move_type = parts[-1] if parts else "unknown"
            c_match = re.search(r"complexity=([\d.]+)", line)
            s_match = re.search(r"smoothness=([-\d.]+)", line)
            y_match = re.search(r"symmetry=([\d.]+)", line)
            if c_match and s_match and y_match:
                data["signatures"].append({
                    "type": move_type,
                    "complexity": float(c_match.group(1)),
                    "smoothness": float(s_match.group(1)),
                    "symmetry": float(y_match.group(1)),
                })

        # Style
        if "Mean similarity:" in line:
            data.setdefault("style", {})
            data["style"]["mean_similarity"] = float(line.split(":")[-1].strip())
        if "Most common central move:" in line:
            import re
            match = re.search(r"\('(\w+)'", line)
            if match:
                data.setdefault("style", {})
                data["style"]["most_common_central"] = match.group(1)

    return data


def generate_insights(source, use_llm: bool = True) -> str:
    """Generate insights from analysis results.

    source can be:
    - An AnalysisContext (from engine.analyze())
    - A path to a validation report text file
    - A dict of pre-extracted data
    """
    # Extract structured data
    if isinstance(source, dict):
        data = source
    elif isinstance(source, str) or isinstance(source, Path):
        data = extract_data_from_report(str(source))
    else:
        data = extract_data_from_context(source)

    # Rule-based insights (always available)
    rule_insights = _rule_based_insights(data)

    # Try LLM narration for richer storytelling
    llm_narrative = None
    if use_llm and rule_insights:
        prompt = (
            "You are a breaking (bboy) dance analytics expert. "
            "Given these analysis findings, write 3-5 sentences of insight "
            "that would help a bboy, judge, or commentator understand what's happening. "
            "Be specific about what the numbers mean for the dancer. "
            "Don't repeat the numbers — explain what they MEAN.\n\n"
            f"Findings:\n" + "\n".join(f"- {i}" for i in rule_insights)
        )
        llm_narrative = _try_claude_narrate(prompt)

    # Compose output
    output_lines = ["## Insights\n"]

    if llm_narrative:
        output_lines.append(llm_narrative)
        output_lines.append("\n\n### Raw Findings\n")

    for insight in rule_insights:
        output_lines.append(f"- {insight}")

    if not rule_insights:
        output_lines.append("- No significant patterns detected in this analysis.")

    return "\n".join(output_lines)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        source = sys.argv[1]
        print(generate_insights(source, use_llm="--no-llm" not in sys.argv))
    else:
        print("Usage: python engine/insights.py <report_or_json_path> [--no-llm]")
        print("  Reads analysis results and generates human-readable insights.")
