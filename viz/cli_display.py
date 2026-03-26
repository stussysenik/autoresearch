"""
CLI Display -- rich-powered terminal visualization for breaking analysis.

Renders analysis results directly in the terminal using Unicode sparklines,
colored bars, and structured tables. Each display function corresponds to
one of the four analysis modes (move_drill, battle_eval, musicality,
pattern_hunt). Export helpers dump results as JSON or CSV for downstream
tools.

Design notes
------------
- Sparklines use the 8-level Unicode block characters
- Color bars use rich Text markup to show proportional category segments
- All display functions are fault-tolerant: missing keys are skipped
  rather than crashing, so partial results still render
"""
from __future__ import annotations

import csv
import json
import math
from io import StringIO
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()

# Unicode block chars for sparklines (8 levels from low to high)
_SPARK_CHARS = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588"

# Color palette for move types (matches graph_plots.MOVE_COLORS)
_TYPE_COLORS = {
    "toprock": "red",
    "footwork": "cyan",
    "power": "yellow",
    "freeze": "green",
    "transition": "magenta",
    "unknown": "bright_black",
}


# --------------------------------------------------------------------
# Utility helpers
# --------------------------------------------------------------------


def sparkline(values: List[float], width: int = 40) -> str:
    """Convert a list of numeric values into a Unicode sparkline string.

    The input is re-sampled (nearest-neighbour) to ``width`` characters.
    Each character is one of the 8 block-element chars, linearly mapped
    from the value range. Constant series produce a mid-bar.

    Parameters
    ----------
    values : list[float]
        Raw signal of any length.
    width : int
        Target character count for the output string.

    Returns
    -------
    str
        A single-line Unicode sparkline.
    """
    if not values:
        return ""
    n = len(values)
    # Re-sample to target width via nearest-neighbour
    if n != width:
        indices = [int(i * n / width) for i in range(width)]
        values = [values[idx] for idx in indices]

    lo, hi = min(values), max(values)
    span = hi - lo
    if span == 0:
        # Constant signal: use mid-level bar
        return _SPARK_CHARS[3] * width

    result = []
    for v in values:
        # Map value to index 0..7
        idx = int((v - lo) / span * 7)
        idx = max(0, min(7, idx))
        result.append(_SPARK_CHARS[idx])
    return "".join(result)


def color_bar(segments: Dict[str, float], width: int = 40) -> Text:
    """Render a horizontal stacked bar of colored segments.

    Each segment gets a number of characters proportional to its value
    relative to the total. Colors are pulled from the move-type palette;
    unknown categories default to grey.

    Parameters
    ----------
    segments : dict[str, float]
        Category name -> numeric proportion (need not sum to 1).
    width : int
        Total character width of the bar.

    Returns
    -------
    rich.text.Text
        A styled Text object ready for console printing.
    """
    text = Text()
    if not segments:
        text.append("\u2591" * width, style="dim")
        return text

    total = sum(segments.values())
    if total == 0:
        text.append("\u2591" * width, style="dim")
        return text

    chars_used = 0
    items = list(segments.items())
    for i, (name, val) in enumerate(items):
        if i == len(items) - 1:
            # Last segment gets remaining chars to avoid rounding gaps
            n_chars = width - chars_used
        else:
            n_chars = max(1, round(val / total * width))
        chars_used += n_chars
        color = _TYPE_COLORS.get(name, "bright_black")
        text.append("\u2588" * n_chars, style=color)
    return text


# --------------------------------------------------------------------
# Display: move_drill
# --------------------------------------------------------------------


