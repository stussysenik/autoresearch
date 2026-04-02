from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

from color_bench import (
    WAVELENGTHS,
    build_measured_calibration_samples,
    chromatic_adapt_xyz,
    ciede2000,
    evaluate_candidate,
    format_benchmark_report,
    make_illuminant_library,
    make_reflectance_library,
    measured_dataset_summary,
    spectrum_to_xyz,
    xyz_to_lab,
)

DEFAULT_TRAIN_CONFIG = {
    "band_centers": [400.0, 430.0, 460.0, 490.0, 525.0, 560.0, 600.0, 650.0],
    "band_widths": [12.0, 12.0, 15.0, 17.0, 20.0, 24.0, 30.0, 36.0],
    "learning_rate": 0.018,
    "optimization_steps": 500,
    "beta1": 0.9,
    "beta2": 0.999,
    "epsilon": 1e-8,
    "xyz_loss_weight": 1.0,
    "y_loss_weight": 0.20,
    "l2_regularization": 8.0e-5,
}

CONFIG_PATH = Path(
    os.environ.get(
        "COLOR_SCIENCE_BENCH_CONFIG",
        Path(__file__).resolve().parent / "candidate_config.json",
    )
)


def _load_train_config() -> dict[str, object]:
    config = dict(DEFAULT_TRAIN_CONFIG)
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
            override = json.load(handle)
        config.update(override)
    return config


TRAIN_CONFIG = _load_train_config()

BAND_CENTERS = np.array(TRAIN_CONFIG["band_centers"], dtype=float)
BAND_WIDTHS = np.array(TRAIN_CONFIG["band_widths"], dtype=float)

LEARNING_RATE = float(TRAIN_CONFIG["learning_rate"])
OPTIMIZATION_STEPS = int(TRAIN_CONFIG["optimization_steps"])
BETA1 = float(TRAIN_CONFIG["beta1"])
BETA2 = float(TRAIN_CONFIG["beta2"])
EPSILON = float(TRAIN_CONFIG["epsilon"])
XYZ_LOSS_WEIGHT = float(TRAIN_CONFIG["xyz_loss_weight"])
Y_LOSS_WEIGHT = float(TRAIN_CONFIG["y_loss_weight"])
L2_REGULARIZATION = float(TRAIN_CONFIG["l2_regularization"])


@dataclass(frozen=True)
class TrainedModel:
    weights: np.ndarray
    feature_mean: np.ndarray
    feature_scale: np.ndarray
    initial_loss: float
    final_loss: float
    best_loss: float
    calibration_xyz_rmse: float
    calibration_y_rmse: float


def _gaussian_basis(wavelengths: np.ndarray, center: float, width: float) -> np.ndarray:
    t = (wavelengths - center) / width
    return np.exp(-0.5 * t * t)


@lru_cache(maxsize=1)
def _sensor_basis() -> np.ndarray:
    return np.stack(
        [_gaussian_basis(WAVELENGTHS, center, width) for center, width in zip(BAND_CENTERS, BAND_WIDTHS)],
        axis=1,
    )


def _band_responses(reflectance: np.ndarray, illuminant: np.ndarray) -> np.ndarray:
    spd = reflectance * illuminant
    basis = _sensor_basis()
    responses = np.trapezoid(spd[:, None] * basis, WAVELENGTHS, axis=0)
    illuminant_norm = max(float(np.trapezoid(illuminant, WAVELENGTHS)), 1e-8)
    return responses / illuminant_norm


def _feature_vector(responses: np.ndarray) -> np.ndarray:
    responses = np.asarray(responses, dtype=float)
    squared = responses * responses
    return np.concatenate([responses, np.sqrt(np.clip(responses, 0.0, None)), squared, np.array([1.0])])


@lru_cache(maxsize=1)
def _training_problem() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    inputs: list[np.ndarray] = []
    targets: list[np.ndarray] = []
    reflectances = make_reflectance_library()
    illuminants = make_illuminant_library()
    for reflectance_name in sorted(reflectances):
        reflectance = reflectances[reflectance_name]
        for illuminant_name in sorted(illuminants):
            illuminant = illuminants[illuminant_name]
            inputs.append(_feature_vector(_band_responses(reflectance, illuminant)))
            targets.append(spectrum_to_xyz(reflectance, illuminant))
    for sample in build_measured_calibration_samples():
        inputs.append(_feature_vector(_band_responses(sample.reflectance, sample.illuminant)))
        targets.append(sample.xyz)
    design = np.vstack(inputs)
    ground_truth = np.vstack(targets)
    feature_mean = design.mean(axis=0)
    feature_scale = design.std(axis=0) + 1e-6
    feature_mean[-1] = 0.0
    feature_scale[-1] = 1.0
    normalized_design = (design - feature_mean) / feature_scale
    return normalized_design, ground_truth, feature_mean, feature_scale


