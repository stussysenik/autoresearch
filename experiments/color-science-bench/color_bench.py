from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
from pathlib import Path
from typing import Callable

import numpy as np

WAVELENGTHS = np.arange(380.0, 781.0, 5.0, dtype=float)
ROOT = Path(__file__).resolve().parent
MEASURED_DATA_DIR = ROOT / "data" / "measured"
MEASURED_MANIFEST_PATH = MEASURED_DATA_DIR / "manifest.json"

BRADFORD_MATRIX = np.array(
    [
        [0.8951, 0.2664, -0.1614],
        [-0.7502, 1.7135, 0.0367],
        [0.0389, -0.0685, 1.0296],
    ],
    dtype=float,
)

CAT16_MATRIX = np.array(
    [
        [0.401288, 0.650173, -0.051461],
        [-0.250268, 1.204414, 0.045854],
        [-0.002079, 0.048952, 0.953127],
    ],
    dtype=float,
)


@dataclass(frozen=True)
class SpectralCase:
    name: str
    reflectance_name: str
    illuminant_name: str
    reflectance: np.ndarray
    illuminant: np.ndarray
    white_xyz: np.ndarray
    xyz: np.ndarray


@dataclass(frozen=True)
class AdaptationCase:
    name: str
    reflectance_name: str
    source_illuminant_name: str
    source_xyz: np.ndarray
    source_white_xyz: np.ndarray
    target_white_xyz: np.ndarray
    reference_xyz: np.ndarray
    is_neutral: bool


@dataclass(frozen=True)
class DistanceCase:
    name: str
    illuminant_name: str
    xyz_a: np.ndarray
    xyz_b: np.ndarray
    white_xyz: np.ndarray
    reference_delta_e00: float


@dataclass(frozen=True)
class BenchmarkResult:
    total_score: float
    spectral_delta_e00: float
    spectral_xyz_rmse: float
    adaptation_delta_e00: float
    distance_rmse: float
    neutral_ab_rmse: float
    spectral_delta_e00_median: float
    spectral_delta_e00_p95: float
    adaptation_delta_e00_p95: float
    distance_abs_error_median: float
    distance_abs_error_p95: float
    spectral_cases: int
    adaptation_cases: int
    distance_cases: int


def _resample_spectrum(source_wavelengths: np.ndarray, values: np.ndarray) -> np.ndarray:
    source_wavelengths = np.asarray(source_wavelengths, dtype=float)
    values = np.asarray(values, dtype=float)
    if source_wavelengths.ndim != 1 or values.ndim != 1:
        raise ValueError("Measured spectra must be one-dimensional.")
    if source_wavelengths.shape[0] != values.shape[0]:
        raise ValueError("Measured spectrum wavelengths and values must be aligned.")
    if np.any(np.diff(source_wavelengths) <= 0.0):
        raise ValueError("Measured spectrum wavelengths must be strictly increasing.")
    if source_wavelengths[0] > WAVELENGTHS[0] or source_wavelengths[-1] < WAVELENGTHS[-1]:
        raise ValueError("Measured spectra must cover the full 380-780 nm benchmark domain.")
    return np.interp(WAVELENGTHS, source_wavelengths, values)


