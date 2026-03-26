"""
Rotation-specific analysis for power moves (1990s, windmills, headspins).

Implements physics from BREAKING_PHYSICS_MODEL.md:
    - Rotation axis detection via principal component of angular momentum
    - Pivot joint validation (velocity ≈ 0)
    - Spin counting from cumulative angle in the rotation plane
    - Moment of inertia profile I(t) = Σ m_i * r_perp_i²
    - Wobble quantification (CoM drift from rotation axis)
    - Entry/exit analysis (torque build-up and deceleration control)
    - Leg extension/tuck event detection (ice-skater effect)
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Import shared constants from analyze_motion
# ---------------------------------------------------------------------------
_ANALYSIS_DIR = str(Path(__file__).resolve().parent.parent / "experiments" / "bboy-battle-analysis")
if _ANALYSIS_DIR not in sys.path:
    sys.path.insert(0, _ANALYSIS_DIR)

from analyze_motion import (  # noqa: E402
    JOINT_WEIGHTS,
    JOINT_GROUPS,
    compute_center_of_mass,
    compute_angular_momentum,
    central_derivative,
    EPS,
)

# Joint masses in kg (un-normalised) for moment of inertia
JOINT_MASSES_KG = {
    0: 11.17, 1: 2.78, 2: 2.78, 3: 5.0, 4: 3.28, 5: 3.28,
    6: 3.0, 7: 0.61, 8: 0.61, 9: 2.5, 10: 0.97, 11: 0.97,
    12: 1.5, 13: 0.5, 14: 0.5, 15: 5.0, 16: 2.0, 17: 2.0,
    18: 1.14, 19: 1.14, 20: 0.45, 21: 0.45, 22: 0.41, 23: 0.41,
}
_JOINT_MASS_ARRAY = np.array([JOINT_MASSES_KG[j] for j in range(24)], dtype=np.float64)

# Total body mass — needed to correct for JOINT_WEIGHTS being normalised (sum=1)
# in compute_angular_momentum. L from that function is L_true / M_TOTAL.
_M_TOTAL = float(_JOINT_MASS_ARRAY.sum())

# Minimum frame count for rotation analysis
_MIN_FRAMES = 10

# Leg joint indices for extension/tuck detection
LEG_INDICES = JOINT_GROUPS["legs"]  # [1, 2, 4, 5, 7, 8, 10, 11]


def _check_min_frames(joints: np.ndarray, func_name: str) -> None:
    """Raise ValueError if the clip is too short for meaningful rotation analysis."""
    if joints.shape[0] < _MIN_FRAMES:
        raise ValueError(
            f"{func_name}: need at least {_MIN_FRAMES} frames, got {joints.shape[0]}"
        )


# ---------------------------------------------------------------------------
# 1. Rotation axis detection
# ---------------------------------------------------------------------------

def detect_rotation_axis(
    joints_3d: np.ndarray,
    fps: float = 30.0,
) -> np.ndarray:
    """
    Detect the dominant rotation axis from angular momentum vectors.

    Uses the first principal component of the per-frame angular momentum L(t).
    For headspins / 1990s this should be close to vertical [0, 0, 1].
    For windmills it follows the body roll direction.

    Parameters
    ----------
    joints_3d : np.ndarray  [T, 24, 3]
    fps : float

    Returns
    -------
    np.ndarray  [3]
        Unit vector of the dominant rotation axis.
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    _check_min_frames(joints, "detect_rotation_axis")
    velocities = central_derivative(joints, fps)
    com = compute_center_of_mass(joints)
    ang_mom = compute_angular_momentum(joints, velocities, com)  # [T, 3]

    # Principal component = direction of maximum variance in L(t)
    ang_centered = ang_mom - np.mean(ang_mom, axis=0)
    cov = np.cov(ang_centered.T)  # [3, 3]
    eigenvalues, eigenvectors = np.linalg.eigh(cov)
    # Largest eigenvalue is last (eigh returns ascending order)
    axis = eigenvectors[:, -1].copy()

    # Convention: make axis point "up" (positive z) if possible
    if axis[2] < 0:
        axis = -axis

    norm = float(np.linalg.norm(axis))
    if norm < EPS:
        return np.array([0.0, 0.0, 1.0])
    return axis / norm


# ---------------------------------------------------------------------------
# 2. Pivot validation
# ---------------------------------------------------------------------------