def _loss_and_gradient(
    weights: np.ndarray,
    design: np.ndarray,
    ground_truth: np.ndarray,
    xyz_scale: np.ndarray,
    y_scale: float,
) -> tuple[float, np.ndarray]:
    predictions = design @ weights
    residuals = predictions - ground_truth
    normalized_xyz = residuals / xyz_scale
    xyz_loss = float(np.mean(normalized_xyz**2))

    y_residuals = residuals[:, 1] / y_scale
    y_loss = float(np.mean(y_residuals**2))

    regularization_loss = float(L2_REGULARIZATION * np.mean(weights**2))
    total_loss = XYZ_LOSS_WEIGHT * xyz_loss + Y_LOSS_WEIGHT * y_loss + regularization_loss

    xyz_grad = 2.0 * (design.T @ (normalized_xyz / xyz_scale)) / normalized_xyz.size

    y_grad_matrix = np.zeros_like(predictions)
    y_grad_matrix[:, 1] = 2.0 * y_residuals / (len(y_residuals) * y_scale)
    y_grad = design.T @ y_grad_matrix

    regularization_grad = 2.0 * L2_REGULARIZATION * weights / weights.size
    total_grad = XYZ_LOSS_WEIGHT * xyz_grad + Y_LOSS_WEIGHT * y_grad + regularization_grad
    return total_loss, total_grad


@lru_cache(maxsize=1)
def _trained_model() -> TrainedModel:
    design, ground_truth, feature_mean, feature_scale = _training_problem()
    xyz_scale = ground_truth.std(axis=0) + 1e-6
    y_scale = float(ground_truth[:, 1].std() + 1e-6)

    weights, _, _, _ = np.linalg.lstsq(design, ground_truth, rcond=None)

    first_loss, _ = _loss_and_gradient(weights, design, ground_truth, xyz_scale, y_scale)
    best_loss = first_loss
    best_weights = weights.copy()

    first_moment = np.zeros_like(weights)
    second_moment = np.zeros_like(weights)

    for step in range(1, OPTIMIZATION_STEPS + 1):
        loss, grad = _loss_and_gradient(weights, design, ground_truth, xyz_scale, y_scale)
        if loss < best_loss:
            best_loss = loss
            best_weights = weights.copy()

        first_moment = BETA1 * first_moment + (1.0 - BETA1) * grad
        second_moment = BETA2 * second_moment + (1.0 - BETA2) * (grad * grad)

        first_unbiased = first_moment / (1.0 - BETA1**step)
        second_unbiased = second_moment / (1.0 - BETA2**step)

        decay = 1.0 - 0.7 * (step - 1) / max(OPTIMIZATION_STEPS - 1, 1)
        step_size = LEARNING_RATE * decay
        weights = weights - step_size * first_unbiased / (np.sqrt(second_unbiased) + EPSILON)

    final_predictions = design @ best_weights
    final_residuals = final_predictions - ground_truth
    final_loss, _ = _loss_and_gradient(best_weights, design, ground_truth, xyz_scale, y_scale)

    return TrainedModel(
        weights=best_weights,
        feature_mean=feature_mean,
        feature_scale=feature_scale,
        initial_loss=first_loss,
        final_loss=final_loss,
        best_loss=best_loss,
        calibration_xyz_rmse=float(np.sqrt(np.mean(final_residuals**2))),
        calibration_y_rmse=float(np.sqrt(np.mean(final_residuals[:, 1] ** 2))),
    )


def predict_xyz(reflectance: np.ndarray, illuminant: np.ndarray, wavelengths: np.ndarray) -> np.ndarray:
    if wavelengths.shape != WAVELENGTHS.shape or not np.allclose(wavelengths, WAVELENGTHS):
        raise ValueError("This baseline expects the canonical 380-780 nm, 5 nm spectral sampling.")

    responses = _band_responses(reflectance, illuminant)
    features = _feature_vector(responses)
    model = _trained_model()
    normalized_features = (features - model.feature_mean) / model.feature_scale
    xyz = normalized_features @ model.weights
    return np.clip(xyz, 0.0, None)


def chromatic_adapt(xyz: np.ndarray, source_white_xyz: np.ndarray, target_white_xyz: np.ndarray) -> np.ndarray:
    return chromatic_adapt_xyz(xyz, source_white_xyz, target_white_xyz, method="cat16")


def perceptual_distance(xyz_a: np.ndarray, xyz_b: np.ndarray, white_xyz: np.ndarray) -> float:
    lab_a = xyz_to_lab(xyz_a, white_xyz)
    lab_b = xyz_to_lab(xyz_b, white_xyz)
    return ciede2000(lab_a, lab_b)


def main() -> None:
    model = _trained_model()
    result = evaluate_candidate(predict_xyz, chromatic_adapt, perceptual_distance)
    measured_summary = measured_dataset_summary()
    print(f"fit_learning_rate:      {LEARNING_RATE:.6f}")
    print(f"fit_steps:              {OPTIMIZATION_STEPS}")
    print(
        "fit_loss:               "
        f"w_xyz*mean(((xyz_hat-xyz)/sigma_xyz)^2) + "
        f"w_y*mean(((Y_hat-Y)/sigma_Y)^2) + "
        f"lambda*mean(W^2)"
    )
    print(f"fit_initial_loss:       {model.initial_loss:.6f}")
    print(f"fit_final_loss:         {model.final_loss:.6f}")
    print(f"fit_best_loss:          {model.best_loss:.6f}")
    print(f"fit_training_rmse:      {model.calibration_xyz_rmse:.6f}")
    print(f"fit_training_y_rmse:    {model.calibration_y_rmse:.6f}")
    print(f"measured_dataset:       {measured_summary['loaded']}")
    print(f"measured_cal_pairs:     {measured_summary['calibration_pairs']}")
    print(f"measured_eval_pairs:    {measured_summary['benchmark_pairs']}")
    print(f"measured_adapt_pairs:   {measured_summary['adaptation_pairs']}")
    print(f"measured_distance_pairs:{measured_summary['distance_pairs']}")
    print(format_benchmark_report(result))


if __name__ == "__main__":
    main()