def _load_named_spectra_csv(path: Path, *, clip_lower: float, clip_upper: float | None) -> dict[str, np.ndarray]:
    with open(path, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None or len(reader.fieldnames) < 2:
            raise ValueError(f"{path} must contain wavelength_nm plus one or more named spectra columns.")
        wavelength_field = reader.fieldnames[0]
        spectrum_names = reader.fieldnames[1:]
        wavelengths: list[float] = []
        columns = {name: [] for name in spectrum_names}
        for row in reader:
            wavelengths.append(float(row[wavelength_field]))
            for name in spectrum_names:
                columns[name].append(float(row[name]))

    wavelength_grid = np.asarray(wavelengths, dtype=float)
    loaded: dict[str, np.ndarray] = {}
    for name, values in columns.items():
        spectrum = _resample_spectrum(wavelength_grid, np.asarray(values, dtype=float))
        spectrum = np.clip(spectrum, clip_lower, None if clip_upper is None else clip_upper)
        loaded[name] = spectrum
    return loaded


@lru_cache(maxsize=1)
def load_measured_dataset() -> dict[str, object] | None:
    if not MEASURED_MANIFEST_PATH.exists():
        return None

    with open(MEASURED_MANIFEST_PATH, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    reflectance_csv = MEASURED_DATA_DIR / manifest["reflectance_csv"]
    illuminant_csv = MEASURED_DATA_DIR / manifest["illuminant_csv"]
    reflectances = _load_named_spectra_csv(reflectance_csv, clip_lower=0.0, clip_upper=1.0)
    illuminants = _load_named_spectra_csv(illuminant_csv, clip_lower=0.0, clip_upper=None)

    return {
        "manifest": manifest,
        "reflectances": reflectances,
        "illuminants": illuminants,
    }


def measured_dataset_summary() -> dict[str, int]:
    dataset = load_measured_dataset()
    if dataset is None:
        return {
            "loaded": 0,
            "calibration_pairs": 0,
            "benchmark_pairs": 0,
            "adaptation_pairs": 0,
            "distance_pairs": 0,
        }
    manifest = dataset["manifest"]
    return {
        "loaded": 1,
        "calibration_pairs": len(manifest.get("calibration_pairs", [])),
        "benchmark_pairs": len(manifest.get("benchmark_pairs", [])),
        "adaptation_pairs": len(manifest.get("adaptation_pairs", [])),
        "distance_pairs": len(manifest.get("distance_pairs", [])),
    }


def _asymmetric_gaussian(
    wavelengths: np.ndarray,
    mean: float,
    left_scale: float,
    right_scale: float,
) -> np.ndarray:
    scale = np.where(wavelengths < mean, left_scale, right_scale)
    t = (wavelengths - mean) * scale
    return np.exp(-0.5 * t * t)


def _gaussian(wavelengths: np.ndarray, mean: float, sigma: float) -> np.ndarray:
    t = (wavelengths - mean) / sigma
    return np.exp(-0.5 * t * t)


def _sigmoid(wavelengths: np.ndarray, center: float, width: float) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-(wavelengths - center) / width))


def _clamp_reflectance(curve: np.ndarray) -> np.ndarray:
    return np.clip(curve, 0.0, 1.0)


@lru_cache(maxsize=1)
def cie_1931_2deg_cmfs() -> np.ndarray:
    wl = WAVELENGTHS
    x_bar = (
        0.362 * _asymmetric_gaussian(wl, 442.0, 0.0624, 0.0374)
        + 1.056 * _asymmetric_gaussian(wl, 599.8, 0.0264, 0.0323)
        - 0.065 * _asymmetric_gaussian(wl, 501.1, 0.0490, 0.0382)
    )
    y_bar = (
        0.821 * _asymmetric_gaussian(wl, 568.8, 0.0213, 0.0247)
        + 0.286 * _asymmetric_gaussian(wl, 530.9, 0.0613, 0.0322)
    )
    z_bar = (
        1.217 * _asymmetric_gaussian(wl, 437.0, 0.0845, 0.0278)
        + 0.681 * _asymmetric_gaussian(wl, 459.0, 0.0385, 0.0725)
    )
    return np.stack([x_bar, y_bar, z_bar], axis=1)


def planck_spd(temp_k: float) -> np.ndarray:
    wl_m = WAVELENGTHS * 1e-9
    c1 = 3.741771852e-16
    c2 = 1.438776877e-2
    exponent = np.exp(c2 / (wl_m * temp_k)) - 1.0
    spd = c1 / (np.power(wl_m, 5) * exponent)
    return spd / spd.max()


@lru_cache(maxsize=1)
def make_illuminant_library() -> dict[str, np.ndarray]:
    wl = WAVELENGTHS
    warm_led = 0.30 * _gaussian(wl, 450.0, 12.0) + 0.88 * _gaussian(wl, 585.0, 58.0)
    cool_led = (
        0.48 * _gaussian(wl, 450.0, 14.0)
        + 0.78 * _gaussian(wl, 545.0, 50.0)
        + 0.18 * _gaussian(wl, 610.0, 24.0)
    )
    rgb_led = (
        0.95 * _gaussian(wl, 460.0, 10.0)
        + 1.00 * _gaussian(wl, 530.0, 12.0)
        + 0.90 * _gaussian(wl, 625.0, 12.0)
    )
    return {
        "equal_energy": np.ones_like(wl),
        "bb2856": planck_spd(2856.0),
        "bb3200": planck_spd(3200.0),
        "bb5000": planck_spd(5000.0),
        "bb6500": planck_spd(6500.0),
        "warm_led": warm_led / warm_led.max(),
        "cool_led": cool_led / cool_led.max(),
        "rgb_led": rgb_led / rgb_led.max(),
    }


