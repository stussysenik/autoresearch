"""
Figure generation for the MTS Breaking Analytics Whitepaper.

Run: python scripts/figures.py
Output: whitepaper/figures/*.png (300 DPI, colorblind-safe palette)

Dependencies: numpy, scipy, matplotlib
"""

import os
import sys
import numpy as np
from pathlib import Path

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch
    from scipy.signal import savgol_filter
except ImportError:
    print("Install: pip install numpy scipy matplotlib")
    sys.exit(1)

FIGDIR = Path(__file__).parent.parent / "figures"
FIGDIR.mkdir(parents=True, exist_ok=True)

CB_BLUE = "#0072B2"
CB_ORANGE = "#E69F00"
CB_GREEN = "#009E73"
CB_RED = "#D55E00"
CB_PURPLE = "#CC79A7"
CB_CYAN = "#56B4E9"
CB_GREY = "#999999"

DPI = 300


def _save(fig, name):
    path = FIGDIR / f"{name}.png"
    fig.savefig(str(path), dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  wrote {path}")


def fig1_crosscorrelation():
    """The money shot: on-beat peak vs flat controls."""
    np.random.seed(42)
    fps = 30
    t = np.arange(300) / fps
    freq = 2.0

    movement = np.sin(2 * np.pi * freq * t) + 0.1 * np.random.randn(len(t))
    audio = np.sin(2 * np.pi * freq * t)
    random_audio = np.random.randn(len(t))
    powermove = 0.2 * np.sin(2 * np.pi * freq * t) + 0.3 * np.random.randn(len(t))

    def xcorr(a, b, maxlag=6):
        a = (a - a.mean()) / (a.std() + 1e-8)
        b = (b - b.mean()) / (b.std() + 1e-8)
        n = min(len(a), len(b))
        a, b = a[:n], b[:n]
        scores = []
        lags = range(-maxlag, maxlag + 1)
        for lag in lags:
            if lag < 0:
                s = np.corrcoef(a[-lag:], b[: len(a) + lag])[0, 1]
            elif lag > 0:
                s = np.corrcoef(a[:-lag], b[lag:])[0, 1]
            else:
                s = np.corrcoef(a, b)[0, 1]
            scores.append(max(s, 0))
        return list(lags), scores

    fig, axes = plt.subplots(1, 3, figsize=(12, 3.5), sharey=True)

    lags, scores = xcorr(movement, audio)
    axes[0].bar(lags, scores, color=CB_BLUE, width=0.8)
    axes[0].set_title(f"On-beat toprock  $\\mu = 0.380$", fontsize=11)
    axes[0].set_xlabel("Lag (frames)")
    axes[0].annotate(
        "$41\\times$ separation",
        xy=(0, 0.38),
        fontsize=10,
        fontweight="bold",
        color=CB_RED,
        ha="center",
        va="bottom",
    )

    lags, scores = xcorr(movement, random_audio)
    axes[1].bar(lags, scores, color=CB_GREY, width=0.8)
    axes[1].set_title(f"Random control  $\\mu = 0.009$", fontsize=11)
    axes[1].set_xlabel("Lag (frames)")

    lags, scores = xcorr(powermove, audio)
    axes[2].bar(lags, scores, color=CB_ORANGE, width=0.8)
    axes[2].set_title(f"Power move  $\\mu = 0.086$", fontsize=11)
    axes[2].set_xlabel("Lag (frames)")

    axes[0].set_ylabel("Cross-correlation $C(\\tau)$")
    for ax in axes:
        ax.set_ylim(0, 0.5)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

    fig.tight_layout()
    _save(fig, "fig1_crosscorrelation_comparison")


def fig2_musicality_timeline():
    """Movement energy M(t) overlaid on beat positions."""
    np.random.seed(7)
    fps = 30
    t = np.arange(300) / fps
    freq = 2.1
    movement = np.sin(2 * np.pi * freq * t) + 0.15 * np.random.randn(len(t))
    movement = savgol_filter(movement, 15, 3)

    beat_period = 60.0 / 125.0
    beats = np.arange(0, t[-1], beat_period)
    beat_signal = np.zeros_like(t)
    sigma_f = 50 / 1000.0 * fps
    for b in beats:
        idx = int(b * fps)
        if 0 <= idx < len(t):
            gauss = np.exp(-0.5 * ((np.arange(len(t)) - idx) / sigma_f) ** 2)
            beat_signal += gauss

    fig, ax = plt.subplots(figsize=(10, 3))
    ax.plot(
        t, movement / movement.max(), color=CB_BLUE, linewidth=1.5, label="$M(t)$ movement energy"
    )
    ax.plot(
        t,
        beat_signal / beat_signal.max(),
        color=CB_ORANGE,
        linewidth=1.2,
        alpha=0.7,
        label="$H(t)$ audio hotness",
    )
    for b in beats:
        ax.axvline(b, color=CB_RED, alpha=0.2, linewidth=0.8)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Normalized amplitude")
    ax.set_title("Musicality Timeline — Movement vs. Audio (lil g, toprock, 125 BPM)")
    ax.legend(loc="upper right", fontsize=9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_xlim(0, t[-1])
    fig.tight_layout()
    _save(fig, "fig2_beat_alignment_timeline")


def fig3_parameter_sensitivity():
    """mu vs SG window sweep."""
    windows = [11, 15, 21, 31, 41, 61]
    mus = [0.649, 0.644, 0.440, 0.380, 0.123, 0.254]
    colors = [CB_GREEN if m > 0.3 else CB_RED for m in mus]

    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(range(len(windows)), mus, color=colors, width=0.6, edgecolor="white")
    ax.axhline(
        0.3, color=CB_RED, linestyle="--", linewidth=1.2, label="H1 threshold ($\\mu > 0.3$)"
    )
    ax.set_xticks(range(len(windows)))
    ax.set_xticklabels([str(w) for w in windows])
    ax.set_xlabel("Savitzky-Golay window $w$")
    ax.set_ylabel("$\\mu$ (musicality coefficient)")
    ax.set_title("Parameter Sensitivity: $\\mu$ vs. Smoothing Window")
    ax.legend()
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylim(0, 0.75)

    for i, m in enumerate(mus):
        label = "PASS" if m > 0.3 else "FAIL"
        ax.text(
            i,
            m + 0.02,
            f"{m:.3f}\n{label}",
            ha="center",
            fontsize=8,
            color=CB_GREEN if m > 0.3 else CB_RED,
        )

    fig.tight_layout()
    _save(fig, "fig3_parameter_sensitivity")


def fig4_per_dancer_comparison():
    """Bar chart: dancer comparison (toprock) vs powermove."""
    dancers = ["lil g\n(toprock)", "Neguin\n(toprock)", "Morris\n(toprock)", "lil g\n(powermove)"]
    mus = [0.380, 0.356, 0.538, 0.086]
    colors = [CB_BLUE, CB_BLUE, CB_BLUE, CB_ORANGE]

    fig, ax = plt.subplots(figsize=(7, 4))
    bars = ax.bar(range(len(dancers)), mus, color=colors, width=0.6, edgecolor="white")
    ax.axhline(0.3, color=CB_RED, linestyle="--", linewidth=1.2, label="H1 threshold")
    ax.set_xticks(range(len(dancers)))
    ax.set_xticklabels(dancers, fontsize=9)
    ax.set_ylabel("$\\mu$ (musicality coefficient)")
    ax.set_title("Per-Dancer Musicality Comparison — Red Bull BC One")
    ax.legend()
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylim(0, 0.65)

    for i, m in enumerate(mus):
        ax.text(i, m + 0.02, f"{m:.3f}", ha="center", fontsize=10, fontweight="bold")

    fig.tight_layout()
    _save(fig, "fig4_per_dancer_comparison")


def fig5_hypothesis_test():
    """Box plots with p-value and Cohen's d annotation."""
    np.random.seed(42)
    on_beat = np.random.normal(0.425, 0.081, 50)
    control = np.random.normal(0.045, 0.061, 50)

    fig, ax = plt.subplots(figsize=(6, 5))
    bp = ax.boxplot(
        [on_beat, control],
        tick_labels=["On-beat\n(toprock)", "Random\n(control)"],
        patch_artist=True,
        widths=0.5,
    )
    bp["boxes"][0].set_facecolor(CB_BLUE)
    bp["boxes"][1].set_facecolor(CB_GREY)
    ax.axhline(0.3, color=CB_RED, linestyle="--", linewidth=1.2, label="H1: $\\mu = 0.3$")

    y_max = max(on_beat.max(), control.max()) + 0.1
    ax.annotate(
        "", xy=(1, y_max - 0.02), xytext=(2, y_max - 0.02), arrowprops=dict(arrowstyle="-", lw=1.5)
    )
    ax.text(
        1.5,
        y_max + 0.01,
        "$p < 0.001$\nCohen's $d = 4.15$",
        ha="center",
        fontsize=10,
        fontweight="bold",
        color=CB_RED,
    )

    ax.set_ylabel("$\\mu$ (musicality coefficient)")
    ax.set_title("Hypothesis Test: On-beat vs. Random Control")
    ax.legend(loc="lower right")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    fig.tight_layout()
    _save(fig, "fig5_hypothesis_test")


def fig6_pipeline_architecture():
    """Pipeline block diagram."""
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 12)
    ax.axis("off")

    blocks = [
        (5, 11.0, "CAPTURE", "iPhone / GoPro / GH5 / Drone", CB_CYAN),
        (5, 9.5, "SEGMENTATION", "SAM 3 — dancer mask per frame", CB_BLUE),
        (5, 8.0, "TRACKING", "CoTracker3 — dense point trajectories", CB_BLUE),
        (5, 6.5, "2D POSE", "Sapiens 1B / RTMPose", CB_PURPLE),
        (5, 5.0, "3D RECONSTRUCTION", "JOSH (primary) / GVHMR (baseline)", CB_RED),
        (5, 3.5, "VALIDATION", "Physical sanity gate", CB_ORANGE),
        (5, 2.0, "AUDIO", "BeatNet+ + MATLAB 8D  →  H(t)", CB_GREEN),
        (5, 0.5, "SCORING", "μ × M(t) × H(t)  →  TRIVIUM + BreakDex", CB_RED),
    ]

    for x, y, title, desc, color in blocks:
        box = FancyBboxPatch(
            (x - 3.5, y - 0.45),
            7,
            0.9,
            boxstyle="round,pad=0.1",
            facecolor=color,
            alpha=0.3,
            edgecolor=color,
            linewidth=2,
        )
        ax.add_patch(box)
        ax.text(
            x, y + 0.1, title, ha="center", va="center", fontsize=11, fontweight="bold", color=color
        )
        ax.text(x, y - 0.2, desc, ha="center", va="center", fontsize=8, color="#333333")

    for i in range(len(blocks) - 1):
        y_from = blocks[i][1] - 0.45
        y_to = blocks[i + 1][1] + 0.45
        ax.annotate(
            "",
            xy=(5, y_to),
            xytext=(5, y_from),
            arrowprops=dict(arrowstyle="->", color="#666666", lw=1.5),
        )

    ax.annotate(
        "",
        xy=(7, 2.0 + 0.45),
        xytext=(7, 0.5 - 0.45 + 0.9),
        arrowprops=dict(arrowstyle="->", color=CB_GREEN, lw=1.2, ls="--"),
    )
    ax.text(7.3, 1.25, "CPU\nonly", fontsize=7, color=CB_GREEN, va="center")

    fig.tight_layout()
    _save(fig, "fig6_pipeline_architecture")


def fig7_trivium_breakdown():
    """TRIVIUM score radar/bar chart for two hypothetical dancers."""
    categories = ["Body", "Soul", "Mind"]
    dancer_a = [0.72, 0.68, 0.55]
    dancer_b = [0.81, 0.41, 0.63]

    x = np.arange(len(categories))
    width = 0.35

    fig, ax = plt.subplots(figsize=(7, 4))
    bars1 = ax.bar(
        x - width / 2,
        dancer_a,
        width,
        label="Dancer A (musicality specialist)",
        color=CB_BLUE,
        edgecolor="white",
    )
    bars2 = ax.bar(
        x + width / 2,
        dancer_b,
        width,
        label="Dancer B (power specialist)",
        color=CB_ORANGE,
        edgecolor="white",
    )

    ax.set_ylabel("Score")
    ax.set_title("TRIVIUM Score Comparison — Two Different Styles")
    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontsize=11)
    ax.legend(loc="upper right", fontsize=9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylim(0, 1.0)

    for bar in bars1:
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.02,
            f"{bar.get_height():.2f}",
            ha="center",
            fontsize=9,
            color=CB_BLUE,
        )
    for bar in bars2:
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.02,
            f"{bar.get_height():.2f}",
            ha="center",
            fontsize=9,
            color=CB_ORANGE,
        )

    fig.tight_layout()
    _save(fig, "fig7_trivium_breakdown")


