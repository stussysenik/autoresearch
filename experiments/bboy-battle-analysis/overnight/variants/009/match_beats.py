from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import gaussian_filter1d
from scipy.signal import butter, find_peaks, sosfiltfilt

try:
    import analyze_motion as motion_module
except Exception:
    motion_module = None

EPS = 1e-8
BBOY_WEIGHTS = np.array([0.05, 0.20, 0.03, 0.25, 0.10, 0.20, 0.02, 0.10, 0.05], dtype=np.float64)
BBOY_WEIGHTS /= BBOY_WEIGHTS.sum()

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

AUDIO_BANDS = {
    "sub_bass": (20.0, 60.0),
    "bass": (60.0, 250.0),
    "mid": (250.0, 2000.0),
    "high": (2000.0, 8000.0),
}


def clamp01(value: float) -> float:
    return float(np.clip(value, 0.0, 1.0))


def stable_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    if abs(float(denominator)) < EPS:
        return float(default)
    return float(numerator) / float(denominator)


def minmax_normalize(values: Sequence[float], fill: float = 0.5) -> np.ndarray:
    arr = np.asarray(values, dtype=np.float64)
    if arr.size == 0:
        return arr
    lo = float(np.nanmin(arr))
    hi = float(np.nanmax(arr))
    if hi - lo < EPS:
        return np.full(arr.shape, fill, dtype=np.float64)
    return np.clip((arr - lo) / (hi - lo), 0.0, 1.0)


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


def load_joints_file(path: str) -> np.ndarray:
    if motion_module is not None and hasattr(motion_module, "load_joints_file"):
        return motion_module.load_joints_file(path)
    file_path = Path(path)
    if file_path.suffix.lower() == ".npy":
        joints = np.load(file_path)
    else:
        data = np.load(file_path, allow_pickle=True)
        if hasattr(data, "files"):
            files = list(data.files)
            for key in ("joints", "joints_3d", "arr_0"):
                if key in files:
                    joints = data[key]
                    break
            else:
                if len(files) == 1:
                    joints = data[files[0]]
                else:
                    raise KeyError("Could not find joints array in file.")
        else:
            joints = data
    joints = np.asarray(joints, dtype=np.float64)
    if joints.ndim != 3 or joints.shape[1:] != (24, 3):
        raise ValueError("Expected joints_3d with shape [T, 24, 3].")
    return joints


def resample_series(signal: Sequence[float], src_hz: float, target_hz: float, duration_s: Optional[float] = None) -> np.ndarray:
    x = np.asarray(signal, dtype=np.float64).ravel()
    if x.size == 0:
        return np.zeros(0, dtype=np.float64)
    src_hz = max(float(src_hz), EPS)
    target_hz = max(float(target_hz), EPS)
    if duration_s is None:
        duration_s = x.size / src_hz
    duration_s = max(float(duration_s), 1.0 / target_hz)
    src_t = np.arange(x.size, dtype=np.float64) / src_hz
    target_len = max(1, int(round(duration_s * target_hz)))
    target_t = np.arange(target_len, dtype=np.float64) / target_hz
    return np.interp(target_t, src_t, x, left=float(x[0]), right=float(x[-1]))


def lagged_pearson(x: Sequence[float], y: Sequence[float], max_lag: int) -> Tuple[float, int]:
    a = np.asarray(x, dtype=np.float64).ravel()
    b = np.asarray(y, dtype=np.float64).ravel()
    n = min(a.size, b.size)
    if n < 3:
        return 0.0, 0
    a = a[:n]
    b = b[:n]
    a = (a - np.mean(a)) / (np.std(a) + EPS)
    b = (b - np.mean(b)) / (np.std(b) + EPS)

    best_corr = -1.0
    best_lag = 0
    for lag in range(-int(max_lag), int(max_lag) + 1):
        if lag < 0:
            xs = a[-lag:]
            ys = b[: n + lag]
        elif lag > 0:
            xs = a[: n - lag]
            ys = b[lag:n]
        else:
            xs = a
            ys = b
        if xs.size < 3 or ys.size < 3:
            continue
        corr = float(np.mean(xs * ys))
        if corr > best_corr:
            best_corr = corr
            best_lag = lag
    if best_corr < -0.99:
        return 0.0, 0
    return best_corr, best_lag


