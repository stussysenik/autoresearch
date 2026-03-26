"""
Energy Plots — time-series visualization for breaking physics and musicality.

Three main plot types:
- Multi-panel energy series (angular momentum, moment of inertia, angular
  velocity, CoM drift) with beat and phase overlays
- Musicality timeline (motion energy vs audio hotness, dual-axis)
- Comparison timeline (two dancers side-by-side or overlaid)

All functions save to PNG and return the output path.  Backend is 'Agg'
for headless execution.
"""
from __future__ import annotations

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from typing import Any, Dict, List, Optional, Tuple


# ── Colour palette ─────────────────────────────────────────────────────
_BG = "#1a1a2e"
_PANEL_BG = "#16213e"
_ACCENT = "#e94560"
_LINE_A = "#4ECDC4"   # teal
_LINE_B = "#FF6B6B"   # red
_LINE_C = "#FFE66D"   # yellow
_LINE_D = "#A8E6CF"   # mint
_BEAT_COLOR = "#ffffff"
_PHASE_COLORS = [
    "#FF6B6B33",  # red 20%
    "#4ECDC433",  # teal 20%
    "#FFE66D33",  # yellow 20%
    "#DDA0DD33",  # plum 20%
    "#A8E6CF33",  # mint 20%
]


def _apply_base_style() -> None:
    """Configure matplotlib for dark time-series plots."""
    plt.rcParams.update({
        "figure.facecolor": _BG,
        "axes.facecolor": _PANEL_BG,
        "text.color": "#e0e0e0",
        "axes.labelcolor": "#c0c0c0",
        "xtick.color": "#999",
        "ytick.color": "#999",
        "axes.edgecolor": "#444",
        "grid.color": "#333",
        "grid.alpha": 0.5,
        "figure.dpi": 150,
        "savefig.dpi": 150,
        "savefig.bbox": "tight",
        "savefig.facecolor": _BG,
        "font.size": 9,
    })


def _time_axis(n_frames: int, fps: float) -> np.ndarray:
    """Create a time axis in seconds from frame count and fps."""
    return np.arange(n_frames) / fps


def _add_beat_lines(ax: plt.Axes, beat_times: np.ndarray, alpha: float = 0.3) -> None:
    """Overlay vertical dashed lines at beat times."""
    for bt in beat_times:
        ax.axvline(bt, color=_BEAT_COLOR, linestyle="--", linewidth=0.5, alpha=alpha)


def _add_phase_bands(ax: plt.Axes, move_phases: List[Dict], t_max: float) -> None:
    """Add coloured background bands for move phases.

    Each phase dict should have:
    - ``start``: start time in seconds
    - ``end``: end time in seconds
    - ``label``: optional label string
    - ``type``: optional type for colour selection
    """
    for i, phase in enumerate(move_phases):
        start = phase.get("start", 0)
        end = phase.get("end", t_max)
        color = _PHASE_COLORS[i % len(_PHASE_COLORS)]
        ax.axvspan(start, end, facecolor=color, edgecolor="none")
        label = phase.get("label", "")
        if label:
            mid = (start + end) / 2.0
            ax.text(
                mid, ax.get_ylim()[1] * 0.95, label,
                ha="center", va="top", fontsize=6,
                color="#e0e0e0", alpha=0.7,
            )


# ────────────────────────────────────────────────────────────────────────
# Multi-panel energy series
# ────────────────────────────────────────────────────────────────────────


