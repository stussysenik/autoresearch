from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import sys
import time
from copy import deepcopy
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "candidate_config.json"
RUNNER_PATH = ROOT / "runner.py"
BEST_META_PATH = ROOT / "artifacts" / "best" / "best.json"
ARTIFACTS_DIR = ROOT / "artifacts"
SEARCH_LOG_PATH = ARTIFACTS_DIR / "self_learning_search.log"

MIN_LEARNING_RATE = 0.001
MAX_LEARNING_RATE = 0.08
MIN_OPTIMIZATION_STEPS = 150
MAX_OPTIMIZATION_STEPS = 2200
MIN_Y_LOSS_WEIGHT = 0.0
MAX_Y_LOSS_WEIGHT = 1.5
MIN_XYZ_LOSS_WEIGHT = 0.3
MAX_XYZ_LOSS_WEIGHT = 2.5
MIN_L2_REGULARIZATION = 1e-7
MAX_L2_REGULARIZATION = 3e-3
MIN_BAND_CENTER = 390.0
MAX_BAND_CENTER = 690.0
MIN_BAND_WIDTH = 8.0
MAX_BAND_WIDTH = 60.0
MIN_BAND_GAP = 14.0


def load_config() -> dict[str, object]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_config(config: dict[str, object]) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2, sort_keys=True)
        handle.write("\n")


