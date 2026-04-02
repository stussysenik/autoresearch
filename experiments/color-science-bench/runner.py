from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ARTIFACTS_DIR = ROOT / "artifacts"
BEST_DIR = ARTIFACTS_DIR / "best"
CRASH_DIR = ARTIFACTS_DIR / "crashes"
CURRENT_LOG_PATH = ARTIFACTS_DIR / "current.log"
RESULTS_PATH = ROOT / "results.tsv"
SUMMARY_PATH = ROOT / "summary.txt"
TRAIN_PATH = ROOT / "train.py"
CONFIG_PATH = ROOT / "candidate_config.json"
BEST_TRAIN_PATH = BEST_DIR / "train.py"
BEST_CONFIG_PATH = BEST_DIR / "candidate_config.json"
BEST_META_PATH = BEST_DIR / "best.json"

MIN_FREE_BYTES = int(1.5 * 1024**3)
MAX_ARTIFACT_BYTES = 500 * 1024**2
MAX_CRASH_ARTIFACTS = 20

RESULTS_HEADER = [
    "timestamp",
    "run_id",
    "total_score",
    "spectral_delta_e00",
    "spectral_xyz_rmse",
    "adaptation_delta_e00",
    "distance_rmse",
    "neutral_ab_rmse",
    "status",
    "description",
    "artifact_path",
    "free_disk_gb",
]


def ensure_dirs() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    BEST_DIR.mkdir(parents=True, exist_ok=True)
    CRASH_DIR.mkdir(parents=True, exist_ok=True)