def display_move_drill(results: Dict[str, Any]) -> None:
    """Render move-drill analysis output in the terminal.

    Expects ``results`` with optional keys:
    - ``metrics``: dict of scalar name -> value
    - ``move_type_breakdown``: dict of type -> proportion
    - ``energy_series``: list[float] of kinetic energy over time
    - ``physics``: dict with angular_momentum, rotation_count, etc.
    - ``features``: dict of feature_name -> value
    - ``move_name``: human-readable label for the move being analysed
    """
    move_name = results.get("move_name", "Move Analysis")
    console.rule(f"[bold cyan]{move_name}[/bold cyan]")

    # Feature / metric table
    metrics = results.get("metrics", {})
    features = results.get("features", {})
    combined = {**features, **metrics}
    if combined:
        table = Table(title="Features & Metrics", show_header=True, header_style="bold magenta")
        table.add_column("Name", style="cyan", min_width=20)
        table.add_column("Value", justify="right", style="green")
        for name, val in combined.items():
            if isinstance(val, float):
                table.add_row(name, f"{val:.4f}")
            else:
                table.add_row(name, str(val))
        console.print(table)

    # Energy sparkline
    energy = results.get("energy_series", [])
    if energy:
        if isinstance(energy, np.ndarray):
            energy = energy.tolist()
        spark = sparkline(energy, width=60)
        panel = Panel(
            Text(spark, style="bold yellow"),
            title="Energy Over Time",
            subtitle=f"min={min(energy):.2f}  max={max(energy):.2f}",
            border_style="yellow",
        )
        console.print(panel)

    # Move type breakdown bar
    breakdown = results.get("move_type_breakdown", {})
    if breakdown:
        bar = color_bar(breakdown, width=60)
        legend_parts = []
        for name, val in breakdown.items():
            color = _TYPE_COLORS.get(name, "bright_black")
            legend_parts.append(f"[{color}]\u25a0[/{color}] {name}: {val:.0%}")
        legend = "  ".join(legend_parts)
        console.print(Panel(bar, title="Move Type Breakdown", border_style="blue"))
        console.print(f"  {legend}")

    # Physics metrics
    physics = results.get("physics", {})
    if physics:
        console.print()
        phys_table = Table(title="Physics", show_header=True, header_style="bold red")
        phys_table.add_column("Quantity", style="cyan", min_width=25)
        phys_table.add_column("Value", justify="right", style="green")
        for name, val in physics.items():
            if isinstance(val, (list, np.ndarray)):
                # Show sparkline for array-valued physics quantities
                arr = val if isinstance(val, list) else val.tolist()
                phys_table.add_row(name, sparkline(arr, width=30))
            elif isinstance(val, float):
                phys_table.add_row(name, f"{val:.4f}")
            else:
                phys_table.add_row(name, str(val))
        console.print(phys_table)

    console.print()


# --------------------------------------------------------------------
# Display: battle_eval
# --------------------------------------------------------------------