def load_best_meta() -> dict[str, object] | None:
    if not BEST_META_PATH.exists():
        return None
    with open(BEST_META_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def append_search_log(line: str) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(SEARCH_LOG_PATH, "a", encoding="utf-8") as handle:
        handle.write(line.rstrip() + "\n")


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def mutate_positive(value: float, rng: random.Random, sigma: float, lower: float, upper: float) -> float:
    factor = pow(10.0, rng.gauss(0.0, sigma))
    return clamp(value * factor, lower, upper)


def mutate_band_centers(centers: list[float], rng: random.Random) -> list[float]:
    candidate = centers[:]
    index_count = rng.randint(1, min(3, len(candidate)))
    indices = rng.sample(range(len(candidate)), index_count)
    for index in indices:
        candidate[index] += rng.gauss(0.0, 4.0)

    candidate = sorted(clamp(value, MIN_BAND_CENTER, MAX_BAND_CENTER) for value in candidate)
    for index in range(1, len(candidate)):
        candidate[index] = max(candidate[index], candidate[index - 1] + MIN_BAND_GAP)
    overflow = candidate[-1] - MAX_BAND_CENTER
    if overflow > 0:
        candidate = [value - overflow for value in candidate]
    candidate[0] = max(candidate[0], MIN_BAND_CENTER)
    return [round(value, 4) for value in candidate]


def mutate_band_widths(widths: list[float], rng: random.Random) -> list[float]:
    candidate = widths[:]
    index_count = rng.randint(1, min(3, len(candidate)))
    indices = rng.sample(range(len(candidate)), index_count)
    for index in indices:
        candidate[index] = mutate_positive(candidate[index], rng, 0.09, MIN_BAND_WIDTH, MAX_BAND_WIDTH)
    return [round(value, 4) for value in candidate]


def mutate_config(base_config: dict[str, object], rng: random.Random) -> tuple[dict[str, object], str]:
    candidate = deepcopy(base_config)
    changes: list[str] = []

    mutation_choices = [
        "learning_rate",
        "optimization_steps",
        "xyz_loss_weight",
        "y_loss_weight",
        "l2_regularization",
        "band_centers",
        "band_widths",
    ]
    mutation_count = rng.randint(2, 5)
    for mutation in rng.sample(mutation_choices, mutation_count):
        if mutation == "learning_rate":
            value = mutate_positive(float(candidate[mutation]), rng, 0.12, MIN_LEARNING_RATE, MAX_LEARNING_RATE)
            candidate[mutation] = round(value, 8)
            changes.append(f"lr={value:.5f}")
        elif mutation == "optimization_steps":
            steps = int(candidate[mutation])
            value = int(round(clamp(steps + rng.randint(-120, 180), MIN_OPTIMIZATION_STEPS, MAX_OPTIMIZATION_STEPS)))
            candidate[mutation] = value
            changes.append(f"steps={value}")
        elif mutation == "xyz_loss_weight":
            value = mutate_positive(
                float(candidate[mutation]),
                rng,
                0.10,
                MIN_XYZ_LOSS_WEIGHT,
                MAX_XYZ_LOSS_WEIGHT,
            )
            candidate[mutation] = round(value, 6)
            changes.append(f"wxyz={value:.3f}")
        elif mutation == "y_loss_weight":
            value = mutate_positive(
                max(float(candidate[mutation]), 0.02),
                rng,
                0.14,
                max(MIN_Y_LOSS_WEIGHT, 0.02),
                MAX_Y_LOSS_WEIGHT,
            )
            candidate[mutation] = round(value, 6)
            changes.append(f"wy={value:.3f}")
        elif mutation == "l2_regularization":
            value = mutate_positive(
                float(candidate[mutation]),
                rng,
                0.18,
                MIN_L2_REGULARIZATION,
                MAX_L2_REGULARIZATION,
            )
            candidate[mutation] = round(value, 10)
            changes.append(f"l2={value:.2e}")
        elif mutation == "band_centers":
            value = mutate_band_centers(list(candidate[mutation]), rng)
            candidate[mutation] = value
            changes.append("centers")
        elif mutation == "band_widths":
            value = mutate_band_widths(list(candidate[mutation]), rng)
            candidate[mutation] = value
            changes.append("widths")

    description = "selflearn " + ",".join(changes)
    return candidate, description


def ensure_baseline() -> None:
    if load_best_meta() is not None:
        return
    result = subprocess.run(
        [sys.executable, str(RUNNER_PATH), "eval", "--description", "baseline self-learning seed"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    append_search_log("BASELINE\n" + result.stdout + result.stderr)


def parse_eval_output(output: str) -> tuple[str | None, float | None]:
    status_match = re.search(r"^status:\s+([a-z]+)", output, re.MULTILINE)
    score_match = re.search(r"^total_score:\s+([0-9.]+)", output, re.MULTILINE)
    status = status_match.group(1) if status_match else None
    score = float(score_match.group(1)) if score_match else None
    return status, score


def run_search(deadline: datetime, max_iterations: int, seed: int) -> None:
    rng = random.Random(seed)
    ensure_baseline()

    iteration = 0
    while datetime.now().astimezone() < deadline and iteration < max_iterations:
        iteration += 1
        base_config = load_config()
        candidate_config, description = mutate_config(base_config, rng)
        save_config(candidate_config)

        started_at = time.time()
        result = subprocess.run(
            [sys.executable, str(RUNNER_PATH), "eval", "--description", description],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        duration = time.time() - started_at
        combined_output = result.stdout + result.stderr
        status, score = parse_eval_output(combined_output)
        best_meta = load_best_meta()
        best_score = float(best_meta["total_score"]) if best_meta is not None else None

        line = (
            f"{datetime.now().astimezone().isoformat()} "
            f"iteration={iteration} "
            f"status={status or 'unknown'} "
            f"score={score if score is not None else 'na'} "
            f"best={best_score if best_score is not None else 'na'} "
            f"seconds={duration:.3f} "
            f"description={description}"
        )
        print(line, flush=True)
        append_search_log(line)

    final_meta = load_best_meta()
    final_score = float(final_meta["total_score"]) if final_meta is not None else float("nan")
    final_line = (
        f"{datetime.now().astimezone().isoformat()} completed "
        f"iterations={iteration} "
        f"final_best={final_score:.6f}"
    )
    print(final_line, flush=True)
    append_search_log(final_line)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Timed self-learning search over the color science bench loss/config.")
    parser.add_argument(
        "--deadline",
        required=True,
        help="ISO timestamp with timezone, for example 2026-04-02T11:00:00+02:00",
    )
    parser.add_argument("--max-iterations", type=int, default=200000)
    parser.add_argument("--seed", type=int, default=20260402)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    deadline = datetime.fromisoformat(args.deadline)
    run_search(deadline=deadline, max_iterations=args.max_iterations, seed=args.seed)


if __name__ == "__main__":
    main()
