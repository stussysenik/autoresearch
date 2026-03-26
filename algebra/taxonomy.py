"""
Taxonomy mapping — classify a MoveSignature against labeled exemplars.

Uses nearest-centroid classification: compute the mean feature vector for each
exemplar category, then assign the query to the category whose centroid is
closest (via the multi-channel move_distance metric).

Also provides a bulk classifier and a function to build exemplar dictionaries
from labeled signature lists.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

from algebra.signature import MoveSignature
from algebra.similarity import move_distance

EPS = 1e-8


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _centroid_signature(exemplars: List[MoveSignature]) -> MoveSignature:
    """
    Build a synthetic MoveSignature whose numeric fields are the element-wise
    mean of the exemplars.  Used as the centroid for distance computation.
    """
    if len(exemplars) == 1:
        return exemplars[0]

    pose_hashes = np.stack([e.pose_hash for e in exemplars])
    spectral_envelopes = np.stack([e.spectral_envelope for e in exemplars])
    angular_profiles = np.stack([e.angular_profile for e in exemplars])
    energy_curves = np.stack([e.energy_curve for e in exemplars])

    complexities = [e.complexity for e in exemplars]
    smoothnesses = [e.smoothness for e in exemplars]
    symmetries = [e.symmetry for e in exemplars]

    # Use the most common move_type among exemplars
    type_counts: Dict[str, int] = {}
    for e in exemplars:
        type_counts[e.move_type] = type_counts.get(e.move_type, 0) + 1
    dominant_type = max(type_counts, key=type_counts.get)  # type: ignore[arg-type]

    return MoveSignature(
        move_type=dominant_type,
        duration_frames=int(np.mean([e.duration_frames for e in exemplars])),
        fps=exemplars[0].fps,
        pose_hash=np.mean(pose_hashes, axis=0),
        spectral_envelope=np.mean(spectral_envelopes, axis=0),
        angular_profile=np.mean(angular_profiles, axis=0),
        energy_curve=np.mean(energy_curves, axis=0),
        contact_sequence=exemplars[0].contact_sequence,  # not meaningful for centroid
        complexity=float(np.mean(complexities)),
        smoothness=float(np.mean(smoothnesses)),
        symmetry=float(np.mean(symmetries)),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_move(
    signature: MoveSignature,
    exemplars: Dict[str, List[MoveSignature]],
    weights: Optional[Dict[str, float]] = None,
) -> Tuple[str, float]:
    """
    Nearest-centroid classification against labeled exemplar sets.

    Parameters
    ----------
    signature : MoveSignature
        The move to classify.
    exemplars : dict
        Mapping from category name (e.g. "windmill", "headspin", "baby_freeze")
        to a list of labeled MoveSignatures for that category.
    weights : dict, optional
        Channel weights forwarded to move_distance().

    Returns
    -------
    (predicted_type, confidence) : (str, float)
        *predicted_type* is the category name with the smallest centroid
        distance.  *confidence* is in [0, 1] — derived from the relative
        margin between the best and second-best distances.
    """
    if not exemplars:
        return ("unknown", 0.0)

    # Build centroids
    centroids: Dict[str, MoveSignature] = {}
    for cat, sigs in exemplars.items():
        if sigs:
            centroids[cat] = _centroid_signature(sigs)

    if not centroids:
        return ("unknown", 0.0)

    # Compute distances
    distances: List[Tuple[str, float]] = []
    for cat, centroid in centroids.items():
        d = move_distance(signature, centroid, weights)
        distances.append((cat, d))

    distances.sort(key=lambda x: x[1])
    best_cat, best_dist = distances[0]

    # Confidence: relative margin between 1st and 2nd best
    if len(distances) >= 2:
        second_dist = distances[1][1]
        margin = second_dist - best_dist
        # Confidence = how much closer the best is than the runner-up,
        # normalised by the second-best distance so it stays in [0, 1].
        confidence = float(np.clip(margin / (second_dist + EPS), 0.0, 1.0))
    else:
        # Only one category — confidence based on absolute distance
        confidence = float(np.clip(1.0 - best_dist, 0.0, 1.0))

    return (best_cat, confidence)


def classify_batch(
    signatures: List[MoveSignature],
    exemplars: Dict[str, List[MoveSignature]],
    weights: Optional[Dict[str, float]] = None,
) -> List[Tuple[str, float]]:
    """
    Classify multiple signatures at once.

    Returns a list of (predicted_type, confidence) in the same order as *signatures*.
    """
    return [classify_move(sig, exemplars, weights) for sig in signatures]


def build_exemplar_dict(
    labeled_signatures: List[Tuple[str, MoveSignature]],
) -> Dict[str, List[MoveSignature]]:
    """
    Convenience: convert a flat list of (label, signature) pairs into the
    exemplar dict format expected by classify_move().
    """
    exemplars: Dict[str, List[MoveSignature]] = {}
    for label, sig in labeled_signatures:
        exemplars.setdefault(label, []).append(sig)
    return exemplars
