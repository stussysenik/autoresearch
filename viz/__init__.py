"""
Viz — visualization layer for BRACE breaking analysis.

Provides three tiers of output:

1. **CLI display** (``cli_display``) — rich-powered terminal tables,
   sparklines, and colour bars for interactive exploration.
2. **Matplotlib plots** (``matrix_heatmaps``, ``graph_plots``,
   ``energy_plots``) — publication-quality PNGs of heatmaps, network
   graphs, and time series.
3. **Pitch export** (``pitch_export``) — multi-page dark-themed PDF
   assembling all visuals into a presentation-ready report.
"""

# ── CLI display ─────────────────────────────────────────────────────────
from viz.cli_display import (
    console,
    display_battle_eval,
    display_move_drill,
    display_musicality,
    display_pattern_hunt,
    sparkline,
    color_bar,
    export_csv,
    export_json,
)

# ── Matrix heatmaps ────────────────────────────────────────────────────
from viz.matrix_heatmaps import (
    plot_distance_matrix,
    plot_feature_correlation,
    plot_transition_matrix,
)

# ── Graph plots ─────────────────────────────────────────────────────────
from viz.graph_plots import (
    MOVE_COLORS,
    plot_battle_dag,
    plot_community_graph,
    plot_style_comparison,
    plot_transition_graph,
)

# ── Energy / time-series plots ──────────────────────────────────────────
from viz.energy_plots import (
    plot_comparison_timeline,
    plot_energy_series,
    plot_musicality_timeline,
)

# ── Pitch PDF export ───────────────────────────────────────────────────
from viz.pitch_export import export_pitch_pdf

__all__ = [
    # CLI
    "console",
    "display_move_drill",
    "display_battle_eval",
    "display_musicality",
    "display_pattern_hunt",
    "sparkline",
    "color_bar",
    "export_json",
    "export_csv",
    # Heatmaps
    "plot_distance_matrix",
    "plot_feature_correlation",
    "plot_transition_matrix",
    # Graphs
    "MOVE_COLORS",
    "plot_transition_graph",
    "plot_style_comparison",
    "plot_battle_dag",
    "plot_community_graph",
    # Energy
    "plot_energy_series",
    "plot_musicality_timeline",
    "plot_comparison_timeline",
    # PDF
    "export_pitch_pdf",
]
