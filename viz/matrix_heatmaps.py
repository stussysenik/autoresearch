"""
Matrix Heatmaps — matplotlib renderings of N*N matrices for breaking analysis.

Three flavours:
- Distance matrix with optional dendrogram (hierarchical clustering sidebar)
- Feature correlation matrix with value annotations
- Transition probability matrix (move A -> move B)

All functions save to a PNG file and return the output path.  The matplotlib
backend is forced to 'Agg' for headless operation on servers / CI.
"""
from __future__ import annotations

import matplotlib
matplotlib.use("Agg")  # Must precede pyplot import — headless backend
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np
from typing import List, Optional


# ── Shared styling ──────────────────────────────────────────────────────

_CMAP_DISTANCE = "inferno"       # dark (similar) -> bright (different)
_CMAP_CORRELATION = "RdBu_r"    # diverging: blue (neg) -> red (pos)
_CMAP_TRANSITION = "YlOrRd"     # sequential for probabilities


def _apply_base_style() -> None:
    """Configure matplotlib for clean, readable heatmaps."""
    plt.rcParams.update({
        "figure.facecolor": "#1a1a2e",
        "axes.facecolor": "#16213e",
        "text.color": "#e0e0e0",
        "axes.labelcolor": "#e0e0e0",
        "xtick.color": "#c0c0c0",
        "ytick.color": "#c0c0c0",
        "figure.dpi": 150,
        "savefig.dpi": 150,
        "savefig.bbox": "tight",
        "savefig.facecolor": "#1a1a2e",
        "font.size": 9,
    })


# ────────────────────────────────────────────────────────────────────────
# Distance matrix
# ────────────────────────────────────────────────────────────────────────