def safe_band_filter(signal: np.ndarray, sample_hz: float, low_hz: float, high_hz: float) -> np.ndarray:
    x = np.asarray(signal, dtype=np.float64).ravel()
    if x.size < 16:
        return x - np.mean(x)
    nyquist = 0.5 * float(sample_hz)
    if nyquist <= 0.0:
        return x - np.mean(x)
    low = max(low_hz / nyquist, 1e-4)
    high = min(high_hz / nyquist, 0.99)
    if high <= low:
        return x - np.mean(x)
    try:
        sos = butter(2, [low, high], btype="bandpass", output="sos")
        return sosfiltfilt(sos, x)
    except Exception:
        return x - np.mean(x)


def build_modulation_bands(envelope: Sequence[float], sample_hz: float) -> Dict[str, np.ndarray]:
    x = np.asarray(envelope, dtype=np.float64).ravel()
    bands = {
        "low": (0.5, 2.0),
        "mid": (2.0, 6.0),
        "high": (6.0, min(15.0, 0.45 * sample_hz)),
    }
    out: Dict[str, np.ndarray] = {}
    for name, (lo, hi) in bands.items():
        if hi <= lo + 0.1:
            continue
        filtered = safe_band_filter(x, sample_hz, lo, hi)
        out[name] = gaussian_filter1d(filtered, sigma=max(1.0, 0.01 * sample_hz))
    return out


def derive_movement_energy(joints_3d: np.ndarray, fps: float) -> np.ndarray:
    joints = np.asarray(joints_3d, dtype=np.float64)
    velocities = np.gradient(joints, axis=0) * float(fps)
    speed = np.linalg.norm(velocities, axis=-1)
    movement = speed @ JOINT_WEIGHTS
    return gaussian_filter1d(movement, sigma=max(1.0, 0.05 * fps))


def derive_motion_accents(joints_3d: np.ndarray, fps: float) -> List[Dict[str, Any]]:
    movement = derive_movement_energy(joints_3d, fps)
    derivative = np.gradient(movement) * float(fps)
    accent_env = np.maximum(0.0, derivative)
    if accent_env.size == 0 or float(np.max(accent_env)) < EPS:
        return []
    peaks, props = find_peaks(
        accent_env,
        height=max(float(np.quantile(accent_env, 0.75)), float(np.max(accent_env) * 0.25)),
        distance=max(1, int(round(0.18 * fps))),
    )
    if peaks.size == 0:
        peaks = np.array([int(np.argmax(accent_env))], dtype=np.int64)
        heights = accent_env[peaks]
    else:
        heights = np.asarray(props.get("peak_heights", accent_env[peaks]), dtype=np.float64)
    accents: List[Dict[str, Any]] = []
    for idx, peak in enumerate(peaks):
        accents.append(
            {
                "time": float(peak / fps),
                "frame": int(peak),
                "strength": float(heights[idx]),
                "type": "accent",
            }
        )
    return accents


def fallback_motion_analysis(joints_3d: np.ndarray, fps: float) -> Dict[str, Any]:
    movement_energy = derive_movement_energy(joints_3d, fps)
    motion_accents = derive_motion_accents(joints_3d, fps)
    trivium = {
        "body": {
            "score": 0.5,
            "components": {
                "technique": 0.5,
                "vocabulary": 0.5,
                "progression": 0.5,
                "cleanliness": 0.5,
            },
        },
        "mind": {
            "score": 0.5,
            "components": {
                "flow": 0.5,
                "energy_management": 0.5,
                "response_quality": 0.5,
                "stage_use": 0.5,
            },
        },
    }
    metadata = {
        "motion_accents": motion_accents,
        "kinematics": {"movement_energy_smooth": movement_energy},
        "soul_motion_priors": {"groove_lock": 0.5, "movement_tempo_bpm": 120.0},
        "trivium": trivium,
    }
    return {"features_9xN": np.full((9, 1), 0.5, dtype=np.float64), "metadata": metadata, "trivium": trivium}


