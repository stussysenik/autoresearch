from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks, stft

EPS = 1e-8
SMOOTH_SIGMA_SECONDS = 0.05
SEGMENT_SECONDS = 1.0
HOP_SECONDS = 0.25

FEATURE_NAMES = [
    "movement_tempo_stability",
    "low_freq_motion_energy",
    "distal_expressivity",
    "movement_accent_strength",
    "movement_flux",
    "movement_complexity",
    "movement_periodicity",
    "motion_dynamic_range",
    "movement_groove",
]

CATEGORY_NAMES = ["toprock", "footwork", "power", "freeze", "transition"]

JOINT_MASSES_KG = {
    0: 11.17,
    1: 2.78,
    2: 2.78,
    3: 5.0,
    4: 3.28,
    5: 3.28,
    6: 3.0,
    7: 0.61,
    8: 0.61,
    9: 2.5,
    10: 0.97,
    11: 0.97,
    12: 1.5,
    13: 0.5,
    14: 0.5,
    15: 5.0,
    16: 2.0,
    17: 2.0,
    18: 1.14,
    19: 1.14,
    20: 0.45,
    21: 0.45,
    22: 0.41,
    23: 0.41,
}
JOINT_WEIGHTS = np.array([JOINT_MASSES_KG[j] for j in range(24)], dtype=np.float64)
JOINT_WEIGHTS /= JOINT_WEIGHTS.sum()

JOINT_GROUPS = {
    "legs": [1, 2, 4, 5, 7, 8, 10, 11],
    "torso": [0, 3, 6, 9],
    "arms": [13, 14, 16, 17, 18, 19],
    "hands": [20, 21, 22, 23],
    "head": [12, 15],
}

DISTAL_INDICES = [10, 11, 12, 15, 20, 21, 22, 23]
PROXIMAL_INDICES = [0, 1, 2, 3, 6, 9, 13, 14, 16, 17]

BONE_PAIRS = [
    (0, 1),
    (1, 4),
    (4, 7),
    (7, 10),
    (0, 2),
    (2, 5),
    (5, 8),
    (8, 11),
    (0, 3),
    (3, 6),
    (6, 9),
    (9, 12),
    (12, 15),
    (12, 13),
    (13, 16),
    (16, 18),
    (18, 20),
    (20, 22),
    (12, 14),
    (14, 17),
    (17, 19),
    (19, 21),
    (21, 23),
]

BASE_SKELETON = np.array(
    [
        [0.00, 0.00, 0.95],
        [-0.09, 0.00, 0.90],
        [0.09, 0.00, 0.90],
        [0.00, 0.00, 1.05],
        [-0.10, 0.00, 0.55],
        [0.10, 0.00, 0.55],
        [0.00, 0.00, 1.15],
        [-0.10, 0.00, 0.15],
        [0.10, 0.00, 0.15],
        [0.00, 0.00, 1.30],
        [-0.10, 0.08, 0.05],
        [0.10, 0.08, 0.05],
        [0.00, 0.00, 1.45],
        [-0.08, 0.00, 1.40],
        [0.08, 0.00, 1.40],
        [0.00, 0.00, 1.65],
        [-0.18, 0.00, 1.35],
        [0.18, 0.00, 1.35],
        [-0.35, 0.00, 1.20],
        [0.35, 0.00, 1.20],
        [-0.50, 0.00, 1.05],
        [0.50, 0.00, 1.05],
        [-0.58, 0.00, 1.02],
        [0.58, 0.00, 1.02],
    ],
    dtype=np.float64,
)


def clamp01(value: float) -> float:
    return float(np.clip(value, 0.0, 1.0))


def logistic(value: float) -> float:
    return float(1.0 / (1.0 + math.exp(-float(value))))


def stable_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    if abs(float(denominator)) < EPS:
        return float(default)
    return float(numerator) / float(denominator)


def to_serializable(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {str(key): to_serializable(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_serializable(value) for value in obj]
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.floating, np.integer)):
        value = obj.item()
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


def validate_joints(joints_3d: np.ndarray) -> np.ndarray:
    joints = np.asarray(joints_3d, dtype=np.float64)
    if joints.ndim != 3 or joints.shape[1:] != (24, 3):
        raise ValueError("Expected joints_3d with shape [T, 24, 3].")
    if joints.shape[0] < 8:
        raise ValueError("Need at least 8 frames of motion.")
    return joints