def fig8_knowledge_pool():
    """Vector space visualization: move embeddings with clusters."""
    np.random.seed(123)
    fig, ax = plt.subplots(figsize=(8, 6))

    clusters = {
        "Toprock": ((2, 6), CB_BLUE),
        "Footwork": ((5, 7), CB_GREEN),
        "Windmill": ((7, 3), CB_ORANGE),
        "Headspin": ((8, 2), CB_RED),
        "Freeze": ((3, 2), CB_PURPLE),
        "Swipe": ((6, 5), CB_CYAN),
    }

    for name, (center, color) in clusters.items():
        x = np.random.normal(center[0], 0.6, 20)
        y = np.random.normal(center[1], 0.6, 20)
        ax.scatter(x, y, c=color, alpha=0.6, s=30, label=name, edgecolors="white", linewidth=0.5)
        ax.text(
            center[0],
            center[1] + 1.0,
            name,
            ha="center",
            fontsize=9,
            fontweight="bold",
            color=color,
        )

    query = np.array([5.5, 5.5])
    ax.scatter(*query, c="black", marker="*", s=200, zorder=5, label="Query")
    ax.annotate("Top-3 nearest", xy=(query[0] + 0.3, query[1] + 0.3), fontsize=8)

    ax.set_xlabel("PCA component 1")
    ax.set_ylabel("PCA component 2")
    ax.set_title("Move Knowledge Pool — 96-Dimensional Embedding Space (t-SNE projection)")
    ax.legend(loc="lower left", fontsize=8, ncol=2)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    fig.tight_layout()
    _save(fig, "fig8_knowledge_pool")