def analyze_motion_input(joints_3d: np.ndarray, fps: float) -> Dict[str, Any]:
    if motion_module is not None:
        if hasattr(motion_module, "analyze"):
            return motion_module.analyze(joints_3d, fps=fps)
        if hasattr(motion_module, "extract_features"):
            features, metadata = motion_module.extract_features(joints_3d, fps=fps)
            return {"features_9xN": features, "metadata": metadata, "trivium": metadata.get("trivium", {})}
    return fallback_motion_analysis(joints_3d, fps=fps)


def compute_audio_hotness(feature_matrix: np.ndarray) -> np.ndarray:
    features = np.asarray(feature_matrix, dtype=np.float64)
    if features.ndim != 2:
        raise ValueError("Audio feature matrix must be 2D.")
    if features.shape[0] == 9:
        matrix = features
    elif features.shape[1] == 9:
        matrix = features.T
    else:
        raise ValueError("Audio feature matrix must have one dimension of size 9.")
    return BBOY_WEIGHTS @ matrix


def estimate_beat_period_samples(onset_env: Sequence[float], sample_hz: float, min_bpm: float = 60.0, max_bpm: float = 180.0) -> int:
    onset = np.asarray(onset_env, dtype=np.float64)
    if onset.size < 4:
        return max(1, int(round(sample_hz * 0.5)))
    x = onset - np.mean(onset)
    autoc = np.correlate(x, x, mode="full")[x.size - 1 :]
    min_lag = max(1, int(round(sample_hz * 60.0 / max_bpm)))
    max_lag = min(int(round(sample_hz * 60.0 / min_bpm)), autoc.size - 1)
    if max_lag <= min_lag:
        return max(1, int(round(sample_hz * 0.5)))
    lag = int(np.argmax(autoc[min_lag : max_lag + 1])) + min_lag
    return max(1, lag)


def detect_beats_from_envelope(audio_energy: Sequence[float], sample_hz: float) -> Tuple[np.ndarray, np.ndarray]:
    env = np.asarray(audio_energy, dtype=np.float64).ravel()
    if env.size == 0:
        return np.zeros(0, dtype=np.float64), np.zeros(0, dtype=np.float64)
    env = gaussian_filter1d(env, sigma=max(1.0, 0.02 * sample_hz))
    onset = np.maximum(0.0, np.diff(env, prepend=env[0]))
    beat_period = estimate_beat_period_samples(onset, sample_hz)
    peaks, props = find_peaks(
        onset,
        distance=max(1, int(round(0.8 * beat_period))),
        height=max(float(np.quantile(onset, 0.75)), float(np.max(onset) * 0.25)),
        prominence=max(float(np.quantile(onset, 0.6) * 0.2), EPS),
    )
    if peaks.size == 0:
        peaks = np.arange(0, env.size, max(1, beat_period), dtype=np.int64)
        strengths = np.ones(peaks.size, dtype=np.float64)
    else:
        strengths = np.asarray(props.get("peak_heights", onset[peaks]), dtype=np.float64)
        strengths = minmax_normalize(strengths, fill=1.0)
    return peaks / float(sample_hz), strengths