def plot_energy_series(
    data: Dict[str, np.ndarray],
    fps: float = 30.0,
    output: str = "energy_series.png",
    beat_times: Optional[np.ndarray] = None,
    move_phases: Optional[List[Dict]] = None,
) -> str:
    """Multi-panel time-series plot of rotational physics quantities.

    Renders up to four vertically stacked panels:
    1. Angular momentum L(t) — should be constant during clean spins
    2. Moment of inertia I(t) — shows the ice-skater effect
    3. Angular velocity omega(t) — inversely proportional to I(t)
    4. CoM drift / wobble — should be near zero for clean execution

    All panels share the time axis (bottom) and can have beat-line and
    move-phase overlays.

    Parameters
    ----------
    data : dict[str, np.ndarray]
        Keys may include: "angular_momentum", "moment_of_inertia",
        "angular_velocity", "com_drift".  Each value is a 1-D array
        of length T (one value per frame).
    fps : float
        Frames per second for time axis.
    output : str
        Output PNG path.
    beat_times : np.ndarray | None
        Beat onset times in seconds.
    move_phases : list[dict] | None
        Phase annotations with start, end, label, type.

    Returns
    -------
    str
        Output file path.
    """
    _apply_base_style()

    # Determine which panels to draw
    panel_defs = [
        ("angular_momentum", "Angular Momentum L(t)", _LINE_A, "L (kg m²/s)"),
        ("moment_of_inertia", "Moment of Inertia I(t)", _LINE_B, "I (kg m²)"),
        ("angular_velocity", "Angular Velocity ω(t)", _LINE_C, "ω (rad/s)"),
        ("com_drift", "CoM Drift / Wobble", _LINE_D, "Drift (m)"),
    ]
    active_panels = [(key, title, color, ylabel) for key, title, color, ylabel in panel_defs if key in data]

    if not active_panels:
        # Fall back: plot any arrays present in data
        for key, arr in data.items():
            if isinstance(arr, np.ndarray) and arr.ndim == 1:
                active_panels.append((key, key.replace("_", " ").title(), _LINE_A, key))
        if not active_panels:
            # Nothing to plot — create a placeholder
            fig, ax = plt.subplots(figsize=(12, 3))
            ax.text(0.5, 0.5, "No energy data available", ha="center", va="center",
                    fontsize=14, color="#888")
            ax.axis("off")
            fig.savefig(output)
            plt.close(fig)
            return output

    n_panels = len(active_panels)
    fig, axes = plt.subplots(n_panels, 1, figsize=(14, 3 * n_panels + 1), sharex=True)
    if n_panels == 1:
        axes = [axes]

    for idx, (key, title, color, ylabel) in enumerate(active_panels):
        ax = axes[idx]
        arr = data[key]
        t = _time_axis(len(arr), fps)

        ax.plot(t, arr, color=color, linewidth=1.2, alpha=0.9)
        ax.fill_between(t, arr, alpha=0.15, color=color)
        ax.set_ylabel(ylabel, fontsize=8)
        ax.set_title(title, fontsize=10, color=color, fontweight="bold", loc="left", pad=5)
        ax.grid(True, linewidth=0.3)

        # Overlays
        if beat_times is not None:
            _add_beat_lines(ax, beat_times)
        if move_phases is not None:
            _add_phase_bands(ax, move_phases, t[-1] if len(t) > 0 else 1.0)

        # Annotations for key physics events
        if key == "angular_momentum":
            # Annotate regions where L is roughly constant (clean spin)
            mean_l = np.mean(arr)
            std_l = np.std(arr)
            if std_l > 0:
                clean_mask = np.abs(arr - mean_l) < 0.5 * std_l
                # Find contiguous clean regions
                changes = np.diff(clean_mask.astype(int))
                starts = np.where(changes == 1)[0] + 1
                ends = np.where(changes == -1)[0] + 1
                if clean_mask[0]:
                    starts = np.concatenate([[0], starts])
                if clean_mask[-1]:
                    ends = np.concatenate([ends, [len(arr)]])
                for s, e in zip(starts, ends):
                    if (e - s) > fps * 0.5:  # Only annotate regions > 0.5s
                        ax.axvspan(t[s], t[min(e - 1, len(t) - 1)], alpha=0.08, color="#00ff00")

        elif key == "moment_of_inertia":
            # Mark tuck events (local minima) and extend events (local maxima)
            if len(arr) > int(fps * 0.3):
                window = max(3, int(fps * 0.3))
                from scipy.signal import argrelextrema
                try:
                    minima = argrelextrema(arr, np.less, order=window)[0]
                    maxima = argrelextrema(arr, np.greater, order=window)[0]
                    for m in minima[:5]:  # Limit annotations
                        ax.annotate(
                            "tuck", xy=(t[m], arr[m]),
                            xytext=(t[m], arr[m] - 0.1 * (np.max(arr) - np.min(arr))),
                            fontsize=6, color="#00ff00", alpha=0.7,
                            arrowprops=dict(arrowstyle="->", color="#00ff00", lw=0.5),
                        )
                    for m in maxima[:5]:
                        ax.annotate(
                            "extend", xy=(t[m], arr[m]),
                            xytext=(t[m], arr[m] + 0.1 * (np.max(arr) - np.min(arr))),
                            fontsize=6, color="#ff6b6b", alpha=0.7,
                            arrowprops=dict(arrowstyle="->", color="#ff6b6b", lw=0.5),
                        )
                except Exception:
                    pass  # Skip annotation if scipy not available or data too short

    axes[-1].set_xlabel("Time (s)", fontsize=10)
    fig.suptitle("Energy / Physics Time Series", fontsize=13, color=_ACCENT, fontweight="bold", y=1.01)
    fig.tight_layout()
    fig.savefig(output)
    plt.close(fig)
    return output