@lru_cache(maxsize=1)
def make_reflectance_library() -> dict[str, np.ndarray]:
    wl = WAVELENGTHS
    return {
        "neutral_18": np.full_like(wl, 0.18),
        "neutral_50": np.full_like(wl, 0.50),
        "neutral_90": np.full_like(wl, 0.90),
        "red_oxide": _clamp_reflectance(
            0.04 + 0.78 * _sigmoid(wl, 590.0, 14.0) - 0.06 * _gaussian(wl, 470.0, 35.0)
        ),
        "yellow_ochre": _clamp_reflectance(
            0.06 + 0.83 * _sigmoid(wl, 500.0, 10.0) - 0.05 * _gaussian(wl, 430.0, 18.0)
        ),
        "viridian": _clamp_reflectance(
            0.03
            + 0.70 * _gaussian(wl, 545.0, 30.0)
            + 0.08 * _sigmoid(wl, 690.0, 12.0)
            - 0.08 * _gaussian(wl, 450.0, 18.0)
        ),
        "cerulean": _clamp_reflectance(
            0.03
            + 0.62 * _gaussian(wl, 470.0, 24.0)
            + 0.10 * _gaussian(wl, 530.0, 18.0)
            - 0.04 * _gaussian(wl, 620.0, 45.0)
        ),
        "magenta_ink": _clamp_reflectance(
            0.04
            + 0.54 * _gaussian(wl, 445.0, 18.0)
            + 0.68 * _gaussian(wl, 650.0, 28.0)
            - 0.46 * _gaussian(wl, 545.0, 34.0)
        ),
        "cyan_ink": _clamp_reflectance(
            0.04
            + 0.45 * _gaussian(wl, 485.0, 25.0)
            + 0.48 * _gaussian(wl, 540.0, 23.0)
            - 0.22 * _gaussian(wl, 620.0, 45.0)
        ),
        "orange_pigment": _clamp_reflectance(
            0.05 + 0.76 * _gaussian(wl, 602.0, 36.0) - 0.16 * _gaussian(wl, 450.0, 35.0)
        ),
        "skin_light": _clamp_reflectance(
            0.18 + 0.46 * _sigmoid(wl, 575.0, 22.0) - 0.07 * _gaussian(wl, 540.0, 16.0)
        ),
        "skin_dark": _clamp_reflectance(
            0.06 + 0.31 * _sigmoid(wl, 585.0, 22.0) - 0.05 * _gaussian(wl, 540.0, 16.0)
        ),
        "foliage": _clamp_reflectance(
            0.03
            + 0.56 * _gaussian(wl, 550.0, 26.0)
            + 0.14 * _sigmoid(wl, 680.0, 12.0)
            - 0.10 * _gaussian(wl, 445.0, 18.0)
        ),
        "lavender": _clamp_reflectance(
            0.08
            + 0.24 * _gaussian(wl, 430.0, 30.0)
            + 0.34 * _gaussian(wl, 620.0, 42.0)
            - 0.12 * _gaussian(wl, 545.0, 25.0)
        ),
    }


def spectrum_to_xyz(reflectance: np.ndarray, illuminant: np.ndarray) -> np.ndarray:
    cmfs = cie_1931_2deg_cmfs()
    spd = reflectance * illuminant
    k = 100.0 / np.trapezoid(illuminant * cmfs[:, 1], WAVELENGTHS)
    return k * np.array(
        [
            np.trapezoid(spd * cmfs[:, 0], WAVELENGTHS),
            np.trapezoid(spd * cmfs[:, 1], WAVELENGTHS),
            np.trapezoid(spd * cmfs[:, 2], WAVELENGTHS),
        ],
        dtype=float,
    )


def white_xyz_from_illuminant(illuminant: np.ndarray) -> np.ndarray:
    return spectrum_to_xyz(np.ones_like(illuminant), illuminant)


def xyz_to_lab(xyz: np.ndarray, white_xyz: np.ndarray) -> np.ndarray:
    xyz = np.asarray(xyz, dtype=float)
    white_xyz = np.asarray(white_xyz, dtype=float)
    epsilon = 216.0 / 24389.0
    kappa = 24389.0 / 27.0

    ratio = xyz / white_xyz

    def f(values: np.ndarray) -> np.ndarray:
        return np.where(values > epsilon, np.cbrt(values), (kappa * values + 16.0) / 116.0)

    fx, fy, fz = f(ratio)
    return np.array(
        [
            116.0 * fy - 16.0,
            500.0 * (fx - fy),
            200.0 * (fy - fz),
        ],
        dtype=float,
    )