def validate_pivot(
    joints_3d: np.ndarray,
    pivot_joint: int,
    fps: float = 30.0,
) -> Tuple[float, bool]:
    """
    Check whether a pivot joint is stable (velocity ≈ 0).

    A good pivot (e.g. head in a headspin, hand in a 1990) should have
    near-zero speed throughout the move.

    Parameters
    ----------
    joints_3d : np.ndarray  [T, 24, 3]
    pivot_joint : int
        Joint index (0–23).
    fps : float

    Returns
    -------
    (stability_score, is_stable) : (float, bool)
        stability_score in [0, 1] — higher = more stable.
        is_stable = True when score > 0.7.
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    _check_min_frames(joints, "validate_pivot")
    velocities = central_derivative(joints, fps)
    pivot_speed = np.linalg.norm(velocities[:, pivot_joint], axis=-1)  # [T]

    # Compare pivot speed to overall body speed
    body_speed = np.mean(np.linalg.norm(velocities, axis=-1), axis=1)  # [T]
    mean_body = float(np.mean(body_speed))
    mean_pivot = float(np.mean(pivot_speed))

    # Stability = how much slower the pivot is than the body average
    if mean_body < EPS:
        score = 1.0
    else:
        ratio = mean_pivot / mean_body
        score = float(np.clip(1.0 - ratio, 0.0, 1.0))

    return (score, score > 0.7)


# ---------------------------------------------------------------------------
# 3. Spin counting
# ---------------------------------------------------------------------------

def count_spins(
    joints_3d: np.ndarray,
    fps: float = 30.0,
) -> Tuple[float, int, float]:
    """
    Count rotations by integrating angular displacement in the dominant
    rotation plane.

    Projects joint movement into the plane perpendicular to the rotation
    axis, tracks cumulative angle of the CoM (or a distal joint) around
    the pivot.

    Parameters
    ----------
    joints_3d : np.ndarray  [T, 24, 3]
    fps : float

    Returns
    -------
    (total_revolutions, complete_revolutions, partial_fraction)
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    _check_min_frames(joints, "count_spins")
    axis = detect_rotation_axis(joints, fps)

    # Use angular momentum to get instantaneous angular velocity about the axis
    velocities = central_derivative(joints, fps)
    com = compute_center_of_mass(joints)
    ang_mom = compute_angular_momentum(joints, velocities, com)  # [T, 3]

    # FIX: compute_angular_momentum uses normalised JOINT_WEIGHTS (sum=1),
    # so L is off by 1/M_total. Multiply by M_total to get true L in kg·m²/s.
    L_proj = np.dot(ang_mom, axis) * _M_TOTAL  # [T], now in true kg·m²/s

    # Moment of inertia about the axis (uses raw kg masses — already correct)
    I_approx = compute_moment_of_inertia_profile(joints, axis, fps)  # [T]
    I_approx = np.maximum(I_approx, EPS)

    # Angular velocity ω = L / I  (rad/s)
    omega = L_proj / I_approx  # [T]

    # FIX: Integrate angular velocity → total angle using trapezoidal rule
    dt = 1.0 / fps
    total_angle = float(np.trapz(omega, dx=dt))  # radians
    total_revolutions = abs(total_angle) / (2.0 * np.pi)
    complete = int(total_revolutions)
    partial = total_revolutions - complete

    return (total_revolutions, complete, partial)


# ---------------------------------------------------------------------------
# 4. Moment of inertia profile
# ---------------------------------------------------------------------------