# ────────────────────────────────────────────────────────────────────────
# Musicality timeline
# ────────────────────────────────────────────────────────────────────────


def plot_musicality_timeline(
    motion_energy: np.ndarray,
    audio_hotness: np.ndarray,
    fps: float = 30.0,
    beat_times: Optional[np.ndarray] = None,
    output: str = "musicality.png",
) -> str:
    """Dual-axis plot showing motion energy M(t) vs audio hotness H(t).

    Highlights:
    - Sync moments: both M and H are above their respective medians
    - Missed opportunities: H is high but M is low (dancer not matching
      the music's energy)
    - Shows cross-correlation lag as an annotation

    Parameters
    ----------
    motion_energy : np.ndarray
        1-D array of motion energy values per frame.
    audio_hotness : np.ndarray
        1-D array of audio hotness values per frame (re-sampled to match
        the motion frame rate).
    fps : float
        Frames per second.
    beat_times : np.ndarray | None
        Beat onset times in seconds.
    output : str
        Output PNG path.

    Returns
    -------
    str
        Output file path.
    """
    _apply_base_style()

    # Align lengths
    min_len = min(len(motion_energy), len(audio_hotness))
    m = motion_energy[:min_len]
    h = audio_hotness[:min_len]
    t = _time_axis(min_len, fps)

    fig, ax1 = plt.subplots(figsize=(14, 5))

    # Motion energy (left axis)
    line_m, = ax1.plot(t, m, color=_LINE_A, linewidth=1.2, alpha=0.9, label="Motion Energy")
    ax1.fill_between(t, m, alpha=0.1, color=_LINE_A)
    ax1.set_xlabel("Time (s)", fontsize=10)
    ax1.set_ylabel("Motion Energy", color=_LINE_A, fontsize=10)
    ax1.tick_params(axis="y", labelcolor=_LINE_A)
    ax1.grid(True, linewidth=0.3)

    # Audio hotness (right axis)
    ax2 = ax1.twinx()
    line_h, = ax2.plot(t, h, color=_LINE_B, linewidth=1.2, alpha=0.9, label="Audio Hotness")
    ax2.fill_between(t, h, alpha=0.1, color=_LINE_B)
    ax2.set_ylabel("Audio Hotness", color=_LINE_B, fontsize=10)
    ax2.tick_params(axis="y", labelcolor=_LINE_B)

    # Highlight sync moments (both above median)
    m_med = np.median(m)
    h_med = np.median(h)
    sync_mask = (m > m_med) & (h > h_med)
    ax1.fill_between(
        t, 0, ax1.get_ylim()[1] if ax1.get_ylim()[1] > 0 else 1.0,
        where=sync_mask,
        alpha=0.08, color="#00ff00", label="Sync",
    )

    # Highlight missed opportunities (audio high, motion low)
    miss_mask = (h > h_med) & (m < m_med)
    ax1.fill_between(
        t, 0, ax1.get_ylim()[1] if ax1.get_ylim()[1] > 0 else 1.0,
        where=miss_mask,
        alpha=0.08, color="#ff0000", label="Missed",
    )

    # Beat lines
    if beat_times is not None:
        _add_beat_lines(ax1, beat_times, alpha=0.2)

    # Cross-correlation lag
    if min_len > 10:
        # Normalize both signals
        m_norm = (m - np.mean(m)) / (np.std(m) + 1e-8)
        h_norm = (h - np.mean(h)) / (np.std(h) + 1e-8)
        cross_corr = np.correlate(m_norm, h_norm, mode="full")
        lags = np.arange(-(min_len - 1), min_len) / fps
        best_lag_idx = np.argmax(cross_corr)
        best_lag = lags[best_lag_idx]
        best_corr = cross_corr[best_lag_idx] / min_len

        ax1.annotate(
            f"Lag: {best_lag:+.3f}s  r={best_corr:.2f}",
            xy=(0.02, 0.95), xycoords="axes fraction",
            fontsize=9, color="#FFE66D",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="#1a1a2e", edgecolor="#FFE66D", alpha=0.8),
        )

    ax1.set_title("Musicality Timeline", fontsize=13, color=_ACCENT, fontweight="bold", pad=12)

    # Combined legend
    lines = [line_m, line_h]
    labels = [l.get_label() for l in lines]
    # Add sync/miss patches
    lines.append(mpatches.Patch(facecolor="#00ff0020", edgecolor="none", label="Sync"))
    labels.append("Sync")
    lines.append(mpatches.Patch(facecolor="#ff000020", edgecolor="none", label="Missed"))
    labels.append("Missed")
    ax1.legend(
        lines, labels,
        loc="upper right",
        fontsize=7,
        framealpha=0.5,
        facecolor="#2a2a4e",
        edgecolor="#444",
        labelcolor="#e0e0e0",
    )

    fig.tight_layout()
    fig.savefig(output)
    plt.close(fig)
    return output


