"""
Graph Plots — NetworkX + matplotlib renderings for breaking analysis graphs.

Visualises move transition networks, style comparisons, battle DAGs, and
community structure.  All plots use the same move-type colour palette so
visual language is consistent across the project.

Every function saves to a PNG and returns the output path.  The matplotlib
backend is forced to 'Agg' for headless / CI environments.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import networkx as nx
import numpy as np


# ── Colour palette for move types ──────────────────────────────────────
# Hex values chosen for legibility on both dark and light backgrounds.
MOVE_COLORS: Dict[str, str] = {
    "toprock": "#FF6B6B",      # red
    "footwork": "#4ECDC4",     # teal
    "power": "#FFE66D",        # yellow
    "freeze": "#A8E6CF",       # mint
    "transition": "#DDA0DD",   # plum
    "unknown": "#95A5A6",      # gray
}


def _apply_base_style() -> None:
    """Configure matplotlib for clean dark graph visualizations."""
    plt.rcParams.update({
        "figure.facecolor": "#1a1a2e",
        "axes.facecolor": "#1a1a2e",
        "text.color": "#e0e0e0",
        "figure.dpi": 150,
        "savefig.dpi": 150,
        "savefig.bbox": "tight",
        "savefig.facecolor": "#1a1a2e",
        "font.size": 9,
    })


def _node_color(node: str, graph: nx.DiGraph) -> str:
    """Determine colour for a node from its 'type' attribute."""
    move_type = graph.nodes[node].get("type", "unknown")
    return MOVE_COLORS.get(move_type, MOVE_COLORS["unknown"])


def _make_legend(ax: plt.Axes, types_present: set) -> None:
    """Add a legend for move-type colours to the axes."""
    patches = []
    for mtype in sorted(types_present):
        color = MOVE_COLORS.get(mtype, MOVE_COLORS["unknown"])
        patches.append(mpatches.Patch(color=color, label=mtype))
    if patches:
        ax.legend(
            handles=patches,
            loc="lower right",
            fontsize=7,
            framealpha=0.5,
            facecolor="#2a2a4e",
            edgecolor="#444",
            labelcolor="#e0e0e0",
        )


# ────────────────────────────────────────────────────────────────────────
# Transition graph
# ────────────────────────────────────────────────────────────────────────


def plot_transition_graph(
    graph: nx.DiGraph,
    output: str = "transition_graph.png",
    layout: str = "spring",
    title: str = "Move Transition Network",
) -> str:
    """Render a move transition directed graph.

    Nodes are coloured by move type and sized by frequency (``count``
    attribute).  Edges are drawn with width proportional to transition
    probability (``weight`` attribute) and annotated with probability
    labels for weights > 0.1.

    Parameters
    ----------
    graph : nx.DiGraph
        Nodes should have ``type`` (str) and ``count`` (int) attributes.
        Edges should have ``weight`` (float, transition probability).
    output : str
        Output PNG path.
    layout : str
        Layout algorithm: "spring", "circular", "kamada_kawai", "shell".
    title : str
        Figure title.

    Returns
    -------
    str
        Output file path.
    """
    _apply_base_style()

    if len(graph.nodes) == 0:
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.text(0.5, 0.5, "Empty graph", ha="center", va="center", fontsize=14, color="#888")
        ax.set_title(title, color="#e94560", fontweight="bold")
        ax.axis("off")
        fig.savefig(output)
        plt.close(fig)
        return output

    fig, ax = plt.subplots(figsize=(12, 9))

    # Layout
    layout_fn = {
        "spring": lambda g: nx.spring_layout(g, k=2.0 / math.sqrt(len(g.nodes) + 1), iterations=80, seed=42),
        "circular": nx.circular_layout,
        "kamada_kawai": nx.kamada_kawai_layout,
        "shell": nx.shell_layout,
    }
    pos = layout_fn.get(layout, layout_fn["spring"])(graph)

    # Node properties
    node_list = list(graph.nodes)
    node_colors = [_node_color(n, graph) for n in node_list]
    counts = [graph.nodes[n].get("count", 1) for n in node_list]
    max_count = max(counts) if counts else 1
    node_sizes = [300 + 1500 * (c / max_count) for c in counts]

    # Edge properties
    edge_list = list(graph.edges)
    weights = [graph.edges[e].get("weight", 0.1) for e in edge_list]
    max_weight = max(weights) if weights else 1
    edge_widths = [0.5 + 4.0 * (w / max_weight) for w in weights]
    edge_alphas = [0.3 + 0.7 * (w / max_weight) for w in weights]

    # Draw edges with varying alpha
    for edge, width, alpha in zip(edge_list, edge_widths, edge_alphas):
        nx.draw_networkx_edges(
            graph, pos,
            edgelist=[edge],
            width=width,
            alpha=alpha,
            edge_color="#e0e0e0",
            arrows=True,
            arrowsize=15,
            arrowstyle="-|>",
            connectionstyle="arc3,rad=0.1",
            ax=ax,
        )

    # Draw nodes
    nx.draw_networkx_nodes(
        graph, pos,
        nodelist=node_list,
        node_color=node_colors,
        node_size=node_sizes,
        alpha=0.9,
        edgecolors="#333",
        linewidths=1.5,
        ax=ax,
    )

    # Node labels
    nx.draw_networkx_labels(
        graph, pos,
        font_size=8,
        font_color="#1a1a2e",
        font_weight="bold",
        ax=ax,
    )

    # Edge labels for significant transitions
    edge_labels = {}
    for e, w in zip(edge_list, weights):
        if w > 0.1:
            edge_labels[e] = f"{w:.2f}"
    if edge_labels:
        nx.draw_networkx_edge_labels(
            graph, pos,
            edge_labels=edge_labels,
            font_size=6,
            font_color="#aaa",
            bbox=dict(boxstyle="round,pad=0.1", facecolor="#1a1a2e", edgecolor="none", alpha=0.7),
            ax=ax,
        )

    ax.set_title(title, fontsize=14, color="#e94560", fontweight="bold", pad=15)
    ax.axis("off")

    # Legend
    types_present = {graph.nodes[n].get("type", "unknown") for n in node_list}
    _make_legend(ax, types_present)

    fig.savefig(output)
    plt.close(fig)
    return output


# ────────────────────────────────────────────────────────────────────────
# Style comparison (side-by-side)
# ────────────────────────────────────────────────────────────────────────


def plot_style_comparison(
    style_a: nx.DiGraph,
    style_b: nx.DiGraph,
    output: str = "style_comparison.png",
    labels: Tuple[str, str] = ("Dancer A", "Dancer B"),
) -> str:
    """Side-by-side circular graph showing two dancers' transition styles.

    Both panels share the same colour scheme so move types are visually
    comparable.  Nodes present in one graph but absent from the other
    appear as hollow circles.

    Parameters
    ----------
    style_a, style_b : nx.DiGraph
        Per-dancer transition graphs with ``type`` and ``count`` node attrs.
    output : str
        Output PNG path.
    labels : tuple[str, str]
        Display names for the two dancers.

    Returns
    -------
    str
        Output file path.
    """
    _apply_base_style()
    fig, (ax_a, ax_b) = plt.subplots(1, 2, figsize=(18, 8))

    for ax, graph, label in [(ax_a, style_a, labels[0]), (ax_b, style_b, labels[1])]:
        if len(graph.nodes) == 0:
            ax.text(0.5, 0.5, "No data", ha="center", va="center", fontsize=12, color="#888")
            ax.set_title(label, fontsize=12, color="#e94560", fontweight="bold")
            ax.axis("off")
            continue

        pos = nx.circular_layout(graph)
        node_list = list(graph.nodes)
        node_colors = [_node_color(n, graph) for n in node_list]
        counts = [graph.nodes[n].get("count", 1) for n in node_list]
        max_count = max(counts) if counts else 1
        node_sizes = [200 + 1200 * (c / max_count) for c in counts]

        edge_list = list(graph.edges)
        weights = [graph.edges[e].get("weight", 0.1) for e in edge_list]
        max_weight = max(weights) if weights else 1
        edge_widths = [0.5 + 3.0 * (w / max_weight) for w in weights]

        nx.draw_networkx_edges(
            graph, pos,
            width=edge_widths,
            alpha=0.4,
            edge_color="#c0c0c0",
            arrows=True,
            arrowsize=12,
            connectionstyle="arc3,rad=0.15",
            ax=ax,
        )
        nx.draw_networkx_nodes(
            graph, pos,
            nodelist=node_list,
            node_color=node_colors,
            node_size=node_sizes,
            alpha=0.85,
            edgecolors="#333",
            linewidths=1,
            ax=ax,
        )
        nx.draw_networkx_labels(
            graph, pos,
            font_size=7,
            font_color="#1a1a2e",
            font_weight="bold",
            ax=ax,
        )
        ax.set_title(label, fontsize=12, color="#e94560", fontweight="bold")
        ax.axis("off")

    # Shared legend across both panels
    all_types = set()
    for g in [style_a, style_b]:
        for n in g.nodes:
            all_types.add(g.nodes[n].get("type", "unknown"))
    patches = [mpatches.Patch(color=MOVE_COLORS.get(t, MOVE_COLORS["unknown"]), label=t) for t in sorted(all_types)]
    fig.legend(
        handles=patches,
        loc="lower center",
        ncol=len(patches),
        fontsize=8,
        framealpha=0.5,
        facecolor="#2a2a4e",
        edgecolor="#444",
        labelcolor="#e0e0e0",
    )

    fig.suptitle("Style Comparison", fontsize=14, color="#e94560", fontweight="bold", y=0.98)
    fig.savefig(output)
    plt.close(fig)
    return output


# ────────────────────────────────────────────────────────────────────────
# Battle DAG
# ────────────────────────────────────────────────────────────────────────


def plot_battle_dag(
    dag: nx.DiGraph,
    output: str = "battle_flow.png",
) -> str:
    """Render a hierarchical battle DAG.

    Expected node attributes:
    - ``level``: "battle" | "round" | "move"
    - ``dancer``: "a" | "b" (for round / move nodes)
    - ``type``: move type (for move nodes)
    - ``duration``: float seconds (used for edge thickness)

    Parameters
    ----------
    dag : nx.DiGraph
        The battle flow DAG.
    output : str
        Output PNG path.

    Returns
    -------
    str
        Output file path.
    """
    _apply_base_style()

    if len(dag.nodes) == 0:
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.text(0.5, 0.5, "Empty battle DAG", ha="center", va="center", fontsize=14, color="#888")
        ax.axis("off")
        fig.savefig(output)
        plt.close(fig)
        return output

    fig, ax = plt.subplots(figsize=(16, 10))

    # Use topological / hierarchical layout
    # Assign layers based on level attribute
    for node in dag.nodes:
        level = dag.nodes[node].get("level", "move")
        if level == "battle":
            dag.nodes[node]["subset"] = 0
        elif level == "round":
            dag.nodes[node]["subset"] = 1
        else:
            dag.nodes[node]["subset"] = 2

    try:
        pos = nx.multipartite_layout(dag, subset_key="subset", align="horizontal")
    except Exception:
        pos = nx.spring_layout(dag, seed=42)

    # Node colours
    node_colors = []
    node_sizes = []
    dancer_colors = {"a": "#4ECDC4", "b": "#FF6B6B"}

    for node in dag.nodes:
        level = dag.nodes[node].get("level", "move")
        dancer = dag.nodes[node].get("dancer", "")

        if level == "battle":
            node_colors.append("#e94560")
            node_sizes.append(800)
        elif level == "round":
            node_colors.append(dancer_colors.get(dancer, "#888"))
            node_sizes.append(500)
        else:
            move_type = dag.nodes[node].get("type", "unknown")
            node_colors.append(MOVE_COLORS.get(move_type, MOVE_COLORS["unknown"]))
            node_sizes.append(300)

    # Edge widths from duration
    edge_widths = []
    for u, v in dag.edges:
        dur = dag.edges[u, v].get("duration", 1.0)
        edge_widths.append(max(0.5, min(5.0, dur * 2)))

    nx.draw_networkx_edges(
        dag, pos,
        width=edge_widths,
        alpha=0.5,
        edge_color="#c0c0c0",
        arrows=True,
        arrowsize=12,
        ax=ax,
    )
    nx.draw_networkx_nodes(
        dag, pos,
        node_color=node_colors,
        node_size=node_sizes,
        alpha=0.9,
        edgecolors="#333",
        linewidths=1.5,
        ax=ax,
    )

    # Labels — only show for battle and round nodes, or small graphs
    label_nodes = {}
    for node in dag.nodes:
        level = dag.nodes[node].get("level", "move")
        if level in ("battle", "round") or len(dag.nodes) <= 30:
            label_nodes[node] = str(node)

    nx.draw_networkx_labels(
        dag, pos,
        labels=label_nodes,
        font_size=7,
        font_color="#e0e0e0",
        font_weight="bold",
        ax=ax,
    )

    ax.set_title("Battle Flow", fontsize=14, color="#e94560", fontweight="bold", pad=15)
    ax.axis("off")

    # Legend
    legend_patches = [
        mpatches.Patch(color="#e94560", label="Battle"),
        mpatches.Patch(color="#4ECDC4", label="Dancer A rounds"),
        mpatches.Patch(color="#FF6B6B", label="Dancer B rounds"),
    ]
    types_present = {dag.nodes[n].get("type", "unknown") for n in dag.nodes if dag.nodes[n].get("level") == "move"}
    for t in sorted(types_present):
        legend_patches.append(mpatches.Patch(color=MOVE_COLORS.get(t, MOVE_COLORS["unknown"]), label=t))

    ax.legend(
        handles=legend_patches,
        loc="lower right",
        fontsize=7,
        framealpha=0.5,
        facecolor="#2a2a4e",
        edgecolor="#444",
        labelcolor="#e0e0e0",
    )

    fig.savefig(output)
    plt.close(fig)
    return output


# ────────────────────────────────────────────────────────────────────────
# Community graph
# ────────────────────────────────────────────────────────────────────────


def plot_community_graph(
    graph: nx.DiGraph,
    communities: List[List[str]],
    output: str = "communities.png",
) -> str:
    """Render a graph with nodes coloured by community membership.

    Community assignment overrides move-type colouring.  A distinct hue
    is assigned to each community using a perceptually uniform palette.

    Parameters
    ----------
    graph : nx.DiGraph
        The transition graph.
    communities : list[list[str]]
        Each inner list contains node names belonging to the same community.
    output : str
        Output PNG path.

    Returns
    -------
    str
        Output file path.
    """
    _apply_base_style()

    if len(graph.nodes) == 0:
        fig, ax = plt.subplots(figsize=(10, 8))
        ax.text(0.5, 0.5, "Empty graph", ha="center", va="center", fontsize=14, color="#888")
        ax.axis("off")
        fig.savefig(output)
        plt.close(fig)
        return output

    fig, ax = plt.subplots(figsize=(12, 9))

    # Build node -> community mapping
    node_community: Dict[str, int] = {}
    for idx, members in enumerate(communities):
        for node in members:
            node_community[node] = idx

    # Generate distinct colours for communities
    n_comm = len(communities)
    cmap = plt.cm.get_cmap("Set2", max(n_comm, 3))
    community_colors = {i: matplotlib.colors.to_hex(cmap(i)) for i in range(n_comm)}

    # Layout
    pos = nx.spring_layout(graph, k=2.0 / math.sqrt(len(graph.nodes) + 1), iterations=80, seed=42)

    node_list = list(graph.nodes)
    node_colors = []
    for n in node_list:
        comm_id = node_community.get(n, -1)
        if comm_id >= 0:
            node_colors.append(community_colors[comm_id])
        else:
            node_colors.append(MOVE_COLORS["unknown"])

    counts = [graph.nodes[n].get("count", 1) for n in node_list]
    max_count = max(counts) if counts else 1
    node_sizes = [200 + 1200 * (c / max_count) for c in counts]

    # Draw
    nx.draw_networkx_edges(
        graph, pos,
        alpha=0.25,
        edge_color="#c0c0c0",
        arrows=True,
        arrowsize=10,
        connectionstyle="arc3,rad=0.1",
        ax=ax,
    )
    nx.draw_networkx_nodes(
        graph, pos,
        nodelist=node_list,
        node_color=node_colors,
        node_size=node_sizes,
        alpha=0.85,
        edgecolors="#333",
        linewidths=1.5,
        ax=ax,
    )
    nx.draw_networkx_labels(
        graph, pos,
        font_size=7,
        font_color="#e0e0e0",
        font_weight="bold",
        ax=ax,
    )

    ax.set_title("Community Structure", fontsize=14, color="#e94560", fontweight="bold", pad=15)
    ax.axis("off")

    # Legend
    patches = [
        mpatches.Patch(color=community_colors[i], label=f"Community {i + 1} ({len(communities[i])})")
        for i in range(n_comm)
    ]
    ax.legend(
        handles=patches,
        loc="lower right",
        fontsize=7,
        framealpha=0.5,
        facecolor="#2a2a4e",
        edgecolor="#444",
        labelcolor="#e0e0e0",
    )

    fig.savefig(output)
    plt.close(fig)
    return output