def minmax_normalize(values: Sequence[float], fill: float = 0.5) -> np.ndarray:
    arr = np.asarray(values, dtype=np.float64)
    if arr.size == 0:
        return arr
    finite = np.isfinite(arr)
    if not np.any(finite):
        return np.full(arr.shape, fill, dtype=np.float64)
    lo = float(np.nanmin(arr))
    hi = float(np.nanmax(arr))
    if hi - lo < EPS:
        return np.full(arr.shape, fill, dtype=np.float64)
    out = (arr - lo) / (hi - lo)
    out[~finite] = fill
    return np.clip(out, 0.0, 1.0)


def build_segments(n_frames: int, window: int, hop: int) -> List[Tuple[int, int]]:
    window = max(4, min(int(window), n_frames))
    hop = max(1, int(hop))
    starts = list(range(0, max(n_frames - window + 1, 1), hop))
    last_start = max(0, n_frames - window)
    if not starts or starts[-1] != last_start:
        starts.append(last_start)
    deduped: List[int] = []
    seen = set()
    for start in starts:
        if start not in seen:
            deduped.append(start)
            seen.add(start)
    return [(start, min(n_frames, start + window)) for start in deduped]


def central_derivative(values: np.ndarray, fps: float) -> np.ndarray:
    return np.gradient(values, axis=0) * float(fps)


def weighted_mean_profile(values: np.ndarray, indices: Sequence[int]) -> np.ndarray:
    idx = np.asarray(indices, dtype=np.int64)
    if values.shape[0] == 0:
        return np.zeros(0, dtype=np.float64)
    weights = JOINT_WEIGHTS[idx]
    weights = weights / (weights.sum() + EPS)
    return values[:, idx] @ weights


def autocorr_at_lag(signal: Sequence[float], lag: int) -> float:
    x = np.asarray(signal, dtype=np.float64)
    lag = int(lag)
    if x.size < 3 or lag < 1 or lag >= x.size:
        return 0.0
    a = x[:-lag]
    b = x[lag:]
    a = a - np.mean(a)
    b = b - np.mean(b)
    denom = math.sqrt(float(np.mean(a * a) * np.mean(b * b))) + EPS
    return float(np.mean(a * b) / denom)


def band_power(signal: Sequence[float], fps: float, low_hz: float, high_hz: float) -> float:
    x = np.asarray(signal, dtype=np.float64)
    if x.size < 4:
        return 0.0
    x = x - np.mean(x)
    window = np.hanning(x.size)
    spectrum = np.abs(np.fft.rfft(x * window)) ** 2
    freqs = np.fft.rfftfreq(x.size, d=1.0 / fps)
    mask = (freqs >= low_hz) & (freqs < high_hz)
    if not np.any(mask):
        return 0.0
    return float(np.mean(spectrum[mask]))


def spectral_flatness(signal: Sequence[float]) -> float:
    x = np.asarray(signal, dtype=np.float64)
    if x.size < 4:
        return 1.0
    spectrum = np.abs(np.fft.rfft(x - np.mean(x))) + EPS
    return float(np.exp(np.mean(np.log(spectrum))) / np.mean(spectrum))


def estimate_dominant_lag(signal: Sequence[float], fps: float, min_hz: float = 0.5, max_hz: float = 4.0) -> int:
    x = np.asarray(signal, dtype=np.float64)
    if x.size < 8:
        return max(1, int(round(fps / 2.0)))
    x = x - np.mean(x)
    freqs = np.fft.rfftfreq(x.size, d=1.0 / fps)
    spectrum = np.abs(np.fft.rfft(x))
    mask = (freqs >= min_hz) & (freqs <= max_hz)
    if not np.any(mask) or float(np.max(spectrum[mask])) < EPS:
        return max(1, int(round(fps / 2.0)))
    dom_freq = float(freqs[mask][int(np.argmax(spectrum[mask]))])
    if dom_freq < EPS:
        return max(1, int(round(fps / 2.0)))
    return max(1, int(round(fps / dom_freq)))


def sparc(speed_profile: Sequence[float], fps: float) -> float:
    x = np.asarray(speed_profile, dtype=np.float64)
    if x.size < 4:
        return 0.0
    x = x - np.mean(x)
    freqs = np.fft.rfftfreq(x.size, d=1.0 / fps)
    spec = np.abs(np.fft.rfft(x))
    if float(np.max(spec)) < EPS:
        return 0.0
    spec = spec / (np.max(spec) + EPS)
    cutoff = min(20.0, fps / 2.0)
    mask = freqs <= cutoff
    if np.count_nonzero(mask) < 2:
        return 0.0
    dfreq = np.diff(freqs[mask])
    dspec = np.diff(spec[mask])
    arc_length = -np.sum(np.sqrt(dfreq * dfreq + dspec * dspec))
    return float(arc_length)