def load_audio_mapping(mapping: Mapping[str, Any]) -> Dict[str, Any]:
    payload = dict(mapping)

    audio_energy = payload.get("audio_energy")
    if audio_energy is None:
        audio_energy = payload.get("audio_hotness")
    if audio_energy is None:
        features = payload.get("features_9xN")
        if features is None:
            features = payload.get("features")
        if features is not None:
            audio_energy = compute_audio_hotness(np.asarray(features, dtype=np.float64))

    if audio_energy is None:
        raise ValueError("Could not find audio_energy or 9D audio features in payload.")

    audio_energy_arr = np.asarray(audio_energy, dtype=np.float64).ravel()

    sample_hz = payload.get("sample_hz")
    if sample_hz is None:
        segment_times = payload.get("segment_times_s")
        if segment_times is not None:
            times = np.asarray(segment_times, dtype=np.float64)
            if times.size >= 2:
                sample_hz = 1.0 / max(float(np.median(np.diff(times))), EPS)
            else:
                sample_hz = 2.0
        else:
            sample_hz = 2.0

    beat_times = payload.get("beat_times")
    beat_strengths = payload.get("beat_strengths")
    if beat_times is None:
        beat_times_arr, beat_strengths_arr = detect_beats_from_envelope(audio_energy_arr, float(sample_hz))
    else:
        beat_times_arr = np.asarray(beat_times, dtype=np.float64).ravel()
        if beat_strengths is None:
            beat_strengths_arr = np.ones(beat_times_arr.size, dtype=np.float64)
        else:
            beat_strengths_arr = np.asarray(beat_strengths, dtype=np.float64).ravel()

    if beat_strengths_arr.size != beat_times_arr.size:
        beat_strengths_arr = np.resize(beat_strengths_arr, beat_times_arr.size)

    downbeat_times = payload.get("downbeat_times")
    if downbeat_times is None:
        downbeat_times_arr = beat_times_arr[::4]
    else:
        downbeat_times_arr = np.asarray(downbeat_times, dtype=np.float64).ravel()

    audio_band_envelopes = payload.get("audio_band_envelopes")
    if isinstance(audio_band_envelopes, np.ndarray) and audio_band_envelopes.dtype == object and audio_band_envelopes.size == 1:
        audio_band_envelopes = audio_band_envelopes.item()
    if not isinstance(audio_band_envelopes, Mapping):
        audio_band_envelopes = None

    duration_s = audio_energy_arr.size / max(float(sample_hz), EPS)

    return {
        "audio_energy": audio_energy_arr,
        "beat_times": beat_times_arr,
        "downbeat_times": downbeat_times_arr,
        "beat_strengths": beat_strengths_arr,
        "audio_band_envelopes": audio_band_envelopes,
        "sample_hz": float(sample_hz),
        "duration_s": float(duration_s),
    }


def normalize_audio_samples(audio: np.ndarray) -> np.ndarray:
    audio_arr = np.asarray(audio)
    if audio_arr.ndim == 2:
        audio_arr = np.mean(audio_arr, axis=1)
    if np.issubdtype(audio_arr.dtype, np.integer):
        info = np.iinfo(audio_arr.dtype)
        audio_float = audio_arr.astype(np.float64) / max(float(max(abs(info.min), abs(info.max))), 1.0)
    else:
        audio_float = audio_arr.astype(np.float64)
        peak = float(np.max(np.abs(audio_float))) if audio_float.size else 1.0
        if peak > 1.0:
            audio_float = audio_float / peak
    return audio_float


def analyze_wav(path: str) -> Dict[str, Any]:
    sr, audio = wavfile.read(path)
    audio_float = normalize_audio_samples(audio)
    sr = float(sr)
    if audio_float.size == 0:
        raise ValueError("Empty audio file.")

    duration_s = audio_float.size / sr
    common_hz = 200.0

    full_env = gaussian_filter1d(np.abs(audio_float), sigma=max(1.0, 0.005 * sr))
    audio_energy = resample_series(full_env, sr, common_hz, duration_s)

    onset_env = np.maximum(0.0, np.diff(audio_energy, prepend=audio_energy[0]))
    beat_times, beat_strengths = detect_beats_from_envelope(onset_env, common_hz)
    downbeat_times = beat_times[::4]

    audio_band_envelopes: Dict[str, np.ndarray] = {}
    for name, (lo, hi) in AUDIO_BANDS.items():
        if hi >= 0.45 * sr:
            continue
        filtered = safe_band_filter(audio_float, sr, lo, hi)
        env = gaussian_filter1d(np.abs(filtered), sigma=max(1.0, 0.005 * sr))
        audio_band_envelopes[name] = resample_series(env, sr, common_hz, duration_s)

    return {
        "audio_energy": audio_energy,
        "beat_times": beat_times,
        "downbeat_times": downbeat_times,
        "beat_strengths": beat_strengths if beat_strengths.size == beat_times.size else np.ones_like(beat_times),
        "audio_band_envelopes": audio_band_envelopes,
        "sample_hz": common_hz,
        "duration_s": duration_s,
    }


def load_audio_features(path: str) -> Dict[str, Any]:
    file_path = Path(path)
    suffix = file_path.suffix.lower()
    if suffix == ".wav":
        return analyze_wav(path)
    if suffix == ".json":
        with open(file_path, "r", encoding="utf-8") as handle:
            return load_audio_mapping(json.load(handle))
    if suffix in (".npz", ".npy"):
        data = np.load(file_path, allow_pickle=True)
        if hasattr(data, "files"):
            payload = {key: data[key] for key in data.files}
        else:
            payload = {"audio_energy": data}
        return load_audio_mapping(payload)
    raise ValueError("Unsupported audio input. Use .wav, .json, or .npz/.npy.")


