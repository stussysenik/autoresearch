"""
Move Algebra — mathematical fingerprinting for breaking (bboy) movement analysis.

Turns every move into a MoveSignature: a compact, comparable, clusterable
descriptor derived from 3-D joint trajectories [T, 24, 3].

Modules
-------
signature   – MoveSignature dataclass + extract_signature()
similarity  – Distance metrics between signatures
clustering  – DBSCAN / spectral clustering of move libraries
taxonomy    – Nearest-centroid classification against labeled exemplars
rotation    – Rotation-axis detection, spin counting, wobble for power moves
"""

from algebra.signature import MoveSignature, extract_signature
from algebra.similarity import move_distance, pairwise_distances, find_nearest
from algebra.clustering import ClusterResult, cluster_moves
from algebra.taxonomy import classify_move
from algebra.rotation import (
    detect_rotation_axis,
    validate_pivot,
    count_spins,
    compute_moment_of_inertia_profile,
    quantify_wobble,
    analyze_entry_exit,
    detect_leg_extension_events,
)

__all__ = [
    "MoveSignature",
    "extract_signature",
    "move_distance",
    "pairwise_distances",
    "find_nearest",
    "ClusterResult",
    "cluster_moves",
    "classify_move",
    "detect_rotation_axis",
    "validate_pivot",
    "count_spins",
    "compute_moment_of_inertia_profile",
    "quantify_wobble",
    "analyze_entry_exit",
    "detect_leg_extension_events",
]
