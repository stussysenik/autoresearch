"""
Similarity metrics between MoveSignatures.

Provides three public functions:

    move_distance(a, b, weights)   – weighted multi-channel distance
    pairwise_distances(sigs)       – N x N distance matrix
    find_nearest(query, db, k)     – k-nearest neighbours

Distance channels:
    pose_hash          — cosine distance   (weight 0.30)
    spectral_envelope  — cosine distance   (weight 0.20)
    angular_profile    — correlation dist.  (weight 0.20)
    energy_curve       — correlation dist.  (weight 0.15)
    scalar_metrics     — euclidean          (weight 0.15)

All individual channel distances are in [0, 1] before weighting.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

from algebra.signature import MoveSignature

EPS = 1e-8

# Default weight budget — sums to 1.0
DEFAULT_WEIGHTS: Dict[str, float] = {
    "pose_hash": 0.30,
    "spectral_envelope": 0.20,
    "angular_profile": 0.20,
    "energy_curve": 0.15,
    "scalar_metrics": 0.15,
}


# ---------------------------------------------------------------------------
# Elementary distance functions
# ---------------------------------------------------------------------------

def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine distance in [0, 1].  0 = identical direction."""
    dot = float(np.dot(a, b))
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom < EPS:
        return 0.0  # both zero vectors → treat as identical
    return float(np.clip(1.0 - dot / denom, 0.0, 1.0))


def _correlation_distance(a: np.ndarray, b: np.ndarray) -> float:
    """
    1 - Pearson r, clipped to [0, 1].
    Falls back to Euclidean-based distance when variance is near zero.
    """
    a_c = a - np.mean(a)
    b_c = b - np.mean(b)
    denom = float(np.linalg.norm(a_c) * np.linalg.norm(b_c))
    if denom < EPS:
        # Both nearly constant — distance is based on level difference
        diff = float(np.mean(a) - np.mean(b))
        return float(np.clip(abs(diff) / (abs(np.mean(a)) + abs(np.mean(b)) + EPS), 0.0, 1.0))
    r = float(np.dot(a_c, b_c) / denom)
    return float(np.clip((1.0 - r) / 2.0, 0.0, 1.0))


def _euclidean_normalised(a: np.ndarray, b: np.ndarray) -> float:
    """Euclidean distance normalised by the joint magnitude so it stays roughly [0, 1]."""
    diff = a - b
    mag = float(np.linalg.norm(a) + np.linalg.norm(b))
    if mag < EPS:
        return 0.0
    return float(np.clip(np.linalg.norm(diff) / mag, 0.0, 1.0))


# ---------------------------------------------------------------------------
# Scalar metric vector
# ---------------------------------------------------------------------------

def _scalar_vector(sig: MoveSignature) -> np.ndarray:
    """Pack the three scalar quality metrics into a small vector."""
    return np.array([sig.complexity, sig.smoothness, sig.symmetry], dtype=np.float64)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def move_distance(
    sig_a: MoveSignature,
    sig_b: MoveSignature,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    """
    Weighted multi-channel distance between two MoveSignatures.

    Parameters
    ----------
    sig_a, sig_b : MoveSignature
        The two fingerprints to compare.
    weights : dict, optional
        Channel name → weight.  Missing channels fall back to DEFAULT_WEIGHTS.
        Weights are re-normalised to sum to 1.

    Returns
    -------
    float
        Combined distance in [0, 1].
    """
    w = dict(DEFAULT_WEIGHTS)
    if weights is not None:
        w.update(weights)
    # Normalise weights
    total = sum(w.values())
    if total < EPS:
        return 0.0
    w = {k: v / total for k, v in w.items()}

    channels: Dict[str, float] = {}

    # 1. Pose hash — cosine distance
    channels["pose_hash"] = _cosine_distance(sig_a.pose_hash, sig_b.pose_hash)

    # 2. Spectral envelope — cosine distance
    channels["spectral_envelope"] = _cosine_distance(
        sig_a.spectral_envelope, sig_b.spectral_envelope
    )

    # 3. Angular profile — correlation distance
    channels["angular_profile"] = _correlation_distance(
        sig_a.angular_profile, sig_b.angular_profile
    )

    # 4. Energy curve — correlation distance
    channels["energy_curve"] = _correlation_distance(
        sig_a.energy_curve, sig_b.energy_curve
    )

    # 5. Scalar metrics — normalised euclidean
    channels["scalar_metrics"] = _euclidean_normalised(
        _scalar_vector(sig_a), _scalar_vector(sig_b)
    )

    # Weighted sum
    dist = sum(w.get(ch, 0.0) * d for ch, d in channels.items())
    return float(np.clip(dist, 0.0, 1.0))


def pairwise_distances(
    signatures: List[MoveSignature],
    weights: Optional[Dict[str, float]] = None,
) -> np.ndarray:
    """
    Compute the full N x N distance matrix for a list of MoveSignatures.

    Parameters
    ----------
    signatures : list of MoveSignature
    weights : dict, optional
        Forwarded to move_distance().

    Returns
    -------
    np.ndarray
        Symmetric [N, N] distance matrix with zeros on the diagonal.
    """
    n = len(signatures)
    D = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        for j in range(i + 1, n):
            d = move_distance(signatures[i], signatures[j], weights)
            D[i, j] = d
            D[j, i] = d
    return D


def find_nearest(
    query: MoveSignature,
    database: List[MoveSignature],
    k: int = 5,
    weights: Optional[Dict[str, float]] = None,
) -> List[Tuple[int, float]]:
    """
    Return the *k* nearest neighbours to *query* from *database*.

    Parameters
    ----------
    query : MoveSignature
    database : list of MoveSignature
    k : int
        Number of neighbours to return (clamped to len(database)).
    weights : dict, optional
        Forwarded to move_distance().

    Returns
    -------
    list of (index, distance) tuples, sorted by ascending distance.
    """
    if not database:
        return []
    k = min(k, len(database))
    distances = [(i, move_distance(query, sig, weights)) for i, sig in enumerate(database)]
    distances.sort(key=lambda x: x[1])
    return distances[:k]