def compute_moment_of_inertia_profile(
    joints_3d: np.ndarray,
    rotation_axis: np.ndarray,
    fps: float = 30.0,
) -> np.ndarray:
    """
    I(t) = Σ m_i * r_perp_i(t)² for each frame.

    r_perp_i is the perpendicular distance of joint i from the rotation axis
    (passing through the CoM).

    Parameters
    ----------
    joints_3d : np.ndarray  [T, 24, 3]
    rotation_axis : np.ndarray  [3]
    fps : float  (unused but kept for API consistency)

    Returns
    -------
    np.ndarray  [T]
        Moment of inertia per frame in kg·m².
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    _check_min_frames(joints, "compute_moment_of_inertia_profile")
    axis = rotation_axis / (np.linalg.norm(rotation_axis) + EPS)
    com = compute_center_of_mass(joints)  # [T, 3]

    T = joints.shape[0]
    I_profile = np.zeros(T, dtype=np.float64)

    for t in range(T):
        r = joints[t] - com[t]  # [24, 3] — vectors from CoM to each joint
        # Component along axis
        r_parallel = np.outer(np.dot(r, axis), axis)  # [24, 3]
        r_perp = r - r_parallel  # [24, 3]
        r_perp_sq = np.sum(r_perp ** 2, axis=-1)  # [24]
        I_profile[t] = float(np.sum(_JOINT_MASS_ARRAY * r_perp_sq))

    return I_profile


# ---------------------------------------------------------------------------
# 5. Wobble quantification
# ---------------------------------------------------------------------------

def quantify_wobble(
    joints_3d: np.ndarray,
    rotation_axis: np.ndarray,
    fps: float = 30.0,
) -> Tuple[float, float]:
    """
    Measure how much the CoM drifts from the rotation axis over time.

    A clean spin has CoM right on the axis (wobble ≈ 0).
    Wobble = perpendicular distance of CoM from the axis line through
    the mean CoM position.

    Parameters
    ----------
    joints_3d : np.ndarray  [T, 24, 3]
    rotation_axis : np.ndarray  [3]
    fps : float

    Returns
    -------
    (mean_wobble_distance, wobble_cv) : (float, float)
        mean_wobble_distance in metres.
        wobble_cv = coefficient of variation (std / mean) of the wobble.
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    _check_min_frames(joints, "quantify_wobble")
    axis = rotation_axis / (np.linalg.norm(rotation_axis) + EPS)
    com = compute_center_of_mass(joints)  # [T, 3]

    # Define the axis line as passing through the mean CoM
    com_mean = np.mean(com, axis=0)  # [3]
    r = com - com_mean  # [T, 3]

    # Perpendicular distance from the axis line
    r_parallel_mag = np.dot(r, axis)  # [T]
    r_parallel = np.outer(r_parallel_mag, axis)  # [T, 3]
    r_perp = r - r_parallel  # [T, 3]
    wobble_dist = np.linalg.norm(r_perp, axis=-1)  # [T]

    mean_wobble = float(np.mean(wobble_dist))
    std_wobble = float(np.std(wobble_dist))
    cv = std_wobble / (mean_wobble + EPS)

    return (mean_wobble, cv)


# ---------------------------------------------------------------------------
# 6. Entry / exit analysis
# ---------------------------------------------------------------------------