def ldlj(speed_profile: Sequence[float], fps: float) -> float:
    x = np.asarray(speed_profile, dtype=np.float64)
    if x.size < 5:
        return 0.0
    duration = x.size / float(fps)
    jerk_sq = np.sum(np.diff(x, n=3) ** 2) * (fps ** 3)
    v_peak = max(float(np.max(np.abs(x))), EPS)
    return float(-np.log(abs((duration ** 3 / (v_peak * v_peak + EPS)) * jerk_sq) + EPS))


def shannon_entropy_normalized(counts: Sequence[float], n_categories: int) -> float:
    counts_arr = np.asarray(counts, dtype=np.float64)
    if counts_arr.size == 0 or float(np.sum(counts_arr)) < EPS:
        return 0.0
    p = counts_arr / (np.sum(counts_arr) + EPS)
    p = p[p > 0]
    if p.size == 0:
        return 0.0
    entropy = -np.sum(p * np.log2(p))
    return clamp01(float(entropy / math.log2(float(n_categories))))


def spatial_entropy(com_xy: np.ndarray, grid_size: int = 10) -> float:
    xy = np.asarray(com_xy, dtype=np.float64)
    if xy.ndim != 2 or xy.shape[0] == 0 or xy.shape[1] != 2:
        return 0.0
    if np.allclose(xy, xy[0]):
        return 0.0
    hist, _, _ = np.histogram2d(xy[:, 0], xy[:, 1], bins=grid_size)
    p = hist.reshape(-1)
    if float(np.sum(p)) < EPS:
        return 0.0
    p = p / (np.sum(p) + EPS)
    p = p[p > 0]
    return clamp01(float(-np.sum(p * np.log2(p)) / math.log2(float(grid_size * grid_size))))


def load_joints_file(path: str) -> np.ndarray:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(path)
    if file_path.suffix.lower() == ".npy":
        return validate_joints(np.load(file_path))
    data = np.load(file_path, allow_pickle=True)
    if hasattr(data, "files"):
        files = list(data.files)
        for key in ("joints", "joints_3d", "arr_0"):
            if key in files:
                return validate_joints(data[key])
        if len(files) == 1:
            return validate_joints(data[files[0]])
        raise KeyError("Could not find joints array in npz file.")
    return validate_joints(data)


def compute_bone_angular_velocity(joints_3d: np.ndarray, fps: float) -> np.ndarray:
    n_frames = joints_3d.shape[0]
    all_bones: List[np.ndarray] = []
    for parent, child in BONE_PAIRS:
        bone = joints_3d[:, child] - joints_3d[:, parent]
        norm = np.linalg.norm(bone, axis=-1, keepdims=True)
        unit = bone / np.maximum(norm, EPS)
        if n_frames < 2:
            angular = np.zeros((n_frames,), dtype=np.float64)
        else:
            cosang = np.sum(unit[1:] * unit[:-1], axis=-1)
            angular = np.arccos(np.clip(cosang, -1.0, 1.0)) * fps
            angular = np.concatenate([angular[:1], angular], axis=0)
        all_bones.append(angular)
    return np.stack(all_bones, axis=1)


def compute_center_of_mass(joints_3d: np.ndarray) -> np.ndarray:
    return np.tensordot(joints_3d, JOINT_WEIGHTS, axes=([1], [0]))


def compute_angular_momentum(joints_3d: np.ndarray, velocities: np.ndarray, com: np.ndarray) -> np.ndarray:
    relative = joints_3d - com[:, None, :]
    momentum = velocities * JOINT_WEIGHTS[None, :, None]
    return np.sum(np.cross(relative, momentum), axis=1)