def match_accents_to_beats(
    motion_accents: Optional[Sequence[Any]] = None,
    beat_times: Optional[Sequence[float]] = None,
    downbeat_times: Optional[Sequence[float]] = None,
    beat_strengths: Optional[Sequence[float]] = None,
    delta: float = 0.070,
    joints_3d: Optional[np.ndarray] = None,
    fps: float = 30.0,
) -> Dict[str, Any]:
    if beat_times is None:
        raise ValueError("beat_times are required for accent matching.")

    if motion_accents is None:
        if joints_3d is None:
            raise ValueError("Provide motion_accents or joints_3d.")
        motion_analysis = analyze_motion_input(np.asarray(joints_3d, dtype=np.float64), fps=fps)
        motion_meta = motion_analysis.get("metadata", motion_analysis)
        motion_accents = motion_meta.get("motion_accents")
        if motion_accents is None:
            motion_accents = derive_motion_accents(np.asarray(joints_3d, dtype=np.float64), fps=fps)

    beat_times_arr = np.asarray(beat_times, dtype=np.float64).ravel()
    if downbeat_times is None:
        downbeat_times_arr = beat_times_arr[::4]
    else:
        downbeat_times_arr = np.asarray(downbeat_times, dtype=np.float64).ravel()

    if beat_strengths is None:
        beat_strengths_arr = np.ones(beat_times_arr.size, dtype=np.float64)
    else:
        beat_strengths_arr = np.asarray(beat_strengths, dtype=np.float64).ravel()
        if beat_strengths_arr.size != beat_times_arr.size:
            beat_strengths_arr = np.resize(beat_strengths_arr, beat_times_arr.size)

    accent_times: List[float] = []
    accent_strength_list: List[float] = []
    accent_types: List[str] = []

    for item in motion_accents:
        if isinstance(item, Mapping):
            accent_times.append(float(item.get("time", 0.0)))
            accent_strength_list.append(float(item.get("strength", 1.0)))
            accent_types.append(str(item.get("type", "accent")))
        else:
            accent_times.append(float(item))
            accent_strength_list.append(1.0)
            accent_types.append("accent")

    accent_times_arr = np.asarray(accent_times, dtype=np.float64)
    accent_strengths_arr = np.asarray(accent_strength_list, dtype=np.float64)

    best_result: Optional[Dict[str, Any]] = None
    for lag_s in np.linspace(-0.20, 0.20, 81):
        per_hits: List[Dict[str, Any]] = []
        hit_flags: List[float] = []
        weighted_scores: List[float] = []
        downbeat_hits: List[float] = []
        hit_lags_ms: List[float] = []

        for idx, beat_time in enumerate(beat_times_arr):
            shifted_beat = beat_time + lag_s
            if accent_times_arr.size:
                nearest_idx = int(np.argmin(np.abs(accent_times_arr - shifted_beat)))
                lag_to_accent = float(accent_times_arr[nearest_idx] - shifted_beat)
                is_hit = abs(lag_to_accent) <= delta
                strength = float(accent_strengths_arr[nearest_idx])
                accent_type = accent_types[nearest_idx]
                matched_time = float(accent_times_arr[nearest_idx])
            else:
                lag_to_accent = float("inf")
                is_hit = False
                strength = 0.0
                accent_type = "accent"
                matched_time = None

            hit_value = 1.0 if is_hit else 0.0
            weighted = beat_strengths_arr[idx] * max(0.0, 1.0 - abs(lag_to_accent) / max(delta, EPS)) if is_hit else 0.0
            is_downbeat = bool(downbeat_times_arr.size and np.min(np.abs(downbeat_times_arr - beat_time)) <= delta)

            hit_flags.append(hit_value)
            weighted_scores.append(weighted)
            if is_downbeat:
                downbeat_hits.append(hit_value)
            if is_hit:
                hit_lags_ms.append(lag_to_accent * 1000.0)

            per_hits.append(
                {
                    "beat_time_s": float(beat_time),
                    "shifted_beat_time_s": float(shifted_beat),
                    "matched_accent_time_s": matched_time,
                    "lag_ms": None if matched_time is None else float(lag_to_accent * 1000.0),
                    "beat_strength": float(beat_strengths_arr[idx]),
                    "accent_strength": strength,
                    "accent_type": accent_type,
                    "downbeat": is_downbeat,
                    "hit": bool(is_hit),
                }
            )

        accent_hit_rate = float(np.mean(hit_flags)) if hit_flags else 0.0
        weighted_hit_score = stable_div(np.sum(weighted_scores), np.sum(beat_strengths_arr) + EPS, default=0.0)
        downbeat_hit_score = float(np.mean(downbeat_hits)) if downbeat_hits else accent_hit_rate

        if hit_lags_ms:
            groove_lock = clamp01(1.0 - float(np.std(hit_lags_ms)) / (delta * 1000.0 + EPS))
        else:
            groove_lock = accent_hit_rate

        result = {
            "accent_hit_rate": clamp01(accent_hit_rate),
            "weighted_hit_score": clamp01(weighted_hit_score),
            "downbeat_hit_score": clamp01(downbeat_hit_score),
            "optimal_lag_ms": float(lag_s * 1000.0),
            "n_beats": int(beat_times_arr.size),
            "n_motion_accents": int(accent_times_arr.size),
            "n_hits": int(np.sum(hit_flags)),
            "groove_lock": groove_lock,
            "per_beat_hits": per_hits,
            "score": clamp01(weighted_hit_score),
        }

        if best_result is None or result["weighted_hit_score"] > best_result["weighted_hit_score"]:
            best_result = result

    if best_result is None:
        best_result = {
            "accent_hit_rate": 0.0,
            "weighted_hit_score": 0.0,
            "downbeat_hit_score": 0.0,
            "optimal_lag_ms": 0.0,
            "n_beats": int(beat_times_arr.size),
            "n_motion_accents": int(accent_times_arr.size),
            "n_hits": 0,
            "groove_lock": 0.0,
            "per_beat_hits": [],
            "score": 0.0,
        }
    return best_result