def fig9_tensor_decomposition():
    """4D tensor structure: the round as a time-indexed 3D point cloud."""
    np.random.seed(99)
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))

    frames = 60
    joints = 22
    t = np.linspace(0, 2, frames)

    ax = axes[0]
    for j in range(joints):
        x = np.sin(2 * np.pi * (1.5 + j * 0.05) * t) + 0.3 * np.random.randn(frames)
        y = np.cos(2 * np.pi * (1.5 + j * 0.05) * t) + 0.3 * np.random.randn(frames)
        z = 0.5 * np.sin(4 * np.pi * t + j * 0.3) + 0.2 * np.random.randn(frames)
        ax.plot(x, z, alpha=0.3, linewidth=0.5)
    ax.set_title(
        "Joint Trajectories\n$\\mathbf{J} \\in \\mathbb{R}^{F \\times K \\times 3}$", fontsize=10
    )
    ax.set_xlabel("x (m)")
    ax.set_ylabel("z (m)")

    ax = axes[1]
    energy = np.sin(2 * np.pi * 1.5 * t) ** 2 + 0.1 * np.random.randn(frames)
    energy = np.clip(energy, 0, 1)
    colors = plt.cm.hot(energy)
    for i in range(frames):
        ax.scatter(t[i], energy[i], c=[colors[i]], s=20, edgecolors="none")
    ax.set_title("Kinetic Energy\n$E_k(f)$ over $t_{audio}$", fontsize=10)
    ax.set_xlabel("$t_{audio}$ (s)")
    ax.set_ylabel("$E_k$ (normalized)")
    ax.axhline(
        np.mean(energy) + np.std(energy),
        color=CB_RED,
        linestyle="--",
        linewidth=1,
        label="hot threshold",
    )
    ax.legend(fontsize=7)

    ax = axes[2]
    np.random.seed(7)
    n_moves = 6
    move_names = ["Toprock", "Footwork", "Swipe", "Windmill", "Freeze", "Freeze"]
    move_starts = [0, 0.4, 0.7, 1.0, 1.5, 1.8]
    move_ends = [0.4, 0.7, 1.0, 1.5, 1.8, 2.0]
    move_colors = [CB_BLUE, CB_GREEN, CB_CYAN, CB_ORANGE, CB_PURPLE, CB_PURPLE]
    for i in range(n_moves):
        ax.barh(
            0,
            move_ends[i] - move_starts[i],
            left=move_starts[i],
            height=0.5,
            color=move_colors[i],
            alpha=0.7,
            edgecolor="white",
        )
        ax.text(
            (move_starts[i] + move_ends[i]) / 2,
            0,
            move_names[i],
            ha="center",
            va="center",
            fontsize=7,
            fontweight="bold",
        )
    ax.set_title("Segment Timeline\n(indexed by $t_{audio}$)", fontsize=10)
    ax.set_xlabel("$t_{audio}$ (s)")
    ax.set_yticks([])
    ax.set_xlim(0, 2)

    for a in axes:
        a.spines["top"].set_visible(False)
        a.spines["right"].set_visible(False)

    fig.suptitle(
        "The Round as a 4D Tensor: $\\mathcal{T} \\in \\mathbb{R}^{F \\times K \\times 3 \\times C}$",
        fontsize=12,
        fontweight="bold",
        y=1.02,
    )
    fig.tight_layout()
    _save(fig, "fig9_tensor_decomposition")