def compute_motion_spectrogram(speed: np.ndarray, fps: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    if speed.shape[0] < 4:
        return (
            np.zeros(0, dtype=np.float64),
            np.zeros(0, dtype=np.float64),
            np.zeros((0, 0), dtype=np.float64),
        )
    nperseg = min(64, speed.shape[0])
    noverlap = min(max(0, nperseg - 8), nperseg - 1)
    weighted_power = None
    freqs = np.zeros(0, dtype=np.float64)
    times = np.zeros(0, dtype=np.float64)
    for joint_idx in range(speed.shape[1]):
        freqs, times, zxx = stft(
            speed[:, joint_idx],
            fs=fps,
            nperseg=nperseg,
            noverlap=noverlap,
            boundary=None,
        )
        power = np.abs(zxx) ** 2
        contribution = JOINT_WEIGHTS[joint_idx] * power
        if weighted_power is None:
            weighted_power = contribution
        else:
            weighted_power += contribution
    if weighted_power is None:
        weighted_power = np.zeros((0, 0), dtype=np.float64)
    return freqs, times, weighted_power


def detect_motion_accents(movement_energy: np.ndarray, fps: float) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    smooth = gaussian_filter1d(movement_energy, sigma=max(1.0, SMOOTH_SIGMA_SECONDS * fps))
    derivative = np.gradient(smooth) * fps
    accent_env = np.maximum(0.0, derivative)
    accents: List[Dict[str, Any]] = []
    if accent_env.size == 0 or float(np.max(accent_env)) < EPS:
        return accent_env, accents
    peak_height = max(float(np.quantile(accent_env, 0.75)), float(np.max(accent_env) * 0.25))
    peaks, props = find_peaks(
        accent_env,
        height=peak_height,
        distance=max(1, int(round(0.18 * fps))),
        prominence=max(float(np.quantile(accent_env, 0.6) * 0.25), EPS),
    )
    if peaks.size == 0:
        peaks = np.array([int(np.argmax(accent_env))], dtype=np.int64)
        props = {"peak_heights": accent_env[peaks]}
    heights = np.asarray(props.get("peak_heights", accent_env[peaks]), dtype=np.float64)
    for idx, peak in enumerate(peaks):
        accents.append(
            {
                "frame": int(peak),
                "time": float(peak / fps),
                "strength": float(heights[idx]),
                "type": "accent",
            }
        )
    return accent_env, accents


def generate_synthetic_joints(duration_s: float = 10.0, fps: float = 30.0) -> np.ndarray:
    n_frames = int(round(duration_s * fps))
    t = np.arange(n_frames, dtype=np.float64) / float(fps)
    joints = np.repeat(BASE_SKELETON[None, :, :], n_frames, axis=0)

    joint_phase = np.linspace(0.0, 1.2 * math.pi, 24)
    base_phase = 2.0 * math.pi * (1.6 * t + 0.05 * t * t)
    sway = 0.20 * np.sin(2.0 * math.pi * 0.16 * t)
    depth = 0.12 * np.cos(2.0 * math.pi * 0.12 * t)

    joints[:, :, 0] += sway[:, None]
    joints[:, :, 1] += depth[:, None]
    joints[:, :, 2] += 0.02 * np.sin(2.0 * math.pi * 0.4 * t)[:, None]

    joints[:, :, 0] += 0.03 * np.sin(base_phase[:, None] + joint_phase[None, :])
    joints[:, :, 1] += 0.02 * np.cos(0.5 * base_phase[:, None] + 1.3 * joint_phase[None, :])

    legs = JOINT_GROUPS["legs"]
    arms = JOINT_GROUPS["arms"] + JOINT_GROUPS["hands"]
    head = JOINT_GROUPS["head"]

    joints[:, legs, 0] += 0.09 * np.sin(1.25 * base_phase[:, None] + joint_phase[legs][None])
    joints[:, legs, 1] += 0.05 * np.cos(1.15 * base_phase[:, None] + joint_phase[legs][None])
    joints[:, arms, 0] += 0.12 * np.sin(0.85 * base_phase[:, None] + joint_phase[arms][None])
    joints[:, arms, 2] += 0.05 * np.sin(0.55 * base_phase[:, None] + joint_phase[arms][None])
    joints[:, head, 2] += 0.04 * np.sin(0.35 * base_phase[:, None])

    mid_mask = (t >= duration_s / 3.0) & (t < 2.0 * duration_s / 3.0)
    joints[mid_mask, :, 2] -= 0.14
    joints[mid_mask][:, legs, 0] += 0.04 * np.sin(2.2 * base_phase[mid_mask, None])

    burst_times = np.arange(2.0 * duration_s / 3.0, duration_s, 1.0)
    for burst_time in burst_times:
        frame = int(round(burst_time * fps))
        if frame + 3 < n_frames:
            burst = np.array([0.0, 0.22, 0.0], dtype=np.float64)[:, None]
            joints[frame : frame + 3, :, 0] += burst
            joints[frame : frame + 3, :, 1] -= 0.08 * burst

    return joints.astype(np.float64)


def extract_features(joints_3d: np.ndarray, fps: float = 30.0) -> Tuple[np.ndarray, Dict[str, Any]]:
    joints = validate_joints(joints_3d)
    fps = float(fps)

    velocities = central_derivative(joints, fps)
    accelerations = central_derivative(velocities, fps)
    jerks = central_derivative(accelerations, fps)

    speed = np.linalg.norm(velocities, axis=-1)
    weighted_speed = speed @ JOINT_WEIGHTS
    jerk_mag = np.linalg.norm(jerks, axis=-1)
    weighted_jerk = jerk_mag @ JOINT_WEIGHTS

    com = compute_center_of_mass(joints)
    com_vel = central_derivative(com, fps)
    com_speed = np.linalg.norm(com_vel, axis=-1)

    bone_ang_vel = compute_bone_angular_velocity(joints, fps)
    angular_momentum = compute_angular_momentum(joints, velocities, com)
    angular_momentum_mag = np.linalg.norm(angular_momentum, axis=-1)

    movement_energy = weighted_speed
    movement_energy_smooth = gaussian_filter1d(movement_energy, sigma=max(1.0, SMOOTH_SIGMA_SECONDS * fps))
    accent_envelope, motion_accents = detect_motion_accents(movement_energy_smooth, fps)

    weighted_joint_speed = speed * JOINT_WEIGHTS[None, :]
    speed_probs = weighted_joint_speed / np.maximum(np.sum(weighted_joint_speed, axis=1, keepdims=True), EPS)
    joint_activity_entropy = -np.sum(
        speed_probs * np.log2(np.clip(speed_probs, EPS, 1.0)),
        axis=1,
    ) / math.log2(24.0)

    dominant_lag = estimate_dominant_lag(movement_energy_smooth, fps)
    movement_tempo_bpm = 60.0 * fps / max(float(dominant_lag), 1.0)

    segment_window = max(8, int(round(SEGMENT_SECONDS * fps)))
    segment_hop = max(1, int(round(HOP_SECONDS * fps)))
    segments = build_segments(joints.shape[0], segment_window, segment_hop)

    track_low_energy = float(np.quantile(movement_energy_smooth, 0.30))
    track_low_com_speed = float(np.quantile(com_speed, 0.30))

    raw_rows: List[List[float]] = [[] for _ in range(len(FEATURE_NAMES))]
    segment_records: List[Dict[str, Any]] = []
    segment_times_s: List[float] = []

    ang_peak_raw: List[float] = []
    angmom_peak_raw: List[float] = []
    energy_peak_raw: List[float] = []
    wobble_raw: List[float] = []
    sparc_raw: List[float] = []
    ldlj_raw: List[float] = []

    for start, end in segments:
        seg = slice(start, end)
        seg_duration = max((end - start) / fps, EPS)

        mseg = movement_energy_smooth[seg]
        aseg = accent_envelope[seg]
        speed_seg = speed[seg]
        com_seg = com[seg]
        com_speed_seg = com_speed[seg]
        weighted_jerk_seg = weighted_jerk[seg]
        ang_seg = bone_ang_vel[seg]
        angmom_seg = angular_momentum_mag[seg]

        distal_speed = float(np.mean(weighted_mean_profile(speed_seg, DISTAL_INDICES)))
        proximal_speed = float(np.mean(weighted_mean_profile(speed_seg, PROXIMAL_INDICES)))
        torso_speed = float(np.mean(weighted_mean_profile(speed_seg, JOINT_GROUPS["torso"] + [1, 2])))
        leg_speed = float(np.mean(weighted_mean_profile(speed_seg, JOINT_GROUPS["legs"])))
        arm_speed = float(np.mean(weighted_mean_profile(speed_seg, JOINT_GROUPS["arms"] + JOINT_GROUPS["hands"])))

        lag_local = min(max(1, dominant_lag), max(1, mseg.size - 1))
        tempo_stability = 0.5 * (autocorr_at_lag(mseg, lag_local) + 1.0)
        low_freq_energy = band_power(mseg, fps, 0.0, 2.0)
        distal_expressivity = stable_div(distal_speed, proximal_speed + EPS, default=1.0)
        accent_strength = float(np.max(aseg)) if aseg.size else 0.0
        movement_flux = float(np.mean(np.maximum(0.0, np.diff(mseg)))) if mseg.size > 1 else 0.0

        if aseg.size > 0 and float(np.max(aseg)) > EPS:
            local_peak_height = max(float(np.quantile(aseg, 0.70)), float(np.max(aseg) * 0.25))
            local_peaks, _ = find_peaks(
                aseg,
                height=local_peak_height,
                distance=max(1, int(round(0.20 * fps))),
            )
        else:
            local_peaks = np.zeros(0, dtype=np.int64)

        accent_density = float(local_peaks.size / seg_duration)
        if local_peaks.size >= 3:
            iois = np.diff(local_peaks) / fps
            irregularity = float(np.std(iois) / (np.mean(iois) + EPS))
        else:
            irregularity = 0.0
        movement_complexity = accent_density + irregularity

        if mseg.size >= 4:
            spectrum = np.abs(np.fft.rfft(mseg - np.mean(mseg)))
            freqs = np.fft.rfftfreq(mseg.size, d=1.0 / fps)
            band_mask = (freqs >= 0.5) & (freqs <= min(10.0, fps / 2.0))
            band_spec = spectrum[band_mask]
            if band_spec.size > 0 and float(np.max(band_spec)) > EPS:
                peak_count = find_peaks(band_spec, height=float(np.max(band_spec) * 0.30))[0].size
                peak_count_norm = min(peak_count / 4.0, 1.0)
                movement_periodicity = 0.5 * peak_count_norm + 0.5 * (1.0 - spectral_flatness(mseg))
            else:
                movement_periodicity = 0.0
        else:
            movement_periodicity = 0.0

        rms_speed = math.sqrt(float(np.mean(mseg * mseg))) + EPS
        motion_dynamic_range = float(np.max(np.abs(mseg)) / rms_speed)

        groove_corr_main = autocorr_at_lag(mseg, lag_local)
        groove_corr_sub = autocorr_at_lag(mseg, max(1, lag_local // 2))
        movement_groove = 0.5 * (((groove_corr_main + groove_corr_sub) * 0.5) + 1.0)

        raw_rows[0].append(float(tempo_stability))
        raw_rows[1].append(float(low_freq_energy))
        raw_rows[2].append(float(distal_expressivity))
        raw_rows[3].append(float(accent_strength))
        raw_rows[4].append(float(movement_flux))
        raw_rows[5].append(float(movement_complexity))
        raw_rows[6].append(float(movement_periodicity))
        raw_rows[7].append(float(motion_dynamic_range))
        raw_rows[8].append(float(movement_groove))

        segment_sparc = sparc(com_speed_seg, fps)
        segment_ldlj = ldlj(com_speed_seg, fps)
        hold_mask = (com_speed_seg < max(track_low_com_speed, 0.04)) | (mseg < track_low_energy)
        if np.any(hold_mask):
            wobble = float(np.mean(weighted_jerk_seg[hold_mask]))
        else:
            wobble = float(np.mean(weighted_jerk_seg))

        ang_peak = float(np.quantile(ang_seg, 0.95)) if ang_seg.size else 0.0
        angmom_peak = float(np.quantile(angmom_seg, 0.95)) if angmom_seg.size else 0.0
        energy_peak = float(np.quantile(mseg, 0.95)) if mseg.size else 0.0
        freeze_score = 0.5 * float(np.mean(com_speed_seg < max(track_low_com_speed, 0.04))) + 0.5 * float(
            np.mean(mseg < track_low_energy)
        )

        ang_peak_raw.append(ang_peak)
        angmom_peak_raw.append(angmom_peak)
        energy_peak_raw.append(energy_peak)
        wobble_raw.append(wobble)
        sparc_raw.append(segment_sparc)
        ldlj_raw.append(segment_ldlj)

        center_time = ((start + end - 1) * 0.5) / fps
        segment_times_s.append(float(center_time))
        segment_records.append(
            {
                "start_frame": int(start),
                "end_frame": int(end),
                "start_time_s": float(start / fps),
                "end_time_s": float(end / fps),
                "height_m": float(np.mean(com_seg[:, 2])),
                "energy_mean": float(np.mean(mseg)),
                "energy_peak_raw": energy_peak,
                "com_speed_mean": float(np.mean(com_speed_seg)),
                "leg_ratio": stable_div(leg_speed, torso_speed + EPS, default=1.0),
                "arm_ratio": stable_div(arm_speed, torso_speed + EPS, default=1.0),
                "freeze_score": freeze_score,
                "angular_peak_raw": ang_peak,
                "angular_momentum_peak_raw": angmom_peak,
                "wobble_raw": wobble,
                "sparc_raw": segment_sparc,
                "ldlj_raw": segment_ldlj,
                "phase": "transition",
            }
        )

    raw_feature_matrix = np.vstack([np.asarray(row, dtype=np.float64) for row in raw_rows])
    raw_feature_matrix = np.nan_to_num(raw_feature_matrix, nan=0.0, posinf=0.0, neginf=0.0)
    normalized_feature_matrix = np.vstack([minmax_normalize(row, fill=0.5) for row in raw_feature_matrix])

    difficulty = np.clip(
        0.45 * minmax_normalize(ang_peak_raw, fill=0.5)
        + 0.35 * minmax_normalize(angmom_peak_raw, fill=0.5)
        + 0.20 * minmax_normalize(energy_peak_raw, fill=0.5),
        0.0,
        1.0,
    )
    wobble_inverse = 1.0 - minmax_normalize(wobble_raw, fill=0.5)
    sparc_norm = minmax_normalize(sparc_raw, fill=0.5)
    ldlj_norm = minmax_normalize(ldlj_raw, fill=0.5)

    quality = np.clip(0.40 * wobble_inverse + 0.30 * sparc_norm + 0.30 * ldlj_norm, 0.0, 1.0)
    clean_per_segment = np.clip(0.50 * wobble_inverse + 0.25 * sparc_norm + 0.25 * ldlj_norm, 0.0, 1.0)

    heights = np.array([record["height_m"] for record in segment_records], dtype=np.float64)
    energies = np.array([record["energy_mean"] for record in segment_records], dtype=np.float64)
    leg_ratios = np.array([record["leg_ratio"] for record in segment_records], dtype=np.float64)
    arm_ratios = np.array([record["arm_ratio"] for record in segment_records], dtype=np.float64)
    freeze_scores = np.array([record["freeze_score"] for record in segment_records], dtype=np.float64)
    angmom_peaks = np.array([record["angular_momentum_peak_raw"] for record in segment_records], dtype=np.float64)
    wobble_vals = np.array([record["wobble_raw"] for record in segment_records], dtype=np.float64)

    q_height_low = float(np.quantile(heights, 0.35)) if heights.size else 0.0
    q_height_high = float(np.quantile(heights, 0.65)) if heights.size else 0.0
    q_energy_high = float(np.quantile(energies, 0.75)) if energies.size else 0.0
    q_leg = float(np.quantile(leg_ratios, 0.55)) if leg_ratios.size else 0.0
    q_arm = float(np.quantile(arm_ratios, 0.55)) if arm_ratios.size else 0.0
    q_angmom = float(np.quantile(angmom_peaks, 0.80)) if angmom_peaks.size else 0.0
    q_freeze = float(np.quantile(freeze_scores, 0.70)) if freeze_scores.size else 0.0
    q_wobble = float(np.quantile(wobble_vals, 0.50)) if wobble_vals.size else 0.0

    phase_labels: List[str] = []
    for idx, record in enumerate(segment_records):
        if freeze_scores[idx] >= max(0.50, q_freeze) and wobble_vals[idx] <= q_wobble:
            phase = "freeze"
        elif angmom_peaks[idx] >= q_angmom and energies[idx] >= q_energy_high:
            phase = "power"
        elif heights[idx] <= q_height_low and leg_ratios[idx] >= q_leg:
            phase = "footwork"
        elif heights[idx] >= q_height_high and arm_ratios[idx] >= q_arm:
            phase = "toprock"
        else:
            phase = "transition"
        phase_labels.append(phase)
        record["phase"] = phase
        record["difficulty"] = float(difficulty[idx])
        record["quality"] = float(quality[idx])
        record["cleanliness"] = float(clean_per_segment[idx])

    phase_counts = {name: int(sum(label == name for label in phase_labels)) for name in CATEGORY_NAMES}
    vocab_counts = np.array([phase_counts[name] for name in CATEGORY_NAMES], dtype=np.float64)

    if segment_times_s:
        segment_centers = np.asarray(segment_times_s, dtype=np.float64)
        for accent in motion_accents:
            seg_idx = int(np.argmin(np.abs(segment_centers - float(accent["time"]))))
            accent["type"] = phase_labels[seg_idx]

    technique = stable_div(np.sum(difficulty * quality), np.sum(difficulty) + EPS, default=float(np.mean(quality)))
    vocabulary = shannon_entropy_normalized(vocab_counts, len(CATEGORY_NAMES))

    if len(segment_times_s) >= 2:
        slope = float(np.polyfit(np.asarray(segment_times_s), difficulty, 1)[0])
        duration_scale = max(segment_times_s[-1] - segment_times_s[0], 1.0)
        progression = clamp01(logistic(slope * duration_scale * 4.0))
    else:
        progression = 0.5

    cleanliness = clamp01(float(np.mean(clean_per_segment)))

    body_score = clamp01(
        0.40 * technique
        + 0.20 * vocabulary
        + 0.15 * progression
        + 0.25 * cleanliness
    )

    transition_cost = float(np.mean(np.abs(np.diff(com_speed)))) / (float(np.mean(com_speed)) + EPS)
    bound_free_ratio = 1.0 / (1.0 + transition_cost)
    flow = clamp01(0.45 * float(np.mean(sparc_norm)) + 0.35 * float(np.mean(ldlj_norm)) + 0.20 * bound_free_ratio)

    kinetic_energy = 0.5 * ((speed ** 2) @ JOINT_WEIGHTS)
    thirds = np.array_split(kinetic_energy, 3)
    e1 = float(np.mean(thirds[0])) if thirds[0].size else 0.0
    e3 = float(np.mean(thirds[2])) if thirds[2].size else 0.0
    energy_management = clamp01(1.0 - max(0.0, stable_div(e1 - e3, e1 + EPS, default=0.0)))

    stage_use = spatial_entropy(com[:, :2], grid_size=10)
    response_quality = 0.5

    mind_score = clamp01(
        0.30 * flow
        + 0.20 * energy_management
        + 0.30 * response_quality
        + 0.20 * stage_use
    )

    groove_lock = clamp01(float(np.mean(normalized_feature_matrix[8])))
    accent_density_track = float(len(motion_accents) / max(joints.shape[0] / fps, EPS))

    spec_freqs, spec_times, spec_power = compute_motion_spectrogram(speed, fps)
    if spec_power.ndim == 2 and spec_power.size:
        low_band = np.mean(spec_power[(spec_freqs >= 0.0) & (spec_freqs < 2.0)], axis=0) if np.any(
            (spec_freqs >= 0.0) & (spec_freqs < 2.0)
        ) else np.zeros(spec_power.shape[1], dtype=np.float64)
        mid_band = np.mean(spec_power[(spec_freqs >= 2.0) & (spec_freqs < 6.0)], axis=0) if np.any(
            (spec_freqs >= 2.0) & (spec_freqs < 6.0)
        ) else np.zeros(spec_power.shape[1], dtype=np.float64)
        high_band = np.mean(spec_power[(spec_freqs >= 6.0) & (spec_freqs <= min(15.0, fps / 2.0))], axis=0) if np.any(
            (spec_freqs >= 6.0) & (spec_freqs <= min(15.0, fps / 2.0))
        ) else np.zeros(spec_power.shape[1], dtype=np.float64)
    else:
        low_band = np.zeros(0, dtype=np.float64)
        mid_band = np.zeros(0, dtype=np.float64)
        high_band = np.zeros(0, dtype=np.float64)

    metadata: Dict[str, Any] = {
        "fps": fps,
        "n_frames": int(joints.shape[0]),
        "feature_names": FEATURE_NAMES,
        "segment_window_frames": segment_window,
        "segment_hop_frames": segment_hop,
        "segment_times_s": np.asarray(segment_times_s, dtype=np.float64),
        "raw_features_9xN": raw_feature_matrix,
        "normalized_features_9xN": normalized_feature_matrix,
        "phase_counts": phase_counts,
        "phase_labels": phase_labels,
        "motion_accents": motion_accents,
        "soul_motion_priors": {
            "groove_lock": groove_lock,
            "movement_tempo_bpm": float(movement_tempo_bpm),
            "accent_density": accent_density_track,
            "accent_strength_mean": float(np.mean(normalized_feature_matrix[3])),
        },
        "kinematics": {
            "velocities": velocities,
            "accelerations": accelerations,
            "jerks": jerks,
            "speed": speed,
            "movement_energy": movement_energy,
            "movement_energy_smooth": movement_energy_smooth,
            "accent_envelope": accent_envelope,
            "center_of_mass": com,
            "center_of_mass_speed": com_speed,
            "angular_velocity": bone_ang_vel,
            "angular_momentum": angular_momentum,
            "angular_momentum_magnitude": angular_momentum_mag,
            "weighted_jerk": weighted_jerk,
            "joint_activity_entropy": joint_activity_entropy,
            "kinetic_energy": kinetic_energy,
        },
        "spectrogram": {
            "frequencies_hz": spec_freqs,
            "times_s": spec_times,
            "low_band_power": low_band,
            "mid_band_power": mid_band,
            "high_band_power": high_band,
        },
        "segment_metrics": segment_records,
        "trivium": {
            "body": {
                "score": body_score,
                "components": {
                    "technique": technique,
                    "vocabulary": vocabulary,
                    "progression": progression,
                    "cleanliness": cleanliness,
                },
            },
            "mind": {
                "score": mind_score,
                "components": {
                    "flow": flow,
                    "energy_management": energy_management,
                    "response_quality": response_quality,
                    "stage_use": stage_use,
                },
            },
        },
    }

    return np.clip(normalized_feature_matrix, 0.0, 1.0), metadata


def analyze(joints_3d: np.ndarray, fps: float = 30.0) -> Dict[str, Any]:
    features, metadata = extract_features(joints_3d, fps=fps)
    return {
        "feature_names": FEATURE_NAMES,
        "features_9xN": features,
        "trivium": metadata["trivium"],
        "metadata": metadata,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="TRIVIUM motion feature extraction from SMPL joints.")
    parser.add_argument("joints", nargs="?", help="Path to .npz/.npy file containing joints or joints_3d.")
    parser.add_argument("--fps", type=float, default=30.0, help="Frame rate for the joints input.")
    parser.add_argument("--test", action="store_true", help="Run synthetic test mode.")
    args = parser.parse_args()

    if args.test or args.joints is None:
        joints = generate_synthetic_joints(duration_s=10.0, fps=args.fps)
    else:
        joints = load_joints_file(args.joints)

    result = analyze(joints, fps=args.fps)
    print(json.dumps(to_serializable(result), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