def xyz_to_oklab(xyz: np.ndarray) -> np.ndarray:
    xyz_scaled = np.asarray(xyz, dtype=float) / 100.0
    m1 = np.array(
        [
            [0.8189330101, 0.3618667424, -0.1288597137],
            [0.0329845436, 0.9293118715, 0.0361456387],
            [0.0482003018, 0.2643662691, 0.6338517070],
        ],
        dtype=float,
    )
    m2 = np.array(
        [
            [0.2104542553, 0.7936177850, -0.0040720468],
            [1.9779984951, -2.4285922050, 0.4505937099],
            [0.0259040371, 0.7827717662, -0.8086757660],
        ],
        dtype=float,
    )
    lms = m1 @ xyz_scaled
    lms_root = np.cbrt(np.clip(lms, 0.0, None))
    return m2 @ lms_root


def delta_e76_lab(lab_a: np.ndarray, lab_b: np.ndarray) -> float:
    return float(np.linalg.norm(np.asarray(lab_a, dtype=float) - np.asarray(lab_b, dtype=float)))


def ciede2000(lab_a: np.ndarray, lab_b: np.ndarray) -> float:
    l1, a1, b1 = np.asarray(lab_a, dtype=float)
    l2, a2, b2 = np.asarray(lab_b, dtype=float)

    c1 = float(np.hypot(a1, b1))
    c2 = float(np.hypot(a2, b2))
    c_bar = 0.5 * (c1 + c2)
    c_bar7 = c_bar**7
    g = 0.5 * (1.0 - np.sqrt(c_bar7 / (c_bar7 + 25.0**7))) if c_bar > 0.0 else 0.0

    a1_prime = (1.0 + g) * a1
    a2_prime = (1.0 + g) * a2
    c1_prime = float(np.hypot(a1_prime, b1))
    c2_prime = float(np.hypot(a2_prime, b2))

    h1_prime = float(np.degrees(np.arctan2(b1, a1_prime)) % 360.0)
    h2_prime = float(np.degrees(np.arctan2(b2, a2_prime)) % 360.0)

    delta_l_prime = l2 - l1
    delta_c_prime = c2_prime - c1_prime

    if c1_prime * c2_prime == 0.0:
        delta_h_prime = 0.0
    else:
        dh = h2_prime - h1_prime
        if abs(dh) <= 180.0:
            delta_h_prime = dh
        elif dh > 180.0:
            delta_h_prime = dh - 360.0
        else:
            delta_h_prime = dh + 360.0

    delta_big_h_prime = 2.0 * np.sqrt(c1_prime * c2_prime) * np.sin(np.radians(delta_h_prime / 2.0))

    l_bar_prime = 0.5 * (l1 + l2)
    c_bar_prime = 0.5 * (c1_prime + c2_prime)

    if c1_prime * c2_prime == 0.0:
        h_bar_prime = h1_prime + h2_prime
    else:
        h_sum = h1_prime + h2_prime
        h_diff = abs(h1_prime - h2_prime)
        if h_diff <= 180.0:
            h_bar_prime = 0.5 * h_sum
        elif h_sum < 360.0:
            h_bar_prime = 0.5 * (h_sum + 360.0)
        else:
            h_bar_prime = 0.5 * (h_sum - 360.0)

    t = (
        1.0
        - 0.17 * np.cos(np.radians(h_bar_prime - 30.0))
        + 0.24 * np.cos(np.radians(2.0 * h_bar_prime))
        + 0.32 * np.cos(np.radians(3.0 * h_bar_prime + 6.0))
        - 0.20 * np.cos(np.radians(4.0 * h_bar_prime - 63.0))
    )

    delta_theta = 30.0 * np.exp(-(((h_bar_prime - 275.0) / 25.0) ** 2))
    r_c = 2.0 * np.sqrt((c_bar_prime**7) / (c_bar_prime**7 + 25.0**7)) if c_bar_prime > 0.0 else 0.0

    s_l = 1.0 + (0.015 * ((l_bar_prime - 50.0) ** 2)) / np.sqrt(20.0 + ((l_bar_prime - 50.0) ** 2))
    s_c = 1.0 + 0.045 * c_bar_prime
    s_h = 1.0 + 0.015 * c_bar_prime * t

    r_t = -np.sin(np.radians(2.0 * delta_theta)) * r_c

    term_l = delta_l_prime / s_l
    term_c = delta_c_prime / s_c
    term_h = delta_big_h_prime / s_h
    return float(np.sqrt(term_l**2 + term_c**2 + term_h**2 + r_t * term_c * term_h))