def plot_distance_matrix(
    distances: np.ndarray,
    labels: List[str],
    output: str = "distance_matrix.png",
    title: str = "Move Signature Distance Matrix",
    show_dendrogram: bool = True,
) -> str:
    """Render an N*N distance matrix as a heatmap with optional dendrogram.

    The dendrogram is drawn on the left margin using scipy hierarchical
    clustering (Ward linkage).  Rows/columns are reordered to match the
    dendrogram leaf order so that similar items cluster visually.

    Parameters
    ----------
    distances : np.ndarray
        Square symmetric distance matrix, shape (N, N).
    labels : list[str]
        Row/column labels, length N.
    output : str
        Output PNG path.
    title : str
        Figure title.
    show_dendrogram : bool
        If True, add a dendrogram on the left margin.

    Returns
    -------
    str
        The output file path.
    """
    _apply_base_style()
    n = distances.shape[0]

    # Ensure symmetric
    distances = (distances + distances.T) / 2.0
    np.fill_diagonal(distances, 0.0)

    # Hierarchical clustering for ordering
    order = np.arange(n)
    linkage_matrix = None
    if show_dendrogram and n > 2:
        try:
            from scipy.cluster.hierarchy import linkage, leaves_list
            from scipy.spatial.distance import squareform

            # Convert to condensed form for linkage
            condensed = squareform(distances, checks=False)
            linkage_matrix = linkage(condensed, method="ward")
            order = leaves_list(linkage_matrix)
        except Exception:
            # Fall back to original order if clustering fails
            show_dendrogram = False

    # Reorder matrix and labels
    reordered = distances[np.ix_(order, order)]
    reordered_labels = [labels[i] for i in order]

    if show_dendrogram and linkage_matrix is not None:
        # Layout: [dendrogram | heatmap | colorbar]
        fig = plt.figure(figsize=(max(8, n * 0.5 + 3), max(6, n * 0.4 + 1)))
        gs = gridspec.GridSpec(
            1, 3,
            width_ratios=[0.15, 0.8, 0.05],
            wspace=0.02,
        )
        ax_dendro = fig.add_subplot(gs[0])
        ax_heat = fig.add_subplot(gs[1])
        ax_cbar = fig.add_subplot(gs[2])

        # Dendrogram (horizontal, on the left)
        from scipy.cluster.hierarchy import dendrogram as scipy_dendrogram
        scipy_dendrogram(
            linkage_matrix,
            orientation="left",
            ax=ax_dendro,
            no_labels=True,
            color_threshold=0,
            above_threshold_color="#e94560",
            leaf_rotation=0,
        )
        ax_dendro.set_xticks([])
        ax_dendro.set_yticks([])
        ax_dendro.spines[:].set_visible(False)
        ax_dendro.invert_yaxis()
    else:
        fig, ax_heat = plt.subplots(
            figsize=(max(8, n * 0.5 + 1), max(6, n * 0.4 + 1))
        )
        ax_cbar = None

    # Heatmap
    im = ax_heat.imshow(
        reordered,
        cmap=_CMAP_DISTANCE,
        interpolation="nearest",
        aspect="equal",
    )
    ax_heat.set_xticks(range(n))
    ax_heat.set_yticks(range(n))
    ax_heat.set_xticklabels(reordered_labels, rotation=45, ha="right", fontsize=max(6, 10 - n // 5))
    ax_heat.set_yticklabels(reordered_labels, fontsize=max(6, 10 - n // 5))
    ax_heat.set_title(title, fontsize=12, pad=10, color="#e94560", fontweight="bold")

    # Annotations for small matrices
    if n <= 15:
        for i in range(n):
            for j in range(n):
                val = reordered[i, j]
                text_color = "white" if val > (reordered.max() * 0.5) else "black"
                ax_heat.text(
                    j, i, f"{val:.2f}",
                    ha="center", va="center",
                    fontsize=max(5, 8 - n // 4),
                    color=text_color,
                )

    # Colorbar
    if ax_cbar is not None:
        plt.colorbar(im, cax=ax_cbar, label="Distance")
    else:
        plt.colorbar(im, ax=ax_heat, fraction=0.046, pad=0.04, label="Distance")

    fig.savefig(output)
    plt.close(fig)
    return output


# ────────────────────────────────────────────────────────────────────────
# Feature correlation
# ────────────────────────────────────────────────────────────────────────


def plot_feature_correlation(
    features: np.ndarray,
    feature_names: List[str],
    output: str = "correlation.png",
) -> str:
    """Render a feature correlation matrix with value annotations.

    Computes Pearson correlation from the raw feature matrix (samples x features)
    and renders it as a diverging heatmap from -1 (blue) to +1 (red).

    Parameters
    ----------
    features : np.ndarray
        Feature matrix, shape (n_samples, n_features).
    feature_names : list[str]
        Feature names, length n_features.
    output : str
        Output PNG path.

    Returns
    -------
    str
        The output file path.
    """
    _apply_base_style()
    n = len(feature_names)

    # Compute correlation matrix
    # Handle constant features gracefully (correlation is NaN)
    corr = np.corrcoef(features.T)
    corr = np.nan_to_num(corr, nan=0.0)

    fig, ax = plt.subplots(figsize=(max(8, n * 0.6 + 1), max(6, n * 0.5 + 1)))
    im = ax.imshow(corr, cmap=_CMAP_CORRELATION, vmin=-1, vmax=1, interpolation="nearest")

    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(feature_names, rotation=45, ha="right", fontsize=max(6, 10 - n // 5))
    ax.set_yticklabels(feature_names, fontsize=max(6, 10 - n // 5))
    ax.set_title("Feature Correlation Matrix", fontsize=12, pad=10, color="#e94560", fontweight="bold")

    # Annotations
    if n <= 20:
        for i in range(n):
            for j in range(n):
                val = corr[i, j]
                text_color = "white" if abs(val) > 0.5 else "black"
                ax.text(
                    j, i, f"{val:.2f}",
                    ha="center", va="center",
                    fontsize=max(5, 8 - n // 5),
                    color=text_color,
                )

    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Correlation")
    fig.savefig(output)
    plt.close(fig)
    return output


# ────────────────────────────────────────────────────────────────────────
# Transition matrix
# ────────────────────────────────────────────────────────────────────────


def plot_transition_matrix(
    matrix: np.ndarray,
    labels: List[str],
    output: str = "transition_matrix.png",
) -> str:
    """Render a transition probability matrix as a heatmap.

    Each cell (i, j) represents P(move_j | move_i), so rows should sum
    to approximately 1.0.

    Parameters
    ----------
    matrix : np.ndarray
        Transition probability matrix, shape (N, N). Values in [0, 1].
    labels : list[str]
        Move labels, length N.
    output : str
        Output PNG path.

    Returns
    -------
    str
        The output file path.
    """
    _apply_base_style()
    n = len(labels)

    fig, ax = plt.subplots(figsize=(max(8, n * 0.6 + 1), max(6, n * 0.5 + 1)))
    im = ax.imshow(matrix, cmap=_CMAP_TRANSITION, vmin=0, vmax=1, interpolation="nearest")

    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=max(6, 10 - n // 5))
    ax.set_yticklabels(labels, fontsize=max(6, 10 - n // 5))
    ax.set_title("Move Transition Probabilities", fontsize=12, pad=10, color="#e94560", fontweight="bold")
    ax.set_xlabel("To", fontsize=10)
    ax.set_ylabel("From", fontsize=10)

    # Annotations — always show for transition matrices since values matter
    if n <= 25:
        for i in range(n):
            for j in range(n):
                val = matrix[i, j]
                if val < 0.01:
                    continue  # Skip near-zero entries to reduce clutter
                text_color = "white" if val > 0.5 else "black"
                ax.text(
                    j, i, f"{val:.2f}",
                    ha="center", va="center",
                    fontsize=max(5, 8 - n // 5),
                    color=text_color,
                )

    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="P(transition)")
    fig.savefig(output)
    plt.close(fig)
    return output