def display_battle_eval(results: Dict[str, Any]) -> None:
    """Side-by-side battle comparison display.

    Expects ``results`` with optional keys:
    - ``dancer_a``, ``dancer_b``: names (str)
    - ``scores_a``, ``scores_b``: dict of dimension -> float
    - ``winner``: "a" | "b" | "draw"
    - ``energy_a``, ``energy_b``: list[float] time series
    - ``dimensions``: list[str] of scoring dimensions
    """
    name_a = results.get("dancer_a", "Dancer A")
    name_b = results.get("dancer_b", "Dancer B")
    winner = results.get("winner", "")

    console.rule(f"[bold red]Battle: {name_a} vs {name_b}[/bold red]")

    scores_a = results.get("scores_a", {})
    scores_b = results.get("scores_b", {})
    dimensions = results.get(
        "dimensions",
        sorted(set(list(scores_a.keys()) + list(scores_b.keys()))),
    )

    if dimensions:
        table = Table(title="TRIVIUM Scores", show_header=True, header_style="bold white")
        table.add_column("Dimension", style="cyan", min_width=18)
        table.add_column(name_a, justify="center", min_width=10)
        table.add_column(name_b, justify="center", min_width=10)
        table.add_column("", justify="center", min_width=4)

        for dim in dimensions:
            sa = scores_a.get(dim, 0.0)
            sb = scores_b.get(dim, 0.0)
            # Winner indicator
            if sa > sb:
                indicator = "[green]\u2713[/green] / [red]\u2717[/red]"
                sa_str = f"[bold green]{sa:.2f}[/bold green]"
                sb_str = f"[dim]{sb:.2f}[/dim]"
            elif sb > sa:
                indicator = "[red]\u2717[/red] / [green]\u2713[/green]"
                sa_str = f"[dim]{sa:.2f}[/dim]"
                sb_str = f"[bold green]{sb:.2f}[/bold green]"
            else:
                indicator = "[yellow]=[/yellow]"
                sa_str = f"{sa:.2f}"
                sb_str = f"{sb:.2f}"
            table.add_row(dim, sa_str, sb_str, indicator)

        # Totals row
        total_a = sum(scores_a.get(d, 0.0) for d in dimensions)
        total_b = sum(scores_b.get(d, 0.0) for d in dimensions)
        table.add_section()
        if total_a > total_b:
            winner_label = f"[bold green]{name_a} wins[/bold green]"
        elif total_b > total_a:
            winner_label = f"[bold green]{name_b} wins[/bold green]"
        else:
            winner_label = "[bold yellow]Draw[/bold yellow]"
        table.add_row(
            "[bold]TOTAL[/bold]",
            f"[bold]{total_a:.2f}[/bold]",
            f"[bold]{total_b:.2f}[/bold]",
            winner_label,
        )
        console.print(table)

    # Differential sparklines
    energy_a = results.get("energy_a", [])
    energy_b = results.get("energy_b", [])
    if energy_a and energy_b:
        if isinstance(energy_a, np.ndarray):
            energy_a = energy_a.tolist()
        if isinstance(energy_b, np.ndarray):
            energy_b = energy_b.tolist()

        # Align lengths
        min_len = min(len(energy_a), len(energy_b))
        diff = [energy_a[i] - energy_b[i] for i in range(min_len)]
        spark_a = sparkline(energy_a, width=50)
        spark_b = sparkline(energy_b, width=50)
        spark_d = sparkline(diff, width=50)

        grid = Table.grid(padding=(0, 2))
        grid.add_column(min_width=12)
        grid.add_column(min_width=52)
        grid.add_row(f"[cyan]{name_a}[/cyan]", Text(spark_a, style="green"))
        grid.add_row(f"[cyan]{name_b}[/cyan]", Text(spark_b, style="red"))
        grid.add_row("[cyan]Diff (A-B)[/cyan]", Text(spark_d, style="yellow"))
        console.print(Panel(grid, title="Energy Timeline", border_style="magenta"))

    console.print()


# --------------------------------------------------------------------
# Display: musicality
# --------------------------------------------------------------------