def chromatic_adapt_xyz(
    xyz: np.ndarray,
    source_white_xyz: np.ndarray,
    target_white_xyz: np.ndarray,
    method: str = "cat16",
) -> np.ndarray:
    method_key = method.lower()
    if method_key == "cat16":
        matrix = CAT16_MATRIX
    elif method_key == "bradford":
        matrix = BRADFORD_MATRIX
    else:
        raise ValueError(f"Unsupported chromatic adaptation method: {method}")

    xyz = np.asarray(xyz, dtype=float)
    source_white_xyz = np.asarray(source_white_xyz, dtype=float)
    target_white_xyz = np.asarray(target_white_xyz, dtype=float)

    matrix_inv = np.linalg.inv(matrix)
    source_response = matrix @ source_white_xyz
    target_response = matrix @ target_white_xyz
    xyz_response = matrix @ xyz
    adapted_response = xyz_response * (target_response / source_response)
    return matrix_inv @ adapted_response


def delta_e00_from_xyz(xyz_a: np.ndarray, xyz_b: np.ndarray, white_xyz: np.ndarray) -> float:
    lab_a = xyz_to_lab(xyz_a, white_xyz)
    lab_b = xyz_to_lab(xyz_b, white_xyz)
    return ciede2000(lab_a, lab_b)


def _measured_spectral_case(entry: dict[str, object], *, prefix: str) -> SpectralCase:
    dataset = load_measured_dataset()
    if dataset is None:
        raise ValueError("Measured dataset is not loaded.")
    reflectance = dataset["reflectances"][entry["reflectance"]]
    illuminant = dataset["illuminants"][entry["illuminant"]]
    white_xyz = white_xyz_from_illuminant(illuminant)
    xyz = spectrum_to_xyz(reflectance, illuminant)
    name = entry.get("name") or f"{prefix}::{entry['reflectance']}::{entry['illuminant']}"
    return SpectralCase(
        name=str(name),
        reflectance_name=str(entry["reflectance"]),
        illuminant_name=str(entry["illuminant"]),
        reflectance=reflectance,
        illuminant=illuminant,
        white_xyz=white_xyz,
        xyz=xyz,
    )


@lru_cache(maxsize=1)
def build_measured_calibration_samples() -> tuple[SpectralCase, ...]:
    dataset = load_measured_dataset()
    if dataset is None:
        return tuple()
    manifest = dataset["manifest"]
    return tuple(
        _measured_spectral_case(entry, prefix="measured-cal")
        for entry in manifest.get("calibration_pairs", [])
    )


@lru_cache(maxsize=1)
def build_measured_benchmark_spectral_cases() -> tuple[SpectralCase, ...]:
    dataset = load_measured_dataset()
    if dataset is None:
        return tuple()
    manifest = dataset["manifest"]
    return tuple(
        _measured_spectral_case(entry, prefix="measured-eval")
        for entry in manifest.get("benchmark_pairs", [])
    )


@lru_cache(maxsize=1)
def build_measured_adaptation_cases() -> tuple[AdaptationCase, ...]:
    dataset = load_measured_dataset()
    if dataset is None:
        return tuple()
    manifest = dataset["manifest"]
    cases: list[AdaptationCase] = []
    for entry in manifest.get("adaptation_pairs", []):
        reflectance = dataset["reflectances"][entry["reflectance"]]
        source_illuminant = dataset["illuminants"][entry["source_illuminant"]]
        target_illuminant = dataset["illuminants"][entry["target_illuminant"]]
        source_white_xyz = white_xyz_from_illuminant(source_illuminant)
        target_white_xyz = white_xyz_from_illuminant(target_illuminant)
        source_xyz = spectrum_to_xyz(reflectance, source_illuminant)
        reference_xyz = chromatic_adapt_xyz(
            source_xyz,
            source_white_xyz,
            target_white_xyz,
            method="cat16",
        )
        name = entry.get("name") or (
            f"measured-adapt::{entry['reflectance']}::{entry['source_illuminant']}->{entry['target_illuminant']}"
        )
        cases.append(
            AdaptationCase(
                name=str(name),
                reflectance_name=str(entry["reflectance"]),
                source_illuminant_name=str(entry["source_illuminant"]),
                source_xyz=source_xyz,
                source_white_xyz=source_white_xyz,
                target_white_xyz=target_white_xyz,
                reference_xyz=reference_xyz,
                is_neutral=bool(entry.get("is_neutral", False)),
            )
        )
    return tuple(cases)


