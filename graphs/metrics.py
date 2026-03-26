"""
Graph-Theoretic Metrics — analysis toolkit for breaking move graphs.

This module provides higher-level analytics that work on any NetworkX
DiGraph, but are designed with breaking transition graphs in mind:

- **Centrality metrics**: identify the most important moves in a vocabulary.
- **Community detection**: discover clusters of moves that tend to be
  used together (e.g., "power move cluster" vs "footwork cluster").
- **Graph summary**: quick structural overview of any graph.
- **Graph comparison**: quantify how similar two transition graphs are
  (e.g., comparing two dancers or the same dancer across events).

Graph Theory Concepts
---------------------
- **Betweenness centrality**: fraction of all shortest paths that pass
  through a given node.  High betweenness = "bridge" move connecting
  different clusters.
- **PageRank**: originally Google's web page ranking algorithm.  In a
  move graph, high PageRank means other popular moves tend to transition
  *into* this one.
- **Eigenvector centrality**: a node is important if it is connected to
  other important nodes (recursive definition, solved via eigenvalue
  decomposition).
- **Louvain community detection**: greedy modularity maximisation that
  partitions nodes into communities.  Requires undirected projection.
- **Graph edit distance**: minimum number of node/edge insertions,
  deletions, and substitutions to transform one graph into another.
  Expensive for large graphs; we use spectral methods as a faster proxy.

All functions are pure-CPU, using NetworkX and NumPy.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

import networkx as nx
import numpy as np


# ---------------------------------------------------------------------------
# Centrality
# ---------------------------------------------------------------------------

def compute_centrality_metrics(
    graph: nx.DiGraph,
) -> Dict[str, Dict[str, float]]:
    """Compute multiple centrality metrics for every node.

    Parameters
    ----------
    graph : nx.DiGraph
        Any directed graph (typically a transition or strategy graph).

    Returns
    -------
    dict[str, dict[str, float]]
        Outer key = metric name, inner dict = ``{node: value}``.
        Metrics computed:

        - ``betweenness_centrality``: fraction of shortest paths through
          each node.
        - ``pagerank``: recursive importance score (damping 0.85).
        - ``eigenvector_centrality``: importance from being connected to
          important neighbours (may be absent if computation fails for
          non-strongly-connected graphs).

    Notes
    -----
    In a breaking move graph, the node with the highest betweenness is
    often a "transition hub" — a move that bridges toprock to footwork
    or footwork to power.  PageRank highlights moves that many popular
    moves transition *into*.
    """
    if graph.number_of_nodes() == 0:
        return {
            "betweenness_centrality": {},
            "pagerank": {},
            "eigenvector_centrality": {},
        }

    results: Dict[str, Dict[str, float]] = {}

    # Betweenness — always works on DiGraph.
    results["betweenness_centrality"] = nx.betweenness_centrality(
        graph, weight="probability"
    )

    # PageRank — always well-defined with damping.
    results["pagerank"] = nx.pagerank(
        graph, alpha=0.85, weight="probability"
    )

    # Eigenvector centrality — may fail on non-strongly-connected graphs.
    try:
        results["eigenvector_centrality"] = nx.eigenvector_centrality_numpy(
            graph, weight="probability"
        )
    except (nx.NetworkXError, nx.NetworkXException, np.linalg.LinAlgError):
        # Fall back to in-degree centrality as a reasonable proxy.
        total_edges = graph.number_of_edges()
        if total_edges > 0:
            results["eigenvector_centrality"] = {
                node: graph.in_degree(node, weight="probability") / total_edges
                for node in graph.nodes()
            }
        else:
            results["eigenvector_centrality"] = {
                node: 0.0 for node in graph.nodes()
            }

    return results


# ---------------------------------------------------------------------------
# Community detection
# ---------------------------------------------------------------------------

def detect_communities(
    graph: nx.DiGraph,
    method: str = "louvain",
) -> List[List[str]]:
    """Detect communities (clusters) of moves in the graph.

    Parameters
    ----------
    graph : nx.DiGraph
        Any directed graph.
    method : str, default "louvain"
        Detection algorithm:

        - ``"louvain"``: greedy modularity maximisation on the undirected
          projection.  Fast and produces good results.
        - ``"label_propagation"``: semi-synchronous label propagation on
          the undirected projection.  Faster but less stable.

    Returns
    -------
    list[list[str]]
        Each inner list is a community — a group of move types that
        cluster together.  Communities are sorted by size (largest first).

    Notes
    -----
    Community detection on a breaking move graph often reveals natural
    clusters like "power moves", "ground footwork", and "standing
    toprock", reflecting the biomechanical and stylistic groupings
    that dancers intuitively use.
    """
    if graph.number_of_nodes() == 0:
        return []

    # Both algorithms need an undirected graph.
    U = graph.to_undirected()

    if method == "louvain":
        communities = _louvain_communities(U)
    elif method == "label_propagation":
        communities = _label_propagation_communities(U)
    else:
        raise ValueError(
            f"Unknown community detection method: {method!r}. "
            f"Supported: 'louvain', 'label_propagation'."
        )

    # Sort communities by size (largest first), nodes within each alphabetically.
    communities = [sorted(c) for c in communities]
    communities.sort(key=len, reverse=True)
    return communities


def _louvain_communities(U: nx.Graph) -> List[List[str]]:
    """Louvain modularity-based community detection."""
    try:
        partition = nx.community.louvain_communities(U, weight="probability", seed=42)
        return [list(comm) for comm in partition]
    except Exception:
        # Fallback if louvain is not available or fails.
        return _connected_component_communities(U)


def _label_propagation_communities(U: nx.Graph) -> List[List[str]]:
    """Label propagation community detection."""
    try:
        communities_gen = nx.community.label_propagation_communities(U)
        return [list(comm) for comm in communities_gen]
    except Exception:
        return _connected_component_communities(U)


def _connected_component_communities(U: nx.Graph) -> List[List[str]]:
    """Fallback: treat each connected component as a community."""
    return [list(cc) for cc in nx.connected_components(U)]


# ---------------------------------------------------------------------------
# Graph summary
# ---------------------------------------------------------------------------

def graph_summary(graph: nx.DiGraph) -> Dict[str, Any]:
    """Return structural summary statistics for a directed graph.

    Parameters
    ----------
    graph : nx.DiGraph
        Any directed graph.

    Returns
    -------
    dict[str, Any]
        Keys:

        - ``node_count`` (int)
        - ``edge_count`` (int)
        - ``density`` (float): ratio of actual edges to possible edges.
        - ``avg_clustering`` (float): average clustering coefficient on
          the undirected projection.
        - ``strongly_connected_components`` (int): number of SCCs.
        - ``weakly_connected_components`` (int): number of WCCs.
        - ``diameter`` (int | None): diameter of the largest SCC
          (None if no SCC has >= 2 nodes).
        - ``avg_in_degree`` (float)
        - ``avg_out_degree`` (float)

    Notes
    -----
    Density close to 1.0 means the dancer transitions between almost
    every pair of moves (versatile); low density means they follow
    rigid patterns.
    """
    n = graph.number_of_nodes()
    e = graph.number_of_edges()

    if n == 0:
        return {
            "node_count": 0,
            "edge_count": 0,
            "density": 0.0,
            "avg_clustering": 0.0,
            "strongly_connected_components": 0,
            "weakly_connected_components": 0,
            "diameter": None,
            "avg_in_degree": 0.0,
            "avg_out_degree": 0.0,
        }

    density = nx.density(graph)

    # Clustering on undirected projection.
    U = graph.to_undirected()
    avg_clustering = nx.average_clustering(U)

    # Connected components.
    sccs = list(nx.strongly_connected_components(graph))
    wccs = list(nx.weakly_connected_components(graph))

    # Diameter of the largest strongly connected component.
    diameter: Optional[int] = None
    largest_scc = max(sccs, key=len) if sccs else set()
    if len(largest_scc) >= 2:
        scc_sub = graph.subgraph(largest_scc)
        try:
            diameter = nx.diameter(scc_sub)
        except nx.NetworkXError:
            diameter = None

    # Degree stats.
    avg_in = sum(d for _, d in graph.in_degree()) / n
    avg_out = sum(d for _, d in graph.out_degree()) / n

    return {
        "node_count": n,
        "edge_count": e,
        "density": density,
        "avg_clustering": avg_clustering,
        "strongly_connected_components": len(sccs),
        "weakly_connected_components": len(wccs),
        "diameter": diameter,
        "avg_in_degree": avg_in,
        "avg_out_degree": avg_out,
    }


# ---------------------------------------------------------------------------
# Graph comparison
# ---------------------------------------------------------------------------

def compare_graphs(
    graph_a: nx.DiGraph,
    graph_b: nx.DiGraph,
) -> float:
    """Compute similarity between two directed graphs.

    Uses a combination of three complementary signals:

    1. **Node overlap** (Jaccard): what fraction of move types appear
       in both graphs?
    2. **Edge overlap** (Jaccard): what fraction of transitions appear
       in both?
    3. **Spectral similarity**: how similar are the eigenvalue spectra
       of the adjacency matrices?  This captures higher-order structural
       patterns beyond simple overlap.

    The final score is a weighted combination:
    ``0.3 * node_jaccard + 0.3 * edge_jaccard + 0.4 * spectral_sim``

    Parameters
    ----------
    graph_a, graph_b : nx.DiGraph
        Two graphs to compare.

    Returns
    -------
    float
        Similarity in [0, 1].  1.0 = structurally identical.
    """
    # Handle empty graphs.
    if graph_a.number_of_nodes() == 0 and graph_b.number_of_nodes() == 0:
        return 1.0
    if graph_a.number_of_nodes() == 0 or graph_b.number_of_nodes() == 0:
        return 0.0

    # ---- Node Jaccard ----
    nodes_a = set(graph_a.nodes())
    nodes_b = set(graph_b.nodes())
    node_jaccard = _jaccard(nodes_a, nodes_b)

    # ---- Edge Jaccard ----
    edges_a = set(graph_a.edges())
    edges_b = set(graph_b.edges())
    edge_jaccard = _jaccard(edges_a, edges_b)

    # ---- Spectral similarity ----
    spectral_sim = _spectral_similarity(graph_a, graph_b)

    return 0.3 * node_jaccard + 0.3 * edge_jaccard + 0.4 * spectral_sim


def _jaccard(set_a: Set, set_b: Set) -> float:
    """Jaccard similarity coefficient between two sets."""
    if not set_a and not set_b:
        return 1.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


def _spectral_similarity(
    graph_a: nx.DiGraph,
    graph_b: nx.DiGraph,
) -> float:
    """Spectral similarity based on eigenvalue spectra of adjacency matrices.

    We compare the sorted eigenvalue magnitudes of the two adjacency
    matrices using a normalised L2 distance.  Graphs with similar
    higher-order connectivity patterns will have similar spectra.

    The eigenvalue vectors are zero-padded to the same length before
    comparison.
    """
    spec_a = _adjacency_spectrum(graph_a)
    spec_b = _adjacency_spectrum(graph_b)

    # Zero-pad to equal length.
    max_len = max(len(spec_a), len(spec_b))
    if max_len == 0:
        return 1.0

    padded_a = np.zeros(max_len, dtype=np.float64)
    padded_b = np.zeros(max_len, dtype=np.float64)
    padded_a[: len(spec_a)] = spec_a
    padded_b[: len(spec_b)] = spec_b

    # Normalised L2 distance → similarity.
    diff = np.linalg.norm(padded_a - padded_b)
    norm = max(np.linalg.norm(padded_a), np.linalg.norm(padded_b), 1e-12)
    distance = diff / norm

    # Map distance to [0, 1] similarity via exponential decay.
    return float(np.exp(-distance))


def _adjacency_spectrum(graph: nx.DiGraph) -> np.ndarray:
    """Sorted eigenvalue magnitudes of the adjacency matrix."""
    if graph.number_of_nodes() == 0:
        return np.array([], dtype=np.float64)

    try:
        A = nx.adjacency_matrix(graph, weight="probability").toarray().astype(np.float64)
        eigenvalues = np.linalg.eigvals(A)
        magnitudes = np.sort(np.abs(eigenvalues))[::-1]  # descending
        return magnitudes
    except (np.linalg.LinAlgError, ValueError):
        return np.array([], dtype=np.float64)