def spectral_cross_correlation(
    M_t: Sequence[float],
    audio_energy: Sequence[float],
    audio_band_envelopes: Optional[Mapping[str, Sequence[float]]] = None,
    fps: float = 30.0,
    sr: float = 22050.0,
    tau_max: float = 0.200,
    common_hz: float = 100.0,
    gamma: float = 0.5,
    sigma_tau: float = 0.050,
) -> Dict[str, Any]:
    motion = np.asarray(M_t, dtype=np.float64).ravel()
    audio = np.asarray(audio_energy, dtype=np.float64).ravel()
    if motion.size < 3 or audio.size < 3:
        return {
            "musicality_global": 0.5,
            "raw_correlation": 0.5,
            "correlation": 0.5,
            "optimal_lag_ms": 0.0,
            "anticipation_factor": 1.0,
            "multi_band_correlation": 0.5,
            "band_correlations": {},
        }

    duration_s = max(motion.size / max(float(fps), EPS), EPS)
    audio_hz = max(audio.size / duration_s, 1.0)

    motion_rs = resample_series(motion, fps, common_hz, duration_s)
    audio_rs = resample_series(audio, audio_hz, common_hz, duration_s)

    smooth_sigma = max(1.0, 0.03 * common_hz)
    motion_rs = gaussian_filter1d(motion_rs, sigma=smooth_sigma)
    audio_rs = gaussian_filter1d(audio_rs, sigma=smooth_sigma)

    max_lag = int(round(tau_max * common_hz))
    corr_raw, lag_samples = lagged_pearson(motion_rs, audio_rs, max_lag)
    raw_correlation = clamp01(0.5 * (corr_raw + 1.0))
    lag_s = lag_samples / float(common_hz)
    anticipation_factor = 1.0 + (gamma / 2.0) * math.erf(-lag_s / max(float(sigma_tau), EPS))
    musicality_global = clamp01(raw_correlation * anticipation_factor)

    motion_bands = build_modulation_bands(motion_rs, common_hz)
    if audio_band_envelopes:
        audio_bands: Dict[str, np.ndarray] = {}
        for name, band_signal in audio_band_envelopes.items():
            band_arr = np.asarray(band_signal, dtype=np.float64).ravel()
            band_hz = max(band_arr.size / duration_s, 1.0)
            audio_bands[str(name)] = gaussian_filter1d(
                resample_series(band_arr, band_hz, common_hz, duration_s),
                sigma=max(1.0, 0.01 * common_hz),
            )
    else:
        audio_bands = build_modulation_bands(audio_rs, common_hz)

    band_correlations: Dict[str, Dict[str, float]] = {}
    band_scores: List[float] = []
    for name, audio_band in audio_bands.items():
        motion_band = motion_bands.get(name, motion_rs)
        band_corr_raw, band_lag = lagged_pearson(motion_band, audio_band, max_lag)
        band_corr = clamp01(0.5 * (band_corr_raw + 1.0))
        band_scores.append(band_corr)
        band_correlations[name] = {
            "correlation": band_corr,
            "lag_ms": float(band_lag * 1000.0 / common_hz),
        }

    if band_scores:
        multi_band_correlation = clamp01(float(np.mean(band_scores)))
    else:
        multi_band_correlation = raw_correlation

    return {
        "musicality_global": musicality_global,
        "raw_correlation": raw_correlation,
        "correlation": raw_correlation,
        "optimal_lag_ms": float(lag_s * 1000.0),
        "anticipation_factor": float(anticipation_factor),
        "multi_band_correlation": multi_band_correlation,
        "band_correlations": band_correlations,
        "resampled_hz": float(common_hz),
    }


