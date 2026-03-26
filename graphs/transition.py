"""
Move Transition Graph — Markov chain model of breaking movement sequences.

Breaking (bboy) rounds are sequences of moves: toprock -> footwork -> power -> freeze.
By modelling these sequences as a first-order Markov chain we can:

1. **Predict** what a dancer will do next given their current move.
2. **Compare** dancers by their transition fingerprints.
3. **Identify** rare or surprising transitions that signal creativity.

Graph Theory Concepts
---------------------
- **Directed graph (DiGraph)**: nodes are move types, edges point from one move
  to the next in observed sequences.  Each edge carries a *probability* weight
  so that outgoing edges from any node sum to 1.0 — making the adjacency matrix
  a row-stochastic (right-stochastic) transition matrix.
- **Stationary distribution**: the long-run proportion of time spent in each
  move type, found by solving  π T = π  where T is the transition matrix.
  For an ergodic chain this is the dominant left eigenvector of T.
- **Laplace smoothing**: edges seen fewer than `min_count` times are filtered
  to avoid over-fitting to noise from small samples.

All functions are pure-CPU and work with NetworkX DiGraphs.
"""

from __future__ import annotations

import networkx as nx
import numpy as np
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class MoveEvent:
    """A single move in a sequence.

    Attributes
    ----------
    move_type : str
        Category of the move — one of toprock / footwork / power / freeze /
        transition (or any user-defined label).
    start_frame : int
        Frame index where this move begins in the source video.
    end_frame : int
        Frame index where this move ends (exclusive).
    dancer_id : str | None
        Optional identifier for the dancer performing the move.
    difficulty : float
        Normalised difficulty rating in [0, 1].  0.5 = average.
    quality : float
        Normalised execution quality in [0, 1].  0.5 = average.
    """

    move_type: str
    start_frame: int
    end_frame: int
    dancer_id: Optional[str] = None
    difficulty: float = 0.5
    quality: float = 0.5

    @property
    def duration_frames(self) -> int:
        """Number of frames this move spans."""
        return max(self.end_frame - self.start_frame, 0)


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_transition_graph(
    sequences: List[List[MoveEvent]],
    min_count: int = 2,
) -> nx.DiGraph:
    """Build a weighted directed graph from observed move sequences.

    Each node represents a unique *move_type*.  Each directed edge (A → B)
    means "move A was followed by move B" at least once.

    Parameters
    ----------
    sequences : list[list[MoveEvent]]
        Collection of move sequences.  Each inner list is one round / set.
    min_count : int, default 2
        Minimum number of times a transition must be observed to be kept in
        the graph.  Acts as simple Laplace-style noise filter.

    Returns
    -------
    nx.DiGraph
        Transition graph with the following attributes:
        - **Node attrs**: ``frequency`` (int), ``avg_difficulty`` (float),
          ``avg_quality`` (float).
        - **Edge attrs**: ``count`` (int), ``probability`` (float),
          ``avg_transition_time_frames`` (float).
    """
    G = nx.DiGraph()

    # ---------- accumulate raw counts ----------
    # node-level accumulators
    node_freq: Dict[str, int] = defaultdict(int)
    node_diff_sum: Dict[str, float] = defaultdict(float)
    node_qual_sum: Dict[str, float] = defaultdict(float)

    # edge-level accumulators
    edge_count: Dict[Tuple[str, str], int] = defaultdict(int)
    edge_transition_time: Dict[Tuple[str, str], List[int]] = defaultdict(list)

    for seq in sequences:
        if not seq:
            continue
        for i, event in enumerate(seq):
            mt = event.move_type
            node_freq[mt] += 1
            node_diff_sum[mt] += event.difficulty
            node_qual_sum[mt] += event.quality

            if i > 0:
                prev = seq[i - 1]
                pair = (prev.move_type, mt)
                edge_count[pair] += 1
                # transition time = gap between end of previous and start of current
                # If moves are contiguous this may be 0; negative values are clamped.
                gap = max(event.start_frame - prev.end_frame, 0)
                edge_transition_time[pair].append(gap)

    # ---------- populate nodes ----------
    for mt, freq in node_freq.items():
        G.add_node(
            mt,
            frequency=freq,
            avg_difficulty=node_diff_sum[mt] / freq if freq else 0.0,
            avg_quality=node_qual_sum[mt] / freq if freq else 0.0,
        )

    # ---------- populate edges (filter by min_count) ----------
    for (src, dst), cnt in edge_count.items():
        if cnt < min_count:
            continue
        times = edge_transition_time[(src, dst)]
        avg_time = float(np.mean(times)) if times else 0.0
        G.add_edge(src, dst, count=cnt, avg_transition_time_frames=avg_time)

    # ---------- normalise edge weights to probabilities ----------
    _normalise_edge_probabilities(G)

    return G