def display_musicality(results: Dict[str, Any]) -> None:
    """Musicality analysis display.

    Expects ``results`` with optional keys:
    - ``beat_sync_score``: float 0-1
    - ``beat_sync_series``: list[float] per-beat sync quality
    - ``anticipation_ratio``: float, fraction of hits before the beat
    - ``reaction_ratio``: float, fraction of hits after the beat
    - ``phrasing_scores``: list[float] per-phrase quality
    - ``cross_correlation_lag``: float (seconds)
    - ``overall_musicality``: float 0-1
    """
    console.rule("[bold magenta]Musicality Analysis[/bold magenta]")

    # Summary metrics
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Metric", style="cyan", min_width=25)
    table.add_column("Value", justify="right", style="green")

    overall = results.get("overall_musicality")
    if overall is not None:
        table.add_row("Overall Musicality", f"{overall:.2%}")

    beat_sync = results.get("beat_sync_score")
    if beat_sync is not None:
        table.add_row("Beat Sync Score", f"{beat_sync:.2%}")

    lag = results.get("cross_correlation_lag")
    if lag is not None:
        table.add_row("Cross-correlation Lag", f"{lag:+.3f} s")

    console.print(table)

    # Beat sync sparkline
    sync_series = results.get("beat_sync_series", [])
    if sync_series:
        if isinstance(sync_series, np.ndarray):
            sync_series = sync_series.tolist()
        spark = sparkline(sync_series, width=60)
        console.print(
            Panel(
                Text(spark, style="bold magenta"),
                title="Beat Sync Over Time",
                subtitle=f"avg={sum(sync_series)/len(sync_series):.2%}",
                border_style="magenta",
            )
        )

    # Anticipation vs Reaction
    antic = results.get("anticipation_ratio", 0.0)
    react = results.get("reaction_ratio", 0.0)
    on_beat = max(0.0, 1.0 - antic - react)
    if antic > 0 or react > 0:
        bar = Text()
        denom = antic + on_beat + react
        total_w = 60
        n_antic = max(1, round(antic / denom * total_w)) if denom > 0 else 0
        n_on = max(1, round(on_beat / denom * total_w)) if denom > 0 else 0
        n_react = total_w - n_antic - n_on
        bar.append("\u2588" * n_antic, style="blue")
        bar.append("\u2588" * n_on, style="green")
        bar.append("\u2588" * max(0, n_react), style="red")
        console.print(
            Panel(
                bar,
                title="Timing Profile",
                subtitle=(
                    f"[blue]Anticipation {antic:.0%}[/blue]  "
                    f"[green]On-beat {on_beat:.0%}[/green]  "
                    f"[red]Reaction {react:.0%}[/red]"
                ),
                border_style="blue",
            )
        )

    # Phrasing quality timeline
    phrasing = results.get("phrasing_scores", [])
    if phrasing:
        if isinstance(phrasing, np.ndarray):
            phrasing = phrasing.tolist()
        spark = sparkline(phrasing, width=60)
        console.print(
            Panel(
                Text(spark, style="bold blue"),
                title="Phrasing Quality by Phrase",
                subtitle=f"phrases={len(phrasing)}  avg={sum(phrasing)/len(phrasing):.2%}",
                border_style="blue",
            )
        )

    console.print()


# --------------------------------------------------------------------
# Display: pattern_hunt
# --------------------------------------------------------------------


