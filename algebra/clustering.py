"""
Clustering MoveSignatures — group similar moves automatically.

Supports two methods:

    dbscan     – Density-based (DBSCAN).  Discovers cluster count automatically.
                 Good when the number of move types is unknown.
    spectral   – Graph-based spectral clustering.  Requires specifying k (number
                 of clusters).  Good when you know how many categories to expect.

Both operate on the pairwise distance matrix produced by similarity.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np
from sklearn.cluster import DBSCAN, SpectralClustering
from sklearn.metrics import silhouette_score

from algebra.signature import MoveSignature
from algebra.similarity import pairwise_distances

EPS = 1e-8


@dataclass
class ClusterResult:
    """Output of cluster_moves()."""

    labels: np.ndarray                          # [N] cluster assignment (-1 = noise)
    n_clusters: int                             # number of clusters (excl. noise)
    centroids: Dict[int, np.ndarray]            # cluster_id → mean feature vector
    silhouette: float                           # silhouette score (-1..1, higher=better)
    method: str                                 # "dbscan" or "spectral"
    signatures: List[MoveSignature] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Feature vector for centroid computation
# ---------------------------------------------------------------------------

def _feature_vector(sig: MoveSignature) -> np.ndarray:
    """
    Concatenate the fixed-size numeric channels into a single vector
    so we can compute centroids in feature space.
    """
    return np.concatenate([
        sig.pose_hash,
        sig.spectral_envelope,
        sig.angular_profile,
        sig.energy_curve,
        np.array([sig.complexity, sig.smoothness, sig.symmetry]),
    ])


def _compute_centroids(
    signatures: List[MoveSignature],
    labels: np.ndarray,
) -> Dict[int, np.ndarray]:
    """Mean feature vector per cluster (excluding noise label -1)."""
    unique = set(int(l) for l in labels if l >= 0)
    centroids: Dict[int, np.ndarray] = {}
    for cid in unique:
        members = [signatures[i] for i in range(len(signatures)) if labels[i] == cid]
        if members:
            vecs = np.stack([_feature_vector(m) for m in members])
            centroids[cid] = np.mean(vecs, axis=0)
    return centroids


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def cluster_moves(
    signatures: List[MoveSignature],
    method: str = "dbscan",
    weights: Optional[Dict[str, float]] = None,
    **kwargs,
) -> ClusterResult:
    """
    Cluster a collection of MoveSignatures.

    Parameters
    ----------
    signatures : list of MoveSignature
        Moves to cluster.
    method : str
        "dbscan" (default) or "spectral".
    weights : dict, optional
        Forwarded to pairwise_distances() for the distance matrix.
    **kwargs
        Extra parameters for the chosen algorithm:

        DBSCAN
            eps : float   – neighbourhood radius (default 0.3)
            min_samples : int – core point threshold (default 2)

        Spectral
            n_clusters : int – number of clusters (default 5)

    Returns
    -------
    ClusterResult
    """
    n = len(signatures)
    if n == 0:
        return ClusterResult(
            labels=np.array([], dtype=np.int64),
            n_clusters=0,
            centroids={},
            silhouette=0.0,
            method=method,
            signatures=[],
        )

    if n == 1:
        return ClusterResult(
            labels=np.array([0], dtype=np.int64),
            n_clusters=1,
            centroids={0: _feature_vector(signatures[0])},
            silhouette=0.0,
            method=method,
            signatures=signatures,
        )

    # Build distance matrix
    D = pairwise_distances(signatures, weights)

    if method == "dbscan":
        labels = _cluster_dbscan(D, **kwargs)
    elif method == "spectral":
        labels = _cluster_spectral(D, n, **kwargs)
    else:
        raise ValueError(f"Unknown clustering method: {method!r}. Use 'dbscan' or 'spectral'.")

    labels = np.asarray(labels, dtype=np.int64)
    n_clusters = len(set(int(l) for l in labels if l >= 0))
    centroids = _compute_centroids(signatures, labels)

    # Silhouette score (needs >= 2 clusters and no all-noise)
    unique_non_noise = set(int(l) for l in labels if l >= 0)
    if len(unique_non_noise) >= 2:
        # Mask out noise for silhouette
        mask = labels >= 0
        if np.sum(mask) >= 2:
            sil = float(silhouette_score(D[np.ix_(mask, mask)], labels[mask], metric="precomputed"))
        else:
            sil = 0.0
    else:
        sil = 0.0

    return ClusterResult(
        labels=labels,
        n_clusters=n_clusters,
        centroids=centroids,
        silhouette=sil,
        method=method,
        signatures=signatures,
    )


# ---------------------------------------------------------------------------
# Backend implementations
# ---------------------------------------------------------------------------

def _cluster_dbscan(D: np.ndarray, **kwargs) -> np.ndarray:
    """
    DBSCAN on precomputed distance matrix.

    If *eps* is not supplied, we auto-select using the knee of the
    sorted k-distance graph (k = min_samples).
    """
    min_samples = int(kwargs.get("min_samples", 2))

    if "eps" in kwargs:
        eps_val = float(kwargs["eps"])
    else:
        # Auto-select eps: k-th nearest distance for each point, take the knee
        n = D.shape[0]
        k = min(min_samples, n - 1)
        k_dists = np.sort(D, axis=1)[:, k]  # k-th nearest neighbour distance
        sorted_k = np.sort(k_dists)
        # Simple knee detection: point of maximum second derivative
        if sorted_k.size >= 3:
            d2 = np.diff(sorted_k, n=2)
            knee_idx = int(np.argmax(d2)) + 1
            eps_val = float(sorted_k[knee_idx])
        else:
            eps_val = float(np.median(D[D > 0])) if np.any(D > 0) else 0.5
        # Ensure eps is not pathologically small
        eps_val = max(eps_val, 0.01)

    db = DBSCAN(eps=eps_val, min_samples=min_samples, metric="precomputed")
    return db.fit_predict(D)


def _cluster_spectral(D: np.ndarray, n: int, **kwargs) -> np.ndarray:
    """
    Spectral clustering on an affinity matrix derived from distances.

    Affinity = exp(-D² / (2 * sigma²)) where sigma = median(D).
    """
    n_clusters = int(kwargs.get("n_clusters", min(5, n)))
    n_clusters = max(1, min(n_clusters, n))

    sigma = float(np.median(D[D > 0])) if np.any(D > 0) else 1.0
    sigma = max(sigma, EPS)
    affinity = np.exp(-D ** 2 / (2.0 * sigma ** 2))
    np.fill_diagonal(affinity, 1.0)

    if n_clusters >= n:
        return np.arange(n, dtype=np.int64)

    sc = SpectralClustering(
        n_clusters=n_clusters,
        affinity="precomputed",
        random_state=42,
        assign_labels="kmeans",
    )
    return sc.fit_predict(affinity)