def init_results_file() -> None:
    if RESULTS_PATH.exists():
        return
    with open(RESULTS_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(RESULTS_HEADER)


def get_free_bytes() -> int:
    return shutil.disk_usage(ROOT).free


def get_free_disk_gb() -> float:
    return get_free_bytes() / 1024 / 1024 / 1024


def get_artifact_bytes() -> int:
    total = 0
    if not ARTIFACTS_DIR.exists():
        return total
    for path in ARTIFACTS_DIR.rglob("*"):
        if path.is_file():
            total += path.stat().st_size
    return total


def storage_guard() -> tuple[bool, str]:
    if get_free_bytes() < MIN_FREE_BYTES:
        return False, "free disk below 1.5 GiB"
    if get_artifact_bytes() > MAX_ARTIFACT_BYTES:
        return False, "artifacts exceeded 500 MiB"
    return True, ""


def append_result(row: dict[str, str]) -> None:
    init_results_file()
    with open(RESULTS_PATH, "a", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow([row.get(column, "") for column in RESULTS_HEADER])


def load_best_meta() -> dict[str, object] | None:
    if not BEST_META_PATH.exists():
        return None
    with open(BEST_META_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_best_meta(meta: dict[str, object]) -> None:
    with open(BEST_META_PATH, "w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2, sort_keys=True)
        handle.write("\n")


def write_summary() -> None:
    rows: list[dict[str, str]] = []
    if RESULTS_PATH.exists():
        with open(RESULTS_PATH, "r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            rows.extend(reader)

    best_meta = load_best_meta()
    crash_count = sum(1 for row in rows if row["status"] == "crash")
    lines = [
        "Color science bench summary",
        f"runs:          {len(rows)}",
        f"crashes:       {crash_count}",
        f"free_disk_gb:  {get_free_disk_gb():.2f}",
    ]
    if best_meta is not None:
        lines.extend(
            [
                f"best_score:    {float(best_meta['total_score']):.4f}",
                f"best_run_id:   {best_meta['run_id']}",
                f"description:   {best_meta['description']}",
                f"spectral_de:   {float(best_meta['spectral_delta_e00']):.4f}",
                f"adaptation:    {float(best_meta['adaptation_delta_e00']):.4f}",
                f"distance:      {float(best_meta['distance_rmse']):.4f}",
                f"neutral_ab:    {float(best_meta['neutral_ab_rmse']):.4f}",
            ]
        )

    with open(SUMMARY_PATH, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def save_text(path: Path, text: str) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def save_gzipped_text(path: Path, text: str) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        handle.write(text)


def restore_best_train() -> None:
    if BEST_TRAIN_PATH.exists():
        shutil.copy2(BEST_TRAIN_PATH, TRAIN_PATH)
    if BEST_CONFIG_PATH.exists():
        shutil.copy2(BEST_CONFIG_PATH, CONFIG_PATH)


def save_best_train(run_id: str, metrics: dict[str, float], description: str, log_text: str) -> str:
    BEST_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(TRAIN_PATH, BEST_TRAIN_PATH)
    shutil.copy2(CONFIG_PATH, BEST_CONFIG_PATH)
    artifact_prefix = BEST_DIR / run_id
    shutil.copy2(TRAIN_PATH, artifact_prefix.with_suffix(".train.py"))
    shutil.copy2(CONFIG_PATH, artifact_prefix.with_suffix(".config.json"))
    save_gzipped_text(artifact_prefix.with_suffix(".log.gz"), log_text)

    meta: dict[str, object] = {
        "run_id": run_id,
        "description": description,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    meta.update(metrics)
    save_best_meta(meta)
    return str(artifact_prefix.with_suffix(".log.gz").relative_to(ROOT))


def save_crash_artifact(run_id: str, log_text: str) -> str:
    artifact_prefix = CRASH_DIR / run_id
    shutil.copy2(TRAIN_PATH, artifact_prefix.with_suffix(".train.py"))
    shutil.copy2(CONFIG_PATH, artifact_prefix.with_suffix(".config.json"))
    save_gzipped_text(artifact_prefix.with_suffix(".log.gz"), log_text)
    return str(artifact_prefix.with_suffix(".log.gz").relative_to(ROOT))


def prune_crash_artifacts() -> None:
    crash_logs = sorted(CRASH_DIR.glob("*.log.gz"), key=lambda path: path.stat().st_mtime, reverse=True)
    for path in crash_logs[MAX_CRASH_ARTIFACTS:]:
        sibling = path.with_suffix("").with_suffix(".train.py")
        config_sibling = path.with_suffix("").with_suffix(".config.json")
        path.unlink(missing_ok=True)
        sibling.unlink(missing_ok=True)
        config_sibling.unlink(missing_ok=True)


def parse_metrics(log_text: str) -> dict[str, float]:
    patterns = {
        "total_score": r"^total_score:\s+([0-9.]+)",
        "spectral_delta_e00": r"^spectral_delta_e00:\s+([0-9.]+)",
        "spectral_xyz_rmse": r"^spectral_xyz_rmse:\s+([0-9.]+)",
        "adaptation_delta_e00": r"^adaptation_delta_e00:\s+([0-9.]+)",
        "distance_rmse": r"^distance_rmse:\s+([0-9.]+)",
        "neutral_ab_rmse": r"^neutral_ab_rmse:\s+([0-9.]+)",
    }
    metrics: dict[str, float] = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, log_text, re.MULTILINE)
        if match is None:
            raise ValueError(f"Missing metric: {key}")
        metrics[key] = float(match.group(1))
    return metrics


def run_init() -> None:
    ensure_dirs()
    init_results_file()
    write_summary()
    print("Initialized color-science-bench.")
    print(f"train_file:     {TRAIN_PATH.exists()}")
    print(f"results_file:   {RESULTS_PATH.exists()}")
    print(f"free_disk_gb:   {get_free_disk_gb():.2f}")


def run_status() -> None:
    ensure_dirs()
    init_results_file()
    write_summary()
    best_meta = load_best_meta()
    print(f"free_disk_gb:   {get_free_disk_gb():.2f}")
    print(f"results_file:   {RESULTS_PATH.exists()}")
    if best_meta is None:
        print("best_score:     none")
        return
    print(f"best_score:     {float(best_meta['total_score']):.4f}")
    print(f"best_run_id:    {best_meta['run_id']}")
    print(f"description:    {best_meta['description']}")


def evaluate_current_train(description: str) -> None:
    ok, reason = storage_guard()
    if not ok:
        row = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "run_id": f"stop-{int(datetime.now(timezone.utc).timestamp())}",
            "status": "stopped",
            "description": reason,
            "artifact_path": "",
            "free_disk_gb": f"{get_free_disk_gb():.2f}",
        }
        append_result(row)
        write_summary()
        raise RuntimeError(reason)

    ensure_dirs()
    init_results_file()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    result = subprocess.run(
        [sys.executable, str(TRAIN_PATH)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    log_text = result.stdout + result.stderr
    save_text(CURRENT_LOG_PATH, log_text)

    artifact_path = ""
    metrics: dict[str, float] = {}
    status = "crash"

    if result.returncode == 0:
        try:
            metrics = parse_metrics(log_text)
        except ValueError:
            metrics = {}

    if not metrics:
        artifact_path = save_crash_artifact(run_id, log_text)
        restore_best_train()
    else:
        best_meta = load_best_meta()
        best_score = float(best_meta["total_score"]) if best_meta is not None else None
        if best_score is None or metrics["total_score"] > best_score:
            artifact_path = save_best_train(run_id, metrics, description, log_text)
            status = "keep"
        else:
            restore_best_train()
            status = "discard"

    prune_crash_artifacts()
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "status": status,
        "description": description,
        "artifact_path": artifact_path,
        "free_disk_gb": f"{get_free_disk_gb():.2f}",
    }
    for key, value in metrics.items():
        row[key] = f"{value:.6f}"
    append_result(row)
    write_summary()
    print(f"status:         {status}")
    if metrics:
        print(f"total_score:    {metrics['total_score']:.6f}")
        print(f"spectral_de:    {metrics['spectral_delta_e00']:.6f}")
        print(f"adaptation_de:  {metrics['adaptation_delta_e00']:.6f}")
        print(f"distance_rmse:  {metrics['distance_rmse']:.6f}")
        print(f"neutral_ab:     {metrics['neutral_ab_rmse']:.6f}")
    if artifact_path:
        print(f"artifact_path:  {artifact_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Autoresearch runner for color-science-bench.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("init", help="Initialize result files and artifact folders.")
    subparsers.add_parser("status", help="Show current best run summary.")

    eval_parser = subparsers.add_parser("eval", help="Evaluate the current train.py against the fixed benchmark.")
    eval_parser.add_argument(
        "--description",
        required=True,
        help="Short description of the current experiment.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "init":
        run_init()
    elif args.command == "status":
        run_status()
    elif args.command == "eval":
        evaluate_current_train(args.description)
    else:
        raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