@lru_cache(maxsize=1)
def build_measured_distance_cases() -> tuple[DistanceCase, ...]:
    dataset = load_measured_dataset()
    if dataset is None:
        return tuple()
    manifest = dataset["manifest"]
    cases: list[DistanceCase] = []
    for entry in manifest.get("distance_pairs", []):
        illuminant = dataset["illuminants"][entry["illuminant"]]
        reflectance_a = dataset["reflectances"][entry["sample_a"]]
        reflectance_b = dataset["reflectances"][entry["sample_b"]]
        white_xyz = white_xyz_from_illuminant(illuminant)
        xyz_a = spectrum_to_xyz(reflectance_a, illuminant)
        xyz_b = spectrum_to_xyz(reflectance_b, illuminant)
        reference_delta_e00 = delta_e00_from_xyz(xyz_a, xyz_b, white_xyz)
        name = entry.get("name") or (
            f"measured-distance::{entry['illuminant']}::{entry['sample_a']}::{entry['sample_b']}"
        )
        cases.append(
            DistanceCase(
                name=str(name),
                illuminant_name=str(entry["illuminant"]),
                xyz_a=xyz_a,
                xyz_b=xyz_b,
                white_xyz=white_xyz,
                reference_delta_e00=reference_delta_e00,
            )
        )
    return tuple(cases)


@lru_cache(maxsize=1)
def build_calibration_samples() -> tuple[SpectralCase, ...]:
    reflectances = make_reflectance_library()
    illuminants = make_illuminant_library()
    reflectance_names = [
        "neutral_18",
        "neutral_50",
        "neutral_90",
        "red_oxide",
        "yellow_ochre",
        "viridian",
        "cerulean",
        "skin_light",
    ]
    illuminant_names = ["equal_energy", "bb3200", "bb5000", "bb6500"]
    cases: list[SpectralCase] = []
    for reflectance_name in reflectance_names:
        reflectance = reflectances[reflectance_name]
        for illuminant_name in illuminant_names:
            illuminant = illuminants[illuminant_name]
            white_xyz = white_xyz_from_illuminant(illuminant)
            xyz = spectrum_to_xyz(reflectance, illuminant)
            cases.append(
                SpectralCase(
                    name=f"cal::{reflectance_name}::{illuminant_name}",
                    reflectance_name=reflectance_name,
                    illuminant_name=illuminant_name,
                    reflectance=reflectance,
                    illuminant=illuminant,
                    white_xyz=white_xyz,
                    xyz=xyz,
                )
            )
    cases.extend(build_measured_calibration_samples())
    return tuple(cases)


@lru_cache(maxsize=1)
def build_benchmark_spectral_cases() -> tuple[SpectralCase, ...]:
    reflectances = make_reflectance_library()
    illuminants = make_illuminant_library()
    reflectance_names = [
        "neutral_18",
        "neutral_50",
        "neutral_90",
        "red_oxide",
        "yellow_ochre",
        "viridian",
        "cerulean",
        "magenta_ink",
        "cyan_ink",
        "orange_pigment",
        "skin_light",
        "skin_dark",
        "foliage",
        "lavender",
    ]
    illuminant_names = ["bb2856", "bb6500", "warm_led", "cool_led", "rgb_led"]
    cases: list[SpectralCase] = []
    for reflectance_name in reflectance_names:
        reflectance = reflectances[reflectance_name]
        for illuminant_name in illuminant_names:
            illuminant = illuminants[illuminant_name]
            white_xyz = white_xyz_from_illuminant(illuminant)
            xyz = spectrum_to_xyz(reflectance, illuminant)
            cases.append(
                SpectralCase(
                    name=f"{reflectance_name}::{illuminant_name}",
                    reflectance_name=reflectance_name,
                    illuminant_name=illuminant_name,
                    reflectance=reflectance,
                    illuminant=illuminant,
                    white_xyz=white_xyz,
                    xyz=xyz,
                )
            )
    cases.extend(build_measured_benchmark_spectral_cases())
    return tuple(cases)