# ────────────────────────────────────────────────────────────────────────
# Comparison timeline
# ────────────────────────────────────────────────────────────────────────


def plot_comparison_timeline(
    data_a: Dict[str, np.ndarray],
    data_b: Dict[str, np.ndarray],
    labels: Tuple[str, str] = ("Dancer A", "Dancer B"),
    output: str = "comparison.png",
) -> str:
    """Side-by-side or overlaid time series for two dancers.

    For each shared key between data_a and data_b, renders an overlaid
    panel with highlighted regions where each dancer outperforms the other.

    Parameters
    ----------
    data_a, data_b : dict[str, np.ndarray]
        Per-dancer data dictionaries.  Shared keys produce overlaid panels.
    labels : tuple[str, str]
        Display names for each dancer.
    output : str
        Output PNG path.

    Returns
    -------
    str
        Output file path.
    """
    _apply_base_style()

    # Find shared keys with 1-D arrays
    shared_keys = []
    for key in data_a:
        if key in data_b:
            a_arr = data_a[key]
            b_arr = data_b[key]
            if isinstance(a_arr, np.ndarray) and a_arr.ndim == 1 and isinstance(b_arr, np.ndarray) and b_arr.ndim == 1:
                shared_keys.append(key)

    if not shared_keys:
        fig, ax = plt.subplots(figsize=(12, 3))
        ax.text(0.5, 0.5, "No shared data to compare", ha="center", va="center",
                fontsize=14, color="#888")
        ax.axis("off")
        fig.savefig(output)
        plt.close(fig)
        return output

    n_panels = len(shared_keys)
    fig, axes = plt.subplots(n_panels, 1, figsize=(14, 3 * n_panels + 1), sharex=True)
    if n_panels == 1:
        axes = [axes]

    fps = 30.0  # Default; callers should provide data at consistent fps

    for idx, key in enumerate(shared_keys):
        ax = axes[idx]
        a_arr = data_a[key]
        b_arr = data_b[key]

        min_len = min(len(a_arr), len(b_arr))
        a = a_arr[:min_len]
        b = b_arr[:min_len]
        t = _time_axis(min_len, fps)

        ax.plot(t, a, color=_LINE_A, linewidth=1.2, alpha=0.9, label=labels[0])
        ax.plot(t, b, color=_LINE_B, linewidth=1.2, alpha=0.9, label=labels[1])

        # Highlight where A > B (green tint) and B > A (red tint)
        a_wins = a > b
        b_wins = b > a
        y_max = max(np.max(a), np.max(b)) if min_len > 0 else 1.0
        y_min = min(np.min(a), np.min(b)) if min_len > 0 else 0.0
        ax.fill_between(t, y_min, y_max, where=a_wins, alpha=0.06, color=_LINE_A)
        ax.fill_between(t, y_min, y_max, where=b_wins, alpha=0.06, color=_LINE_B)

        title = key.replace("_", " ").title()
        ax.set_title(title, fontsize=10, color="#e0e0e0", fontweight="bold", loc="left", pad=5)
        ax.set_ylabel(key, fontsize=8)
        ax.grid(True, linewidth=0.3)
        ax.legend(fontsize=7, loc="upper right", framealpha=0.5,
                  facecolor="#2a2a4e", edgecolor="#444", labelcolor="#e0e0e0")

    axes[-1].set_xlabel("Time (s)", fontsize=10)
    fig.suptitle(
        f"Comparison: {labels[0]} vs {labels[1]}",
        fontsize=13, color=_ACCENT, fontweight="bold", y=1.01,
    )
    fig.tight_layout()
    fig.savefig(output)
    plt.close(fig)
    return output