def display_pattern_hunt(results: Dict[str, Any]) -> None:
    """Pattern discovery display.

    Expects ``results`` with optional keys:
    - ``patterns``: list[dict] each with name, frequency, moves, confidence
    - ``clusters``: list[dict] each with cluster_id, members, centroid_label
    - ``signature_matrix``: list[list[float]] or np.ndarray (distance matrix)
    - ``labels``: list[str] for distance matrix rows/cols
    """
    console.rule("[bold green]Pattern Discovery[/bold green]")

    # Discovered patterns
    patterns = results.get("patterns", [])
    if patterns:
        table = Table(
            title=f"Discovered Patterns ({len(patterns)})",
            show_header=True,
            header_style="bold green",
        )
        table.add_column("#", style="dim", width=4)
        table.add_column("Pattern", style="cyan", min_width=20)
        table.add_column("Frequency", justify="right", style="yellow")
        table.add_column("Confidence", justify="right", style="green")
        table.add_column("Moves", style="white")

        for i, pat in enumerate(patterns, 1):
            name = pat.get("name", f"Pattern {i}")
            freq = pat.get("frequency", 0)
            conf = pat.get("confidence", 0.0)
            moves = pat.get("moves", [])
            moves_str = " -> ".join(moves) if isinstance(moves, list) else str(moves)
            table.add_row(str(i), name, str(freq), f"{conf:.2%}", moves_str)
        console.print(table)

    # Clusters
    clusters = results.get("clusters", [])
    if clusters:
        table = Table(
            title="Signature Clusters",
            show_header=True,
            header_style="bold yellow",
        )
        table.add_column("Cluster", style="yellow", width=10)
        table.add_column("Label", style="cyan", min_width=15)
        table.add_column("Members", style="white")
        table.add_column("Size", justify="right", style="green")

        for cl in clusters:
            cid = str(cl.get("cluster_id", "?"))
            label = cl.get("centroid_label", "unlabeled")
            members = cl.get("members", [])
            members_str = ", ".join(members[:8])
            if len(members) > 8:
                members_str += f" ... (+{len(members) - 8})"
            table.add_row(cid, label, members_str, str(len(members)))
        console.print(table)

    # Distance matrix preview
    sig_matrix = results.get("signature_matrix")
    labels = results.get("labels", [])
    if sig_matrix is not None:
        if isinstance(sig_matrix, np.ndarray):
            sig_matrix = sig_matrix.tolist()
        n = len(sig_matrix)
        max_show = min(n, 8)
        table = Table(
            title=f"Signature Distance Matrix ({n}x{n})",
            show_header=True,
            header_style="bold",
        )
        table.add_column("", style="cyan", width=12)
        for j in range(max_show):
            lbl = labels[j] if j < len(labels) else f"#{j}"
            table.add_column(lbl[:8], justify="right", width=8)

        for i in range(max_show):
            row_label = labels[i] if i < len(labels) else f"#{i}"
            cells = []
            for j in range(max_show):
                val = sig_matrix[i][j] if i < len(sig_matrix) and j < len(sig_matrix[i]) else 0
                if i == j:
                    cells.append("[dim]0.000[/dim]")
                elif val < 0.3:
                    cells.append(f"[green]{val:.3f}[/green]")
                elif val < 0.7:
                    cells.append(f"[yellow]{val:.3f}[/yellow]")
                else:
                    cells.append(f"[red]{val:.3f}[/red]")
            table.add_row(row_label[:12], *cells)

        if n > max_show:
            console.print(f"  [dim](showing {max_show}x{max_show} of {n}x{n})[/dim]")
        console.print(table)

    if not patterns and not clusters and sig_matrix is None:
        console.print("[dim]No patterns found.[/dim]")

    console.print()


# --------------------------------------------------------------------
# Export helpers
# --------------------------------------------------------------------


class _NumpyEncoder(json.JSONEncoder):
    """JSON encoder that converts numpy types to native Python types."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        return super().default(obj)


def export_json(results: Dict[str, Any], output_path: str) -> None:
    """Export results dict as JSON, converting numpy arrays to lists.

    Parameters
    ----------
    results : dict
        The analysis results dictionary.
    output_path : str
        File path for the JSON output.
    """
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2, cls=_NumpyEncoder)
    console.print(f"[green]JSON exported:[/green] {output_path}")


def export_csv(results: Dict[str, Any], output_path: str) -> None:
    """Export flat scalar metrics as CSV.

    Walks the results dict and collects all scalar values (int, float, str,
    bool) into a flat key-value CSV. Nested dicts are flattened with dot
    notation (e.g. ``physics.angular_momentum``).

    Parameters
    ----------
    results : dict
        The analysis results dictionary.
    output_path : str
        File path for the CSV output.
    """

    def _flatten(d: Dict[str, Any], prefix: str = "") -> List[Tuple[str, Any]]:
        """Recursively flatten dict to (dotted_key, scalar_value) pairs."""
        rows: List[Tuple[str, Any]] = []
        for k, v in d.items():
            full_key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                rows.extend(_flatten(v, full_key))
            elif isinstance(v, (int, float, str, bool)):
                rows.append((full_key, v))
            elif isinstance(v, (np.integer,)):
                rows.append((full_key, int(v)))
            elif isinstance(v, (np.floating,)):
                rows.append((full_key, float(v)))
        return rows

    flat = _flatten(results)
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["metric", "value"])
        for key, val in flat:
            writer.writerow([key, val])
    console.print(f"[green]CSV exported:[/green] {output_path}")