@lru_cache(maxsize=1)
def build_adaptation_cases() -> tuple[AdaptationCase, ...]:
    reflectances = make_reflectance_library()
    illuminants = make_illuminant_library()
    reflectance_names = [
        "neutral_18",
        "neutral_50",
        "neutral_90",
        "red_oxide",
        "yellow_ochre",
        "viridian",
        "cerulean",
        "magenta_ink",
        "skin_light",
        "skin_dark",
        "foliage",
    ]
    source_illuminants = ["bb2856", "warm_led", "rgb_led"]
    target_illuminant_name = "bb6500"
    target_illuminant = illuminants[target_illuminant_name]
    target_white_xyz = white_xyz_from_illuminant(target_illuminant)
    cases: list[AdaptationCase] = []
    for reflectance_name in reflectance_names:
        reflectance = reflectances[reflectance_name]
        for source_illuminant_name in source_illuminants:
            source_illuminant = illuminants[source_illuminant_name]
            source_white_xyz = white_xyz_from_illuminant(source_illuminant)
            source_xyz = spectrum_to_xyz(reflectance, source_illuminant)
            reference_xyz = chromatic_adapt_xyz(
                source_xyz,
                source_white_xyz,
                target_white_xyz,
                method="cat16",
            )
            cases.append(
                AdaptationCase(
                    name=f"{reflectance_name}::{source_illuminant_name}->bb6500",
                    reflectance_name=reflectance_name,
                    source_illuminant_name=source_illuminant_name,
                    source_xyz=source_xyz,
                    source_white_xyz=source_white_xyz,
                    target_white_xyz=target_white_xyz,
                    reference_xyz=reference_xyz,
                    is_neutral=reflectance_name.startswith("neutral_"),
                )
            )
    cases.extend(build_measured_adaptation_cases())
    return tuple(cases)


@lru_cache(maxsize=1)
def build_distance_cases() -> tuple[DistanceCase, ...]:
    spectral_cases = build_benchmark_spectral_cases()
    selected_reflectances = {
        "red_oxide",
        "yellow_ochre",
        "viridian",
        "cerulean",
        "magenta_ink",
        "orange_pigment",
        "skin_light",
        "skin_dark",
        "foliage",
    }
    selected_illuminants = {"bb6500", "warm_led"}

    cases_by_key = {
        (case.reflectance_name, case.illuminant_name): case
        for case in spectral_cases
        if case.reflectance_name in selected_reflectances and case.illuminant_name in selected_illuminants
    }

    cases: list[DistanceCase] = []
    for illuminant_name in sorted(selected_illuminants):
        current_cases = [
            case
            for (reflectance_name, current_illuminant_name), case in cases_by_key.items()
            if current_illuminant_name == illuminant_name
        ]
        current_cases.sort(key=lambda case: case.reflectance_name)
        for case_a, case_b in combinations(current_cases, 2):
            reference_delta_e00 = delta_e00_from_xyz(case_a.xyz, case_b.xyz, case_a.white_xyz)
            cases.append(
                DistanceCase(
                    name=f"{illuminant_name}::{case_a.reflectance_name}::{case_b.reflectance_name}",
                    illuminant_name=illuminant_name,
                    xyz_a=case_a.xyz,
                    xyz_b=case_b.xyz,
                    white_xyz=case_a.white_xyz,
                    reference_delta_e00=reference_delta_e00,
                )
            )
    cases.extend(build_measured_distance_cases())
    return tuple(cases)


def _sanitize_xyz(xyz: np.ndarray) -> np.ndarray:
    xyz = np.asarray(xyz, dtype=float).reshape(3)
    if not np.all(np.isfinite(xyz)):
        raise ValueError("XYZ prediction must be finite.")
    return np.clip(xyz, 0.0, None)


def _sanitize_scalar(value: float) -> float:
    scalar = float(value)
    if not np.isfinite(scalar):
        raise ValueError("Scalar metric prediction must be finite.")
    return max(scalar, 0.0)