def compute_trivium_score(motion_analysis: Mapping[str, Any], level1: Mapping[str, Any], level2: Mapping[str, Any]) -> Dict[str, Any]:
    motion_meta = motion_analysis.get("metadata", motion_analysis)
    motion_trivium = motion_analysis.get("trivium", motion_meta.get("trivium", {}))

    body_info = motion_trivium.get("body", {})
    mind_info = motion_trivium.get("mind", {})
    body_score = clamp01(float(body_info.get("score", 0.5)))
    mind_score = clamp01(float(mind_info.get("score", 0.5)))

    body_components = dict(body_info.get("components", {}))
    mind_components = dict(mind_info.get("components", {}))

    motion_priors = motion_meta.get("soul_motion_priors", {})
    groove = clamp01(
        0.5 * float(level1.get("groove_lock", 0.5))
        + 0.5 * float(motion_priors.get("groove_lock", 0.5))
    )

    mu_ant = clamp01(float(level2.get("musicality_global", 0.5)))
    mu_multi = clamp01(float(level2.get("multi_band_correlation", level2.get("raw_correlation", 0.5))))
    mu_hit = clamp01(float(level1.get("weighted_hit_score", 0.5)))

    musicality = clamp01(0.25 * mu_ant + 0.30 * mu_multi + 0.25 * mu_hit + 0.20 * groove)
    phrasing = 0.5
    creativity = 0.5
    soul_score = clamp01(0.45 * musicality + 0.25 * phrasing + 0.30 * creativity)

    final_normalized = clamp01(0.40 * body_score + 0.35 * soul_score + 0.25 * mind_score)
    final_score_100 = 100.0 * final_normalized

    return {
        "score_100": float(final_score_100),
        "score_normalized": float(final_normalized),
        "weights": {"body": 0.40, "soul": 0.35, "mind": 0.25},
        "body": {"score": body_score, "components": body_components},
        "soul": {
            "score": soul_score,
            "components": {
                "musicality": musicality,
                "phrasing": phrasing,
                "creativity": creativity,
            },
            "musicality_components": {
                "mu_ant": mu_ant,
                "mu_multi": mu_multi,
                "mu_hit": mu_hit,
                "groove": groove,
            },
        },
        "mind": {"score": mind_score, "components": mind_components},
    }