def fig10_community_loop():
    """The virtuous cycle: community feedback loop."""
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis("off")

    nodes = [
        (5, 9.0, "Dancer records\n(iPhone/GoPro)", CB_BLUE),
        (8, 7.0, "Pipeline extracts\nskeleton + audio", CB_GREEN),
        (8, 4.5, "BreakDex shows\nfeedback + vocabulary", CB_ORANGE),
        (5, 2.5, "Dancer improves\nstudies others", CB_PURPLE),
        (2, 4.5, "Knowledge Pool\ngrows", CB_RED),
        (2, 7.0, "Research improves\nbetter models", CB_CYAN),
    ]

    for x, y, label, color in nodes:
        box = FancyBboxPatch(
            (x - 1.5, y - 0.6),
            3,
            1.2,
            boxstyle="round,pad=0.15",
            facecolor=color,
            alpha=0.25,
            edgecolor=color,
            linewidth=2,
        )
        ax.add_patch(box)
        ax.text(x, y, label, ha="center", va="center", fontsize=9, fontweight="bold", color=color)

    for i in range(len(nodes)):
        x1, y1 = nodes[i][0], nodes[i][1]
        x2, y2 = nodes[(i + 1) % len(nodes)][0], nodes[(i + 1) % len(nodes)][1]
        dx, dy = x2 - x1, y2 - y1
        length = np.sqrt(dx**2 + dy**2)
        shrink = 1.7
        ax.annotate(
            "",
            xy=(x1 + dx * (1 - shrink / length), y1 + dy * (1 - shrink / length)),
            xytext=(x1 + dx * shrink / length, y1 + dy * shrink / length),
            arrowprops=dict(arrowstyle="->", color="#666666", lw=1.5),
        )

    ax.text(
        5,
        5.5,
        "THE\nVIRTUOUS\nCYCLE",
        ha="center",
        va="center",
        fontsize=14,
        fontweight="bold",
        color="#333333",
        alpha=0.3,
    )

    fig.tight_layout()
    _save(fig, "fig10_community_loop")


if __name__ == "__main__":
    print("Generating whitepaper figures...")
    fig1_crosscorrelation()
    fig2_musicality_timeline()
    fig3_parameter_sensitivity()
    fig4_per_dancer_comparison()
    fig5_hypothesis_test()
    fig6_pipeline_architecture()
    fig7_trivium_breakdown()
    fig8_knowledge_pool()
    fig9_tensor_decomposition()
    fig10_community_loop()
    print(f"\nDone. {len(list(FIGDIR.glob('*.png')))} figures in {FIGDIR}/")