def evaluate_candidate(
    predict_xyz: Callable[[np.ndarray, np.ndarray, np.ndarray], np.ndarray],
    chromatic_adapt: Callable[[np.ndarray, np.ndarray, np.ndarray], np.ndarray],
    perceptual_distance: Callable[[np.ndarray, np.ndarray, np.ndarray], float],
) -> BenchmarkResult:
    spectral_cases = build_benchmark_spectral_cases()
    adaptation_cases = build_adaptation_cases()
    distance_cases = build_distance_cases()

    spectral_delta_e00_values: list[float] = []
    xyz_squared_errors: list[float] = []
    for case in spectral_cases:
        predicted_xyz = _sanitize_xyz(predict_xyz(case.reflectance, case.illuminant, WAVELENGTHS))
        spectral_delta_e00_values.append(delta_e00_from_xyz(predicted_xyz, case.xyz, case.white_xyz))
        xyz_squared_errors.append(float(np.mean((predicted_xyz - case.xyz) ** 2)))

    adaptation_delta_e00_values: list[float] = []
    neutral_ab_values: list[float] = []
    for case in adaptation_cases:
        predicted_xyz = _sanitize_xyz(
            chromatic_adapt(case.source_xyz, case.source_white_xyz, case.target_white_xyz)
        )
        adaptation_delta_e00_values.append(
            delta_e00_from_xyz(predicted_xyz, case.reference_xyz, case.target_white_xyz)
        )
        if case.is_neutral:
            lab = xyz_to_lab(predicted_xyz, case.target_white_xyz)
            neutral_ab_values.append(float(np.hypot(lab[1], lab[2])))

    distance_absolute_errors: list[float] = []
    for case in distance_cases:
        predicted_distance = _sanitize_scalar(perceptual_distance(case.xyz_a, case.xyz_b, case.white_xyz))
        distance_absolute_errors.append(abs(predicted_distance - case.reference_delta_e00))

    spectral_delta_e00 = float(np.mean(spectral_delta_e00_values))
    spectral_xyz_rmse = float(np.sqrt(np.mean(xyz_squared_errors)))
    adaptation_delta_e00 = float(np.mean(adaptation_delta_e00_values))
    distance_rmse = float(np.sqrt(np.mean(np.square(distance_absolute_errors))))
    neutral_ab_rmse = float(np.sqrt(np.mean(np.square(neutral_ab_values))))
    spectral_delta_e00_median = float(np.median(spectral_delta_e00_values))
    spectral_delta_e00_p95 = float(np.percentile(spectral_delta_e00_values, 95))
    adaptation_delta_e00_p95 = float(np.percentile(adaptation_delta_e00_values, 95))
    distance_abs_error_median = float(np.median(distance_absolute_errors))
    distance_abs_error_p95 = float(np.percentile(distance_absolute_errors, 95))

    spectral_score = 30.0 * np.exp(-spectral_delta_e00 / 4.0)
    xyz_score = 15.0 * np.exp(-spectral_xyz_rmse / 2.0)
    adaptation_score = 25.0 * np.exp(-adaptation_delta_e00 / 3.0)
    distance_score = 20.0 * np.exp(-distance_rmse / 2.5)
    neutrality_score = 10.0 * np.exp(-neutral_ab_rmse / 1.5)
    total_score = float(spectral_score + xyz_score + adaptation_score + distance_score + neutrality_score)

    return BenchmarkResult(
        total_score=total_score,
        spectral_delta_e00=spectral_delta_e00,
        spectral_xyz_rmse=spectral_xyz_rmse,
        adaptation_delta_e00=adaptation_delta_e00,
        distance_rmse=distance_rmse,
        neutral_ab_rmse=neutral_ab_rmse,
        spectral_delta_e00_median=spectral_delta_e00_median,
        spectral_delta_e00_p95=spectral_delta_e00_p95,
        adaptation_delta_e00_p95=adaptation_delta_e00_p95,
        distance_abs_error_median=distance_abs_error_median,
        distance_abs_error_p95=distance_abs_error_p95,
        spectral_cases=len(spectral_cases),
        adaptation_cases=len(adaptation_cases),
        distance_cases=len(distance_cases),
    )


def format_benchmark_report(result: BenchmarkResult) -> str:
    return "\n".join(
        [
            f"total_score:           {result.total_score:.6f}",
            f"spectral_delta_e00:    {result.spectral_delta_e00:.6f}",
            f"spectral_xyz_rmse:     {result.spectral_xyz_rmse:.6f}",
            f"adaptation_delta_e00:  {result.adaptation_delta_e00:.6f}",
            f"distance_rmse:         {result.distance_rmse:.6f}",
            f"neutral_ab_rmse:       {result.neutral_ab_rmse:.6f}",
            f"spectral_de_median:    {result.spectral_delta_e00_median:.6f}",
            f"spectral_de_p95:       {result.spectral_delta_e00_p95:.6f}",
            f"adaptation_de_p95:     {result.adaptation_delta_e00_p95:.6f}",
            f"distance_abs_median:   {result.distance_abs_error_median:.6f}",
            f"distance_abs_p95:      {result.distance_abs_error_p95:.6f}",
            f"spectral_cases:        {result.spectral_cases}",
            f"adaptation_cases:      {result.adaptation_cases}",
            f"distance_cases:        {result.distance_cases}",
        ]
    )