def analyze_entry_exit(
    joints_3d: np.ndarray,
    fps: float = 30.0,
) -> Dict[str, float]:
    """
    Analyse the entry (torque build-up) and exit (deceleration control)
    phases of a power move.

    Entry phase: first 20% of the clip.
    Exit phase: last 20% of the clip.

    Returns
    -------
    dict with keys:
        entry_torque      – mean rate of angular momentum increase (entry phase)
        exit_control      – smoothness score of angular momentum decrease (exit)
        entry_duration    – duration of entry phase in seconds
        exit_duration     – duration of exit phase in seconds
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    _check_min_frames(joints, "analyze_entry_exit")
    T = joints.shape[0]
    velocities = central_derivative(joints, fps)
    com = compute_center_of_mass(joints)
    ang_mom = compute_angular_momentum(joints, velocities, com)
    ang_mag = np.linalg.norm(ang_mom, axis=-1)  # [T]

    entry_end = max(2, int(T * 0.2))
    exit_start = min(T - 2, int(T * 0.8))

    # Entry torque: rate of angular momentum build-up
    entry_ang = ang_mag[:entry_end]
    if entry_ang.size >= 2:
        # Linear slope of angular momentum in entry phase
        t_entry = np.arange(entry_ang.size) / fps
        # Least-squares slope
        A = np.vstack([t_entry, np.ones(t_entry.size)]).T
        slope, _ = np.linalg.lstsq(A, entry_ang, rcond=None)[0]
        entry_torque = max(float(slope), 0.0)
    else:
        entry_torque = 0.0

    # Exit control: how smoothly does angular momentum decrease?
    # High smoothness = controlled deceleration, not a sudden crash
    exit_ang = ang_mag[exit_start:]
    if exit_ang.size >= 4:
        # SPARC-like smoothness of the exit angular momentum curve
        exit_speed = np.abs(np.diff(exit_ang)) * fps
        exit_freqs = np.fft.rfftfreq(exit_speed.size, d=1.0 / fps)
        exit_spec = np.abs(np.fft.rfft(exit_speed - np.mean(exit_speed)))
        max_spec = float(np.max(exit_spec))
        if max_spec > EPS:
            exit_spec_norm = exit_spec / max_spec
            cutoff_mask = exit_freqs <= min(10.0, fps / 2.0)
            if np.sum(cutoff_mask) >= 2:
                dfreq = np.diff(exit_freqs[cutoff_mask])
                dspec = np.diff(exit_spec_norm[cutoff_mask])
                arc = float(np.sum(np.sqrt(dfreq ** 2 + dspec ** 2)))
                # Normalise: shorter arc = smoother exit
                exit_control = float(np.clip(1.0 / (1.0 + arc), 0.0, 1.0))
            else:
                exit_control = 0.5
        else:
            exit_control = 1.0  # constant → perfectly smooth
    else:
        exit_control = 0.5

    return {
        "entry_torque": entry_torque,
        "exit_control": exit_control,
        "entry_duration": float(entry_end / fps),
        "exit_duration": float((T - exit_start) / fps),
    }


# ---------------------------------------------------------------------------
# 7. Leg extension / tuck event detection
# ---------------------------------------------------------------------------

def detect_leg_extension_events(
    joints_3d: np.ndarray,
    rotation_axis: np.ndarray,
    fps: float = 30.0,
) -> List[Dict]:
    """
    Detect frames where the dancer extends or tucks legs — the "ice skater
    effect" that changes moment of inertia and thus rotation speed.

    Finds local extrema in the leg radius (mean perpendicular distance of
    leg joints from rotation axis), then classifies each as 'extend' or 'tuck'.

    Parameters
    ----------
    joints_3d : np.ndarray  [T, 24, 3]
    rotation_axis : np.ndarray  [3]
    fps : float

    Returns
    -------
    list of dict, each with:
        frame               – frame index
        type                – 'tuck' or 'extend'
        radius_change       – change in mean leg radius (metres)
        expected_omega_change – predicted change in angular velocity
                               (positive = speed up for tuck, slow down for extend)
    """
    joints = np.asarray(joints_3d, dtype=np.float64)
    _check_min_frames(joints, "detect_leg_extension_events")
    axis = rotation_axis / (np.linalg.norm(rotation_axis) + EPS)
    com = compute_center_of_mass(joints)  # [T, 3]
    T = joints.shape[0]

    # Compute mean perpendicular distance of leg joints from axis at each frame
    leg_radius = np.zeros(T, dtype=np.float64)
    for t in range(T):
        r = joints[t, LEG_INDICES] - com[t]  # [n_legs, 3]
        r_par = np.outer(np.dot(r, axis), axis)  # [n_legs, 3]
        r_perp = r - r_par
        leg_radius[t] = float(np.mean(np.linalg.norm(r_perp, axis=-1)))

    # Smooth to remove noise
    from scipy.ndimage import gaussian_filter1d
    sigma = max(1.0, 0.05 * fps)
    leg_radius_smooth = gaussian_filter1d(leg_radius, sigma=sigma)

    # Compute actual angular velocity for cross-validation (ice skater effect)
    velocities = central_derivative(joints, fps)
    ang_mom = compute_angular_momentum(joints, velocities, com)
    L_proj = np.dot(ang_mom, axis) * _M_TOTAL  # corrected for mass normalization
    I_profile = compute_moment_of_inertia_profile(joints, axis, fps)
    I_safe = np.maximum(I_profile, EPS)
    observed_omega = L_proj / I_safe  # actual ω(t) in rad/s
    omega_smooth = gaussian_filter1d(observed_omega, sigma=sigma)

    # Find local minima (tuck) and maxima (extend) via derivative zero-crossings
    dr = np.diff(leg_radius_smooth)
    events: List[Dict] = []

    for i in range(1, len(dr)):
        if dr[i - 1] > 0 and dr[i] < 0:
            # Local maximum → extend event (legs reached maximum extension)
            event_type = "extend"
        elif dr[i - 1] < 0 and dr[i] > 0:
            # Local minimum → tuck event (legs reached maximum tuck)
            event_type = "tuck"
        else:
            continue

        frame = i  # the extremum is at index i in the smoothed radius
        radius_change = float(leg_radius_smooth[min(i + 1, T - 1)] - leg_radius_smooth[max(i - 1, 0)])

        # Expected angular velocity change from conservation of angular momentum
        # L = I * ω = const  →  Δω/ω ≈ -ΔI/I
        # Use whole-body I ratio (not just leg radius) for accurate prediction
        I_before = float(I_safe[max(i - 1, 0)])
        I_after = float(I_safe[min(i + 1, T - 1)])
        I_ratio = I_before / I_after
        expected_omega_change = float(I_ratio - 1.0)

        # Cross-validate: did omega actually change in the expected direction?
        omega_before = float(omega_smooth[max(i - 1, 0)])
        omega_after = float(omega_smooth[min(i + 1, T - 1)])
        observed_omega_change = (omega_after - omega_before) / (abs(omega_before) + EPS)

        events.append({
            "frame": int(frame),
            "type": event_type,
            "radius_change": radius_change,
            "expected_omega_change": expected_omega_change,
            "observed_omega_change": float(observed_omega_change),
            "ice_skater_validated": bool(
                np.sign(expected_omega_change) == np.sign(observed_omega_change)
                or abs(expected_omega_change) < 0.05  # negligible change
            ),
        })

    return events
