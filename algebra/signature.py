"""
MoveSignature — compact mathematical fingerprint of a breaking move.

Given a [T, 24, 3] joint trajectory (SMPL skeleton at *fps* Hz), produces a
fixed-size descriptor capturing pose shape, spectral content, angular momentum
profile, kinetic energy curve, contact pattern, and three derived quality
metrics (complexity, smoothness, symmetry).

Power-move extensions (rotation_count, moment_of_inertia_profile, …) are
populated when move_type hints at rotational content or when the angular
momentum magnitude exceeds a heuristic threshold.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from scipy.interpolate import interp1d
from sklearn.decomposition import PCA

# ---------------------------------------------------------------------------
# Import shared constants / helpers from the existing analyze_motion module
# ---------------------------------------------------------------------------
_ANALYSIS_DIR = str(Path(__file__).resolve().parent.parent / "experiments" / "bboy-battle-analysis")
if _ANALYSIS_DIR not in sys.path:
    sys.path.insert(0, _ANALYSIS_DIR)

from analyze_motion import (  # noqa: E402
    JOINT_WEIGHTS,
    JOINT_GROUPS,
    BONE_PAIRS,
    compute_center_of_mass,
    compute_angular_momentum,
    central_derivative,
    sparc,
    EPS,
)

# ---------------------------------------------------------------------------
# Normalisation constants
# ---------------------------------------------------------------------------
K_PCA = 16          # PCA components for pose hash
N_STATS = 4         # mean, std, min, max per component
F_BINS = 32         # spectral envelope bins
T_NORM = 100        # time-normalised curve length

# Left / right joint pairs for symmetry (SMPL 24-joint ordering)
# (left, right)
LEFT_RIGHT_PAIRS = [
    (1, 2),     # hips
    (4, 5),     # knees
    (7, 8),     # ankles
    (10, 11),   # feet
    (13, 14),   # collar / inner shoulder
    (16, 17),   # shoulders / upper arm
    (18, 19),   # elbows
    (20, 21),   # wrists
    (22, 23),   # hands
]

# Contact detection joint map and thresholds
CONTACT_JOINTS = {
    "left_hand": 22,
    "right_hand": 23,
    "left_foot": 10,
    "right_foot": 11,
    "head": 15,
}
SPINE_INDICES = [3, 6, 9]
CONTACT_DIST_THRESH = 0.05   # metres
CONTACT_SPEED_THRESH = 0.10  # m/s


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------
@dataclass
class MoveSignature:
    """Compact fingerprint of a single breaking move."""

    # Identity
    move_type: str                          # toprock / footwork / power / freeze / transition
    duration_frames: int
    fps: float

    # Compact fingerprint vectors
    pose_hash: np.ndarray                   # [K*4 = 64] PCA-reduced pose descriptor
    spectral_envelope: np.ndarray           # [F = 32]   FFT magnitude of joint velocities
    angular_profile: np.ndarray             # [T_norm = 100] angular momentum magnitude
    energy_curve: np.ndarray                # [T_norm = 100] kinetic energy

    # Contact pattern
    contact_sequence: List[str]             # per-frame dominant contact label

    # Derived scalar metrics
    complexity: float                       # spectral entropy of spectral_envelope
    smoothness: float                       # SPARC score (negative arc-length)
    symmetry: float                         # bilateral correlation

    # Optional power-move extensions
    rotation_count: Optional[float] = None
    moment_of_inertia_profile: Optional[np.ndarray] = None
    pivot_stability: Optional[float] = None
    angular_velocity_consistency: Optional[float] = None
    entry_torque: Optional[float] = None
    exit_control: Optional[float] = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _time_normalise(curve: np.ndarray, n_out: int = T_NORM) -> np.ndarray:
    """Resample a 1-D curve to *n_out* uniformly-spaced points."""
    n_in = curve.shape[0]
    if n_in < 2:
        return np.full(n_out, float(curve[0]) if n_in == 1 else 0.0)
    x_in = np.linspace(0.0, 1.0, n_in)
    x_out = np.linspace(0.0, 1.0, n_out)
    f = interp1d(x_in, curve, kind="linear", fill_value="extrapolate")
    return f(x_out).astype(np.float64)


def _normalise_01(arr: np.ndarray) -> np.ndarray:
    lo, hi = float(np.min(arr)), float(np.max(arr))
    if hi - lo < EPS:
        return np.zeros_like(arr)
    return (arr - lo) / (hi - lo)


def _spectral_entropy(magnitudes: np.ndarray) -> float:
    """Shannon entropy of a magnitude spectrum, normalised to [0, 1]."""
    p = magnitudes / (np.sum(magnitudes) + EPS)
    p = p[p > 0]
    if p.size == 0:
        return 0.0
    entropy = -float(np.sum(p * np.log2(p)))
    max_entropy = np.log2(float(magnitudes.size)) if magnitudes.size > 1 else 1.0
    return float(np.clip(entropy / max_entropy, 0.0, 1.0))


# ---------------------------------------------------------------------------
# Extraction pipeline
# ---------------------------------------------------------------------------

def _compute_pose_hash(joints_flat: np.ndarray) -> np.ndarray:
    """
    PCA-reduce [T, 72] flattened poses to K=16 components, then compute
    temporal statistics (mean, std, min, max) per component → 64-dim vector.
    """
    T = joints_flat.shape[0]
    n_components = min(K_PCA, T, joints_flat.shape[1])
    pca = PCA(n_components=n_components)
    scores = pca.fit_transform(joints_flat)  # [T, n_components]

    stats = []
    for c in range(n_components):
        col = scores[:, c]
        stats.extend([float(np.mean(col)), float(np.std(col)),
                       float(np.min(col)), float(np.max(col))])
    # Pad to K_PCA * N_STATS if we used fewer components
    while len(stats) < K_PCA * N_STATS:
        stats.extend([0.0, 0.0, 0.0, 0.0])
    return np.array(stats[:K_PCA * N_STATS], dtype=np.float64)


def _compute_spectral_envelope(velocities: np.ndarray, fps: float) -> np.ndarray:
    """
    FFT of joint-group speed profiles, averaged magnitude spectra → [F_BINS].

    Groups: legs, torso, arms+hands, head (from JOINT_GROUPS).
    """
    groups = {
        "legs": JOINT_GROUPS["legs"],
        "torso": JOINT_GROUPS["torso"],
        "arms": JOINT_GROUPS["arms"] + JOINT_GROUPS["hands"],
        "head": JOINT_GROUPS["head"],
    }
    speed = np.linalg.norm(velocities, axis=-1)  # [T, 24]
    T = speed.shape[0]
    accum = np.zeros(F_BINS, dtype=np.float64)
    n_groups = 0

    for _, indices in groups.items():
        group_speed = np.mean(speed[:, indices], axis=1)  # [T]
        group_speed = group_speed - np.mean(group_speed)
        window = np.hanning(T)
        spectrum = np.abs(np.fft.rfft(group_speed * window))

        # Resample to F_BINS
        if spectrum.size >= F_BINS:
            # Bin-average
            bins = np.array_split(spectrum[:F_BINS * (spectrum.size // F_BINS)],
                                  F_BINS)
            binned = np.array([np.mean(b) for b in bins])
        else:
            # Interpolate up
            binned = np.interp(
                np.linspace(0, spectrum.size - 1, F_BINS),
                np.arange(spectrum.size),
                spectrum,
            )
        accum += binned
        n_groups += 1

    accum /= max(n_groups, 1)
    return accum.astype(np.float64)


def _compute_angular_profile(joints: np.ndarray, velocities: np.ndarray,
                              fps: float) -> np.ndarray:
    """
    Angular momentum magnitude per frame → time-normalised to T_NORM points.
    """
    com = compute_center_of_mass(joints)
    ang_mom = compute_angular_momentum(joints, velocities, com)  # [T, 3]
    ang_mag = np.linalg.norm(ang_mom, axis=-1)  # [T]
    return _time_normalise(ang_mag, T_NORM)


def _compute_energy_curve(velocities: np.ndarray) -> np.ndarray:
    """
    Kinetic energy E = 0.5 * Σ m_i * v_i² per frame, normalised to T_NORM.
    """
    speed_sq = np.sum(velocities ** 2, axis=-1)  # [T, 24]
    ke = 0.5 * np.sum(speed_sq * JOINT_WEIGHTS[None, :], axis=1)  # [T]
    return _time_normalise(ke, T_NORM)


def _detect_contact_sequence(joints: np.ndarray, fps: float) -> List[str]:
    """
    Per-frame label of which body part is closest to the ground (y-axis or
    z-axis depending on skeleton convention).  Uses the minimum coordinate
    among the z-column as a proxy for ground height.

    Returns a label per frame (e.g. "left_foot", "back", "flight").
    """
    T = joints.shape[0]
    velocities = np.gradient(joints, 1.0 / fps, axis=0)
    speed = np.linalg.norm(velocities, axis=-1)  # [T, 24]

    # Estimate floor as the 5th-percentile z across the whole clip
    floor_z = float(np.percentile(joints[:, :, 2], 5))

    labels: List[str] = []
    for t in range(T):
        best_label = "flight"
        best_dist = float("inf")

        for name, idx in CONTACT_JOINTS.items():
            z_dist = joints[t, idx, 2] - floor_z
            if z_dist < CONTACT_DIST_THRESH and speed[t, idx] < CONTACT_SPEED_THRESH:
                if z_dist < best_dist:
                    best_dist = z_dist
                    best_label = name

        # Check back (spine joints)
        spine_z = float(np.mean(joints[t, SPINE_INDICES, 2])) - floor_z
        spine_speed = float(np.mean(speed[t, SPINE_INDICES]))
        if spine_z < CONTACT_DIST_THRESH * 2 and spine_speed < CONTACT_SPEED_THRESH * 2:
            if spine_z < best_dist:
                best_label = "back"

        labels.append(best_label)

    return labels


def _compute_symmetry(joints: np.ndarray) -> float:
    """
    Bilateral symmetry: mean Pearson correlation between left and right joint
    speed profiles.  1.0 = perfectly symmetric, 0.0 = uncorrelated.
    """
    velocities = np.diff(joints, axis=0)
    if velocities.shape[0] < 4:
        return 0.5
    speed = np.linalg.norm(velocities, axis=-1)  # [T-1, 24]

    correlations = []
    for left, right in LEFT_RIGHT_PAIRS:
        l_speed = speed[:, left]
        r_speed = speed[:, right]
        # Centre
        l_speed = l_speed - np.mean(l_speed)
        r_speed = r_speed - np.mean(r_speed)
        denom = (np.std(l_speed) * np.std(r_speed))
        if denom < EPS:
            correlations.append(1.0)  # both sides stationary → symmetric
        else:
            corr = float(np.mean(l_speed * r_speed) / denom)
            correlations.append(corr)

    return float(np.clip(np.mean(correlations), 0.0, 1.0))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_signature(
    joints_3d: np.ndarray,
    fps: float = 30.0,
    move_type: str = "unknown",
) -> MoveSignature:
    """
    Build a MoveSignature from a [T, 24, 3] joint trajectory.

    Parameters
    ----------
    joints_3d : np.ndarray
        Shape [T, 24, 3].  SMPL joint positions per frame.
    fps : float
        Capture frame rate (default 30 Hz).
    move_type : str
        Semantic label — toprock / footwork / power / freeze / transition / unknown.

    Returns
    -------
    MoveSignature
        Compact, comparable fingerprint of the move.
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    if joints.ndim != 3 or joints.shape[1:] != (24, 3):
        raise ValueError(f"Expected [T, 24, 3], got {joints.shape}")
    T = joints.shape[0]
    if T < 8:
        raise ValueError(f"Need >= 8 frames, got {T}")

    fps = float(fps)
    velocities = central_derivative(joints, fps)  # [T, 24, 3]

    # 1. Pose hash (PCA of flattened poses)
    joints_flat = joints.reshape(T, -1)  # [T, 72]
    pose_hash = _compute_pose_hash(joints_flat)

    # 2. Spectral envelope
    spectral_envelope = _compute_spectral_envelope(velocities, fps)

    # 3. Angular profile (time-normalised)
    angular_profile = _time_normalise(
        _compute_angular_profile(joints, velocities, fps), T_NORM
    )

    # 4. Energy curve (time-normalised)
    energy_curve = _compute_energy_curve(velocities)

    # 5. Contact sequence
    contact_sequence = _detect_contact_sequence(joints, fps)

    # 6. Complexity — spectral entropy of spectral_envelope
    complexity = _spectral_entropy(spectral_envelope)

    # 7. Smoothness — SPARC of CoM speed profile
    com = compute_center_of_mass(joints)
    com_vel = central_derivative(com, fps)
    com_speed = np.linalg.norm(com_vel, axis=-1)
    smoothness = sparc(com_speed, fps)

    # 8. Symmetry — bilateral correlation
    symmetry = _compute_symmetry(joints)

    # Build signature (without optional rotation fields initially)
    sig = MoveSignature(
        move_type=move_type,
        duration_frames=T,
        fps=fps,
        pose_hash=pose_hash,
        spectral_envelope=spectral_envelope,
        angular_profile=angular_profile,
        energy_curve=energy_curve,
        contact_sequence=contact_sequence,
        complexity=complexity,
        smoothness=smoothness,
        symmetry=symmetry,
    )

    # Populate rotation extensions for power moves or high-angular-momentum clips
    ang_mag = np.linalg.norm(
        compute_angular_momentum(joints, velocities, com), axis=-1
    )
    is_rotational = move_type in ("power",) or float(np.mean(ang_mag)) > 0.5

    if is_rotational:
        try:
            from algebra.rotation import (
                detect_rotation_axis,
                validate_pivot,
                count_spins,
                compute_moment_of_inertia_profile,
                analyze_entry_exit,
            )

            axis = detect_rotation_axis(joints, fps)
            sig.rotation_count, _, _ = count_spins(joints, fps)
            sig.moment_of_inertia_profile = compute_moment_of_inertia_profile(
                joints, axis, fps
            )

            # Pivot stability: use the joint closest to the floor on average
            floor_z = float(np.percentile(joints[:, :, 2], 5))
            mean_z = np.mean(joints[:, :, 2], axis=0)
            pivot_joint = int(np.argmin(mean_z - floor_z))
            sig.pivot_stability, _ = validate_pivot(joints, pivot_joint, fps)

            # Angular velocity consistency: CV of angular momentum magnitude
            ang_cv = float(np.std(ang_mag) / (np.mean(ang_mag) + EPS))
            sig.angular_velocity_consistency = float(np.clip(1.0 - ang_cv, 0.0, 1.0))

            ee = analyze_entry_exit(joints, fps)
            sig.entry_torque = ee.get("entry_torque", None)
            sig.exit_control = ee.get("exit_control", None)
        except Exception:
            # Rotation analysis is best-effort; do not break signature extraction
            pass

    return sig