def run_pipeline(joints_3d: np.ndarray, audio_payload: Mapping[str, Any], fps: float) -> Dict[str, Any]:
    motion_analysis = analyze_motion_input(joints_3d, fps=fps)
    motion_meta = motion_analysis.get("metadata", motion_analysis)
    movement_energy = motion_meta.get("kinematics", {}).get("movement_energy_smooth")
    if movement_energy is None:
        movement_energy = derive_movement_energy(joints_3d, fps)

    level1 = match_accents_to_beats(
        joints_3d=joints_3d,
        fps=fps,
        beat_times=audio_payload["beat_times"],
        downbeat_times=audio_payload.get("downbeat_times"),
        beat_strengths=audio_payload.get("beat_strengths"),
    )

    level2 = spectral_cross_correlation(
        M_t=movement_energy,
        audio_energy=audio_payload["audio_energy"],
        audio_band_envelopes=audio_payload.get("audio_band_envelopes"),
        fps=fps,
        common_hz=100.0,
    )

    trivium = compute_trivium_score(motion_analysis, level1, level2)

    motion_priors = motion_meta.get("soul_motion_priors", {})
    result = {
        "level1": level1,
        "level2": level2,
        "trivium": trivium,
        "motion_summary": {
            "tempo_bpm": float(motion_priors.get("movement_tempo_bpm", 0.0)),
            "n_motion_accents": int(len(motion_meta.get("motion_accents", []))),
        },
        "audio_summary": {
            "n_beats": int(np.asarray(audio_payload["beat_times"]).size),
            "duration_s": float(audio_payload.get("duration_s", 0.0)),
        },
    }
    return result


def make_synthetic_test_case(duration_s: float = 10.0, fps: float = 30.0, common_hz: float = 100.0) -> Dict[str, Any]:
    n_frames = int(round(duration_s * fps))
    joints = np.repeat(BASE_SKELETON[None, :, :], n_frames, axis=0)
    beat_times = np.arange(0.0, duration_s, 0.5, dtype=np.float64)

    burst_x = np.array([0.0, 0.25, 0.0], dtype=np.float64)[:, None]
    burst_y = np.array([0.0, -0.08, 0.0], dtype=np.float64)[:, None]
    for beat_time in beat_times:
        frame = int(round(beat_time * fps))
        if frame + 3 < n_frames:
            joints[frame : frame + 3, :, 0] += burst_x
            joints[frame : frame + 3, :, 1] += burst_y

    audio_energy = np.zeros(int(round(duration_s * common_hz)), dtype=np.float64)
    for beat_time in beat_times:
        idx = int(round(beat_time * common_hz))
        if idx < audio_energy.size:
            audio_energy[idx] = 1.0
    audio_energy = gaussian_filter1d(audio_energy, sigma=2.0)

    audio_band_envelopes = {
        "low": gaussian_filter1d(audio_energy, sigma=2.0),
        "mid": gaussian_filter1d(audio_energy, sigma=1.5),
        "high": gaussian_filter1d(audio_energy, sigma=1.0),
    }

    beat_strengths = np.ones(beat_times.size, dtype=np.float64)
    beat_strengths[::4] = 1.25

    return {
        "joints_3d": joints.astype(np.float64),
        "audio": {
            "audio_energy": audio_energy,
            "beat_times": beat_times,
            "downbeat_times": beat_times[::4],
            "beat_strengths": beat_strengths,
            "audio_band_envelopes": audio_band_envelopes,
            "sample_hz": common_hz,
            "duration_s": duration_s,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="TRIVIUM beat-motion matching and scoring.")
    parser.add_argument("--motion", help="Path to motion joints (.npz/.npy).")
    parser.add_argument("--audio", help="Path to audio analysis (.json/.npz) or waveform (.wav).")
    parser.add_argument("--fps", type=float, default=30.0, help="Motion frame rate.")
    parser.add_argument("--test", action="store_true", help="Run synthetic sync test.")
    args = parser.parse_args()

    if args.test or (args.motion is None and args.audio is None):
        synthetic = make_synthetic_test_case(duration_s=10.0, fps=args.fps, common_hz=100.0)
        result = run_pipeline(synthetic["joints_3d"], synthetic["audio"], fps=args.fps)
        result["test_pass"] = bool(float(result["level2"]["raw_correlation"]) > 0.7)
    else:
        if args.motion is None or args.audio is None:
            raise ValueError("Provide both --motion and --audio, or use --test.")
        joints_3d = load_joints_file(args.motion)
        audio_payload = load_audio_features(args.audio)
        result = run_pipeline(joints_3d, audio_payload, fps=args.fps)

    print(json.dumps(to_serializable(result), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
