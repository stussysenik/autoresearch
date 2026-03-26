"""
Pitch Export — multi-page PDF generation for breaking analysis presentations.

Produces a dark-themed, presentation-ready PDF with:
- Title page with analysis metadata
- Score breakdown (radar chart or horizontal bars)
- Signature analysis (distance matrix or feature comparison)
- Graph visualization (transition network or style comparison)
- Time series (energy, musicality, or momentum)

Uses a consistent visual language: dark background (#1a1a2e), accent colour
(#e94560), clean typography, page numbers, and branding footer.

All figure-producing functions in this module save intermediate PNGs and
embed them into the final PDF.  The matplotlib backend is forced to 'Agg'.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.patches as mpatches
import numpy as np


# ── Theme constants ────────────────────────────────────────────────────
_BG = "#1a1a2e"
_PANEL_BG = "#16213e"
_ACCENT = "#e94560"
_TEXT = "#e0e0e0"
_SUBTEXT = "#999999"
_FOOTER = "BRACE Breaking Analysis"


# ────────────────────────────────────────────────────────────────────────
# Style setup
# ────────────────────────────────────────────────────────────────────────


def _setup_dark_style() -> None:
    """Configure matplotlib rcParams for the dark presentation theme."""
    plt.rcParams.update({
        "figure.facecolor": _BG,
        "axes.facecolor": _PANEL_BG,
        "text.color": _TEXT,
        "axes.labelcolor": _TEXT,
        "xtick.color": _SUBTEXT,
        "ytick.color": _SUBTEXT,
        "axes.edgecolor": "#444",
        "grid.color": "#333",
        "grid.alpha": 0.5,
        "figure.dpi": 150,
        "savefig.dpi": 150,
        "savefig.bbox": "tight",
        "savefig.facecolor": _BG,
        "font.family": "sans-serif",
        "font.size": 10,
    })


def _add_page_footer(fig: plt.Figure, page_num: int, total_pages: int) -> None:
    """Add page number and branding footer to a figure."""
    fig.text(
        0.5, 0.02,
        f"{_FOOTER}  |  Page {page_num}/{total_pages}",
        ha="center", va="bottom",
        fontsize=7, color=_SUBTEXT, alpha=0.6,
    )


# ────────────────────────────────────────────────────────────────────────
# Page builders
# ────────────────────────────────────────────────────────────────────────


def _add_title_page(
    pdf: PdfPages,
    title: str,
    subtitle: str,
    metadata: Dict[str, Any],
    page_num: int,
    total_pages: int,
) -> None:
    """Add a title page with analysis metadata.

    The title is rendered large and centred, with a subtitle and a table
    of metadata key-value pairs below.
    """
    fig = plt.figure(figsize=(11, 8.5))
    fig.set_facecolor(_BG)

    # Title
    fig.text(
        0.5, 0.70,
        title,
        ha="center", va="center",
        fontsize=28, fontweight="bold",
        color=_ACCENT,
    )

    # Subtitle
    fig.text(
        0.5, 0.60,
        subtitle,
        ha="center", va="center",
        fontsize=14,
        color=_TEXT,
    )

    # Accent line
    line_ax = fig.add_axes([0.25, 0.56, 0.5, 0.005])
    line_ax.set_facecolor(_ACCENT)
    line_ax.set_xticks([])
    line_ax.set_yticks([])
    for spine in line_ax.spines.values():
        spine.set_visible(False)

    # Metadata table
    if metadata:
        y_start = 0.48
        for i, (key, val) in enumerate(metadata.items()):
            y = y_start - i * 0.04
            if y < 0.15:
                break
            fig.text(0.35, y, str(key) + ":", ha="right", va="center",
                     fontsize=10, color=_SUBTEXT)
            fig.text(0.37, y, str(val), ha="left", va="center",
                     fontsize=10, color=_TEXT)

    # Date
    fig.text(
        0.5, 0.10,
        datetime.now().strftime("%Y-%m-%d %H:%M"),
        ha="center", va="center",
        fontsize=9, color=_SUBTEXT,
    )

    _add_page_footer(fig, page_num, total_pages)
    pdf.savefig(fig)
    plt.close(fig)


def _add_score_page(
    pdf: PdfPages,
    scores: Dict[str, float],
    title: str,
    page_num: int,
    total_pages: int,
) -> None:
    """Add a page with score breakdown visualization.

    If there are 3+ dimensions, renders a radar (spider) chart.
    Otherwise falls back to a horizontal bar chart.
    """
    fig = plt.figure(figsize=(11, 8.5))
    fig.set_facecolor(_BG)

    labels = list(scores.keys())
    values = list(scores.values())
    n = len(labels)

    if n >= 3:
        # ── Radar chart ────────────────────────────────────────────────
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
        # Close the polygon
        values_closed = values + [values[0]]
        angles_closed = angles + [angles[0]]

        ax = fig.add_subplot(111, polar=True)
        ax.set_facecolor(_PANEL_BG)

        ax.fill(angles_closed, values_closed, color=_ACCENT, alpha=0.25)
        ax.plot(angles_closed, values_closed, color=_ACCENT, linewidth=2)
        ax.scatter(angles, values, color=_ACCENT, s=60, zorder=5, edgecolors="white", linewidths=0.5)

        ax.set_xticks(angles)
        ax.set_xticklabels(labels, fontsize=9, color=_TEXT)

        # Value annotations
        for angle, val, label in zip(angles, values, labels):
            ax.annotate(
                f"{val:.2f}",
                xy=(angle, val),
                xytext=(angle, val + max(values) * 0.08),
                fontsize=8, ha="center", color=_ACCENT,
            )

        # Set radial limits
        max_val = max(values) if values else 1.0
        ax.set_ylim(0, max_val * 1.15)
        ax.set_title(title, fontsize=14, color=_ACCENT, fontweight="bold", pad=20)

        # Style the grid
        ax.grid(True, color="#444", linewidth=0.3)
        ax.spines["polar"].set_color("#444")

    else:
        # ── Horizontal bar chart ───────────────────────────────────────
        ax = fig.add_subplot(111)
        y_pos = np.arange(n)
        bars = ax.barh(y_pos, values, color=_ACCENT, alpha=0.8, height=0.6, edgecolor="#444")
        ax.set_yticks(y_pos)
        ax.set_yticklabels(labels, fontsize=11, color=_TEXT)
        ax.set_xlabel("Score", fontsize=10, color=_TEXT)
        ax.set_title(title, fontsize=14, color=_ACCENT, fontweight="bold", pad=15)
        ax.grid(axis="x", linewidth=0.3)

        # Value labels on bars
        for bar, val in zip(bars, values):
            ax.text(
                bar.get_width() + max(values) * 0.02,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.2f}",
                va="center", fontsize=10, color=_TEXT,
            )

    _add_page_footer(fig, page_num, total_pages)
    pdf.savefig(fig)
    plt.close(fig)


def _add_figure_page(
    pdf: PdfPages,
    fig_path: str,
    caption: str,
    page_num: int,
    total_pages: int,
) -> None:
    """Add a page containing a previously rendered figure image with caption.

    The image is loaded and displayed using imshow to fill the page.
    """
    fig = plt.figure(figsize=(11, 8.5))
    fig.set_facecolor(_BG)

    if os.path.exists(fig_path):
        img = plt.imread(fig_path)
        ax = fig.add_axes([0.05, 0.08, 0.9, 0.82])
        ax.imshow(img)
        ax.axis("off")
    else:
        ax = fig.add_axes([0.05, 0.08, 0.9, 0.82])
        ax.text(
            0.5, 0.5, f"Figure not found:\n{fig_path}",
            ha="center", va="center", fontsize=12, color="#888",
        )
        ax.set_facecolor(_PANEL_BG)
        ax.axis("off")

    # Caption
    fig.text(
        0.5, 0.04,
        caption,
        ha="center", va="center",
        fontsize=10, color=_TEXT, style="italic",
    )

    _add_page_footer(fig, page_num, total_pages)
    pdf.savefig(fig)
    plt.close(fig)


def _add_text_summary_page(
    pdf: PdfPages,
    summary_lines: List[str],
    title: str,
    page_num: int,
    total_pages: int,
) -> None:
    """Add a text-based summary page with bullet points."""
    fig = plt.figure(figsize=(11, 8.5))
    fig.set_facecolor(_BG)

    fig.text(
        0.5, 0.90,
        title,
        ha="center", va="center",
        fontsize=16, fontweight="bold",
        color=_ACCENT,
    )

    y = 0.82
    for line in summary_lines:
        if y < 0.1:
            break
        fig.text(0.10, y, f"  {line}", ha="left", va="center",
                 fontsize=11, color=_TEXT)
        y -= 0.04

    _add_page_footer(fig, page_num, total_pages)
    pdf.savefig(fig)
    plt.close(fig)


# ────────────────────────────────────────────────────────────────────────
# Main export function
# ────────────────────────────────────────────────────────────────────────


def export_pitch_pdf(
    results: Dict[str, Any],
    output: str = "pitch.pdf",
    title: str = "Breaking Analysis Report",
) -> str:
    """Generate a presentation-ready multi-page PDF.

    Assembles up to 5 pages depending on available data:

    1. **Title page** — analysis mode, dancer info, date
    2. **Score breakdown** — TRIVIUM dimensions or physics metrics as a
       radar/bar chart
    3. **Signature analysis** — distance matrix or feature comparison
       (embeds a pre-rendered PNG)
    4. **Graph visualization** — transition network or style comparison
       (embeds a pre-rendered PNG)
    5. **Time series** — energy, musicality, or momentum
       (embeds a pre-rendered PNG)

    Parameters
    ----------
    results : dict
        Analysis results.  Recognised keys:

        - ``mode``: str — analysis mode name
        - ``dancer_a``, ``dancer_b``: str — dancer names
        - ``scores``: dict[str, float] — dimension scores
        - ``metrics``: dict[str, float] — flat scalar metrics
        - ``figure_paths``: dict[str, str] — {name: png_path} for
          pre-rendered figures to embed
        - ``summary_lines``: list[str] — bullet-point text summary
    output : str
        Output PDF path.
    title : str
        Report title for the cover page.

    Returns
    -------
    str
        Output file path.
    """
    _setup_dark_style()

    # Determine how many pages we'll produce
    mode = results.get("mode", "analysis")
    scores = results.get("scores", results.get("metrics", {}))
    figure_paths = results.get("figure_paths", {})
    summary_lines = results.get("summary_lines", [])

    # Count pages
    pages: List[str] = ["title"]  # Always a title page
    if scores:
        pages.append("scores")
    # Add a page for each figure
    for fig_name in figure_paths:
        pages.append(f"fig:{fig_name}")
    if summary_lines:
        pages.append("summary")
    total_pages = len(pages)

    with PdfPages(output) as pdf:
        page_idx = 0

        # ── Page 1: Title ──────────────────────────────────────────────
        metadata = {}
        metadata["Mode"] = mode
        dancer_a = results.get("dancer_a", "")
        dancer_b = results.get("dancer_b", "")
        if dancer_a:
            metadata["Dancer A"] = dancer_a
        if dancer_b:
            metadata["Dancer B"] = dancer_b
        metadata["Generated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Add any extra metadata from results
        for key in ("fps", "duration", "n_frames", "n_moves"):
            if key in results:
                metadata[key.replace("_", " ").title()] = results[key]

        subtitle = f"{mode.replace('_', ' ').title()} Analysis"
        page_idx += 1
        _add_title_page(pdf, title, subtitle, metadata, page_idx, total_pages)

        # ── Page 2: Scores ─────────────────────────────────────────────
        if scores:
            page_idx += 1
            score_title = "Score Breakdown"
            if mode == "battle_eval":
                score_title = "TRIVIUM Battle Scores"
            elif mode == "move_drill":
                score_title = "Move Analysis Metrics"
            _add_score_page(pdf, scores, score_title, page_idx, total_pages)

        # ── Pages 3-5: Figures ─────────────────────────────────────────
        # Pre-defined figure slots with captions
        figure_slots = [
            ("distance_matrix", "Signature Distance Matrix — hierarchical clustering of move similarity"),
            ("correlation", "Feature Correlation — inter-feature relationships"),
            ("transition_graph", "Move Transition Network — sequential flow between move types"),
            ("style_comparison", "Style Comparison — transition patterns by dancer"),
            ("energy_series", "Energy / Physics Time Series — rotational dynamics"),
            ("musicality", "Musicality Timeline — motion-audio synchronisation"),
            ("comparison", "Dancer Comparison — overlaid time series"),
            ("battle_flow", "Battle Flow — hierarchical DAG"),
            ("communities", "Community Structure — move clusters"),
            ("transition_matrix", "Transition Probability Matrix"),
        ]

        for fig_name, default_caption in figure_slots:
            if fig_name in figure_paths:
                page_idx += 1
                caption = default_caption
                _add_figure_page(pdf, figure_paths[fig_name], caption, page_idx, total_pages)

        # Also handle any custom figure paths not in the predefined slots
        known_names = {name for name, _ in figure_slots}
        for fig_name, fig_path in figure_paths.items():
            if fig_name not in known_names:
                page_idx += 1
                caption = fig_name.replace("_", " ").title()
                _add_figure_page(pdf, fig_path, caption, page_idx, total_pages)

        # ── Summary page ───────────────────────────────────────────────
        if summary_lines:
            page_idx += 1
            _add_text_summary_page(pdf, summary_lines, "Analysis Summary", page_idx, total_pages)

    return output
