"""
Style Signature — per-dancer fingerprinting via graph-theoretic metrics.

Every bboy has a *style*: a characteristic distribution of moves and the way
they chain them together.  By building each dancer's personal transition graph
and extracting a battery of graph metrics, we produce a compact **StyleSignature**
that can be compared numerically.

Graph Theory Concepts
---------------------
- **Shannon entropy**: H = -sum(p_i * log2(p_i)) over the move-type frequency
  distribution.  High entropy ≈ diverse vocabulary; low ≈ repetitive.
- **Clustering coefficient**: on the undirected projection, this measures the
  fraction of a node's neighbours that are also neighbours of each other —
  indicating "cliquey" transition patterns.
- **Betweenness centrality**: how often a node lies on the shortest path
  between *other* nodes.  The most-central move is the one that connects
  different parts of the vocabulary.
- **Cosine similarity**: used to compare two signature vectors.

All operations are pure-CPU, using NetworkX for graph work and NumPy for
linear algebra.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import networkx as nx
import numpy as np

from graphs.transition import MoveEvent, build_transition_graph


# ---------------------------------------------------------------------------
# Data structure
# ---------------------------------------------------------------------------

@dataclass
class StyleSignature:
    """Compact representation of a dancer's personal movement style.

    Built from their observed move sequences, the signature captures
    *what* moves they use (vocabulary) and *how* they connect them
    (transition structure).

    Attributes
    ----------
    dancer_id : str
        Unique identifier for the dancer.
    subgraph : nx.DiGraph
        Personal transition graph (nodes = move types the dancer used).
    vocabulary_size : int
        Number of distinct move types in their repertoire.
    vocabulary_entropy : float
        Shannon entropy (bits) of the move-type frequency distribution.
        Higher means more diverse.
    clustering_coefficient : float
        Average clustering coefficient on the undirected projection of
        their transition graph.  Higher means more "loopy" patterns.
    avg_path_length : float
        Average shortest-path length in the undirected projection.
        Lower means they can reach any move from any other quickly.
    most_central_move : str
        The move type with the highest betweenness centrality — the
        "hub" of their vocabulary.
    degree_distribution : dict[str, int]
        Total degree (in + out) per move type.
    signature_vector : np.ndarray
        Compact numeric fingerprint suitable for distance calculations.
        Components: [vocabulary_size, vocabulary_entropy,
        clustering_coefficient, avg_path_length, pagerank_entropy,
        density, avg_difficulty, avg_quality].
    """

    dancer_id: str
    subgraph: nx.DiGraph
    vocabulary_size: int
    vocabulary_entropy: float
    clustering_coefficient: float
    avg_path_length: float
    most_central_move: str
    degree_distribution: Dict[str, int]
    signature_vector: np.ndarray


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------

def compute_style_signature(
    sequences: List[List[MoveEvent]],
    dancer_id: str,
) -> StyleSignature:
    """Build a dancer's style signature from their move sequences.

    Parameters
    ----------
    sequences : list[list[MoveEvent]]
        One or more sequences of moves performed by this dancer.
        (Sequences from other dancers in the list are ignored.)
    dancer_id : str
        Identifier to match against ``MoveEvent.dancer_id``.  If events
        have ``dancer_id=None`` they are included (assumed to belong to
        the dancer).

    Returns
    -------
    StyleSignature
        Complete signature with graph metrics and numeric vector.
    """
    # ---- filter to this dancer's events ----
    dancer_seqs: List[List[MoveEvent]] = []
    for seq in sequences:
        filtered = [
            e for e in seq
            if e.dancer_id is None or e.dancer_id == dancer_id
        ]
        if filtered:
            dancer_seqs.append(filtered)

    # ---- build personal transition graph (min_count=1 for individual) ----
    subgraph = build_transition_graph(dancer_seqs, min_count=1)

    # ---- vocabulary stats ----
    vocabulary_size = subgraph.number_of_nodes()

    # Frequency distribution for entropy
    freqs = np.array(
        [subgraph.nodes[n].get("frequency", 1) for n in subgraph.nodes()],
        dtype=np.float64,
    )
    vocabulary_entropy = _shannon_entropy(freqs)

    # ---- graph metrics on undirected projection ----
    U = subgraph.to_undirected()

    clustering = (
        nx.average_clustering(U) if U.number_of_nodes() > 0 else 0.0
    )

    avg_path = _safe_avg_path_length(U)

    # ---- centrality ----
    if subgraph.number_of_nodes() > 0:
        betw = nx.betweenness_centrality(subgraph, weight="probability")
        most_central_move = max(betw, key=lambda k: betw[k]) if betw else ""
    else:
        most_central_move = ""

    # ---- degree distribution (in + out) ----
    degree_distribution: Dict[str, int] = {}
    for node in subgraph.nodes():
        degree_distribution[node] = subgraph.in_degree(node) + subgraph.out_degree(node)

    # ---- PageRank entropy (captures transition structure complexity) ----
    if subgraph.number_of_nodes() > 0:
        pr = nx.pagerank(subgraph, alpha=0.85, weight="probability")
        pr_vals = np.array(list(pr.values()), dtype=np.float64)
        pagerank_entropy = _shannon_entropy(pr_vals)
    else:
        pagerank_entropy = 0.0

    # ---- density ----
    density = nx.density(subgraph) if subgraph.number_of_nodes() > 1 else 0.0

    # ---- avg difficulty / quality across all nodes ----
    if subgraph.number_of_nodes() > 0:
        avg_diff = float(np.mean([
            subgraph.nodes[n].get("avg_difficulty", 0.5)
            for n in subgraph.nodes()
        ]))
        avg_qual = float(np.mean([
            subgraph.nodes[n].get("avg_quality", 0.5)
            for n in subgraph.nodes()
        ]))
    else:
        avg_diff = 0.5
        avg_qual = 0.5

    # ---- compact signature vector ----
    sig_vec = np.array([
        float(vocabulary_size),
        vocabulary_entropy,
        clustering,
        avg_path,
        pagerank_entropy,
        density,
        avg_diff,
        avg_qual,
    ], dtype=np.float64)

    return StyleSignature(
        dancer_id=dancer_id,
        subgraph=subgraph,
        vocabulary_size=vocabulary_size,
        vocabulary_entropy=vocabulary_entropy,
        clustering_coefficient=clustering,
        avg_path_length=avg_path,
        most_central_move=most_central_move,
        degree_distribution=degree_distribution,
        signature_vector=sig_vec,
    )


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------

def style_similarity(sig_a: StyleSignature, sig_b: StyleSignature) -> float:
    """Compute similarity between two style signatures.

    Uses cosine similarity on the signature vectors, mapped to [0, 1]
    via ``(cos + 1) / 2`` so that orthogonal vectors score 0.5 and
    identical vectors score 1.0.

    Parameters
    ----------
    sig_a, sig_b : StyleSignature
        Two dancer signatures to compare.

    Returns
    -------
    float
        Similarity in [0, 1].  1.0 = identical style fingerprint.
    """
    a = sig_a.signature_vector
    b = sig_b.signature_vector

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a < 1e-12 or norm_b < 1e-12:
        # If either vector is zero, similarity is 0 (no information).
        return 0.0

    cos = float(np.dot(a, b) / (norm_a * norm_b))
    # Map [-1, 1] → [0, 1]
    return (cos + 1.0) / 2.0


def compare_styles(signatures: List[StyleSignature]) -> np.ndarray:
    """Build a pairwise similarity matrix for a list of dancers.

    Parameters
    ----------
    signatures : list[StyleSignature]
        Signatures to compare (one per dancer).

    Returns
    -------
    np.ndarray, shape (N, N)
        Symmetric matrix where entry ``[i, j]`` is the similarity between
        ``signatures[i]`` and ``signatures[j]``.  Diagonal is 1.0.
    """
    n = len(signatures)
    matrix = np.eye(n, dtype=np.float64)
    for i in range(n):
        for j in range(i + 1, n):
            sim = style_similarity(signatures[i], signatures[j])
            matrix[i, j] = sim
            matrix[j, i] = sim
    return matrix


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _shannon_entropy(values: np.ndarray) -> float:
    """Shannon entropy in bits from a frequency/probability array.

    Zeroes are ignored (0 * log(0) := 0 by convention).
    The input does not need to be pre-normalised.
    """
    if values.size == 0:
        return 0.0
    total = values.sum()
    if total <= 0:
        return 0.0
    probs = values / total
    probs = probs[probs > 0]
    return float(-np.sum(probs * np.log2(probs)))


def _safe_avg_path_length(G: nx.Graph) -> float:
    """Average shortest-path length, handling disconnected graphs.

    For disconnected graphs we average over the largest connected component
    (the standard convention when the full graph has no finite diameter).
    Returns 0.0 for graphs with fewer than 2 reachable nodes.
    """
    if G.number_of_nodes() < 2:
        return 0.0

    # Work on the largest connected component.
    components = list(nx.connected_components(G))
    largest_cc = max(components, key=len)

    if len(largest_cc) < 2:
        return 0.0

    sub = G.subgraph(largest_cc)
    try:
        return float(nx.average_shortest_path_length(sub))
    except nx.NetworkXError:
        return 0.0