def _normalise_edge_probabilities(G: nx.DiGraph) -> None:
    """Set ``probability`` on every edge so outgoing weights sum to 1.0.

    Works in-place.  If a node has no outgoing edges, nothing happens.
    """
    for node in G.nodes():
        out_edges = list(G.out_edges(node, data=True))
        if not out_edges:
            continue
        total = sum(d.get("count", 1) for _, _, d in out_edges)
        for _, dst, d in out_edges:
            d["probability"] = d.get("count", 1) / total if total > 0 else 0.0


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

def get_top_transitions(
    graph: nx.DiGraph,
    from_move: str,
    k: int = 3,
) -> List[Tuple[str, float]]:
    """Return the *k* most probable transitions from *from_move*.

    Parameters
    ----------
    graph : nx.DiGraph
        Transition graph built by :func:`build_transition_graph`.
    from_move : str
        The source move type to query.
    k : int, default 3
        Number of top transitions to return.

    Returns
    -------
    list[tuple[str, float]]
        ``(target_move, probability)`` pairs sorted descending by probability.
        Returns an empty list if *from_move* is not in the graph or has no
        outgoing edges.
    """
    if from_move not in graph:
        return []

    successors = [
        (dst, data.get("probability", 0.0))
        for _, dst, data in graph.out_edges(from_move, data=True)
    ]
    successors.sort(key=lambda x: x[1], reverse=True)
    return successors[:k]


# ---------------------------------------------------------------------------
# Matrix representation
# ---------------------------------------------------------------------------

def get_transition_matrix(
    graph: nx.DiGraph,
) -> Tuple[np.ndarray, List[str]]:
    """Extract the transition probability matrix from the graph.

    Parameters
    ----------
    graph : nx.DiGraph
        Transition graph with ``probability`` edge attributes.

    Returns
    -------
    matrix : np.ndarray, shape (N, N)
        Row-stochastic matrix where ``matrix[i][j]`` is the probability of
        transitioning from ``labels[i]`` to ``labels[j]``.
    labels : list[str]
        Ordered list of move types corresponding to matrix rows / columns.

    Notes
    -----
    Rows for nodes with no outgoing edges are all-zero (absorbing states).
    """
    labels = sorted(graph.nodes())
    n = len(labels)
    if n == 0:
        return np.empty((0, 0), dtype=np.float64), []

    idx = {label: i for i, label in enumerate(labels)}
    matrix = np.zeros((n, n), dtype=np.float64)

    for src, dst, data in graph.edges(data=True):
        i, j = idx[src], idx[dst]
        matrix[i, j] = data.get("probability", 0.0)

    return matrix, labels


# ---------------------------------------------------------------------------
# Stationary distribution
# ---------------------------------------------------------------------------

def steady_state_distribution(graph: nx.DiGraph) -> Dict[str, float]:
    """Compute the stationary (steady-state) distribution of the Markov chain.

    The stationary distribution **pi** satisfies ``pi @ T = pi`` where T is
    the transition matrix.  We find it as the normalised left eigenvector of T
    corresponding to eigenvalue 1.

    For disconnected or non-ergodic chains we fall back to the Google PageRank
    vector (damping = 0.85) which is always well-defined.

    Parameters
    ----------
    graph : nx.DiGraph
        Transition graph with ``probability`` edge attributes.

    Returns
    -------
    dict[str, float]
        Mapping from move type to its stationary probability.
        Values sum to 1.0 (within floating-point tolerance).
    """
    matrix, labels = get_transition_matrix(graph)
    n = len(labels)
    if n == 0:
        return {}

    # ---------- try exact eigenvector method ----------
    try:
        # Left eigenvectors of T are right eigenvectors of T^T.
        eigenvalues, eigenvectors = np.linalg.eig(matrix.T)

        # Find the eigenvector closest to eigenvalue 1.
        idx_1 = int(np.argmin(np.abs(eigenvalues - 1.0)))

        pi = np.real(eigenvectors[:, idx_1])

        # Ensure non-negative (numerical noise can produce tiny negatives).
        pi = np.abs(pi)
        total = pi.sum()
        if total > 1e-12:
            pi /= total
            return {labels[i]: float(pi[i]) for i in range(n)}
    except np.linalg.LinAlgError:
        pass

    # ---------- fallback: PageRank ----------
    pr = nx.pagerank(graph, alpha=0.85, weight="probability")
    total = sum(pr.values())
    if total > 1e-12:
        return {k: v / total for k, v in pr.items()}
    # Uniform if all else fails.
    return {label: 1.0 / n for label in labels}
