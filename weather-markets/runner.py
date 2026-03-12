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
BEST_TRAIN_PATH = BEST_DIR / "train.py"
BEST_META_PATH = BEST_DIR / "best.json"
MARKET_SNAPSHOT_PATH = ROOT / "market_snapshot.json"
HISTORY_PATH = ROOT / "data" / "history.csv"

MIN_FREE_BYTES = int(1.5 * 1024 ** 3)
MAX_ARTIFACT_BYTES = 500 * 1024 ** 2
MAX_CRASH_ARTIFACTS = 20
RESULTS_HEADER = [
    "timestamp",
    "run_id",
    "brier_score",
    "status",
    "description",
    "artifact_path",
    "free_disk_gb",
]


def ensure_dirs():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    BEST_DIR.mkdir(parents=True, exist_ok=True)
    CRASH_DIR.mkdir(parents=True, exist_ok=True)


def init_results_file():
    if RESULTS_PATH.exists():
        return
    with open(RESULTS_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(RESULTS_HEADER)


def get_free_bytes():
    return shutil.disk_usage(ROOT).free


def get_free_disk_gb():
    return get_free_bytes() / 1024 / 1024 / 1024


def get_artifact_bytes():
    total = 0
    if not ARTIFACTS_DIR.exists():
        return total
    for path in ARTIFACTS_DIR.rglob("*"):
        if path.is_file():
            total += path.stat().st_size
    return total


def storage_guard():
    if get_free_bytes() < MIN_FREE_BYTES:
        return False, "free disk below 1.5 GiB"
    if get_artifact_bytes() > MAX_ARTIFACT_BYTES:
        return False, "artifacts exceeded 500 MiB"
    return True, ""


def append_result(row):
    init_results_file()
    with open(RESULTS_PATH, "a", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow([row.get(column, "") for column in RESULTS_HEADER])


def load_best_meta():
    if not BEST_META_PATH.exists():
        return None
    with open(BEST_META_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_best_meta(meta):
    with open(BEST_META_PATH, "w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2, sort_keys=True)
        handle.write("\n")


def write_summary():
    if not RESULTS_PATH.exists():
        return
    rows = []
    with open(RESULTS_PATH, "r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        rows.extend(reader)
    if not rows:
        return

    keeps = [row for row in rows if row["status"] == "keep" and row["brier_score"]]
    best_row = min(keeps, key=lambda row: float(row["brier_score"])) if keeps else None
    crash_count = sum(1 for row in rows if row["status"] == "crash")

    lines = [
        "Weather market overnight summary",
        f"total_runs:   {len(rows)}",
        f"crash_count:  {crash_count}",
    ]
    if best_row is not None:
        lines.extend(
            [
                f"best_score:   {best_row['brier_score']}",
                f"best_run_id:  {best_row['run_id']}",
                f"description:  {best_row['description']}",
            ]
        )
    with open(SUMMARY_PATH, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def run_init(args):
    ensure_dirs()
    init_results_file()
    if not MARKET_SNAPSHOT_PATH.exists():
        command = [
            sys.executable,
            str(ROOT / "fetch_market_snapshot.py"),
            "--venue",
            args.venue,
            "--city",
            args.city,
        ]
        if args.target_date:
            command.extend(["--target-date", args.target_date])
        if args.manual_snapshot:
            command.extend(["--manual-snapshot", args.manual_snapshot])
        subprocess.run(command, cwd=ROOT, check=True)

    if not HISTORY_PATH.exists():
        subprocess.run([sys.executable, str(ROOT / "get_data.py")], cwd=ROOT, check=True)

    print("Initialized weather-markets environment.")
    print(f"market_snapshot: {MARKET_SNAPSHOT_PATH.exists()}")
    print(f"history_data:    {HISTORY_PATH.exists()}")
    print(f"free_disk_gb:    {get_free_disk_gb():.2f}")


def parse_brier_score(log_text):
    match = re.search(r"^brier_score:\s+([0-9.]+)", log_text, re.MULTILINE)
    if not match:
        return None
    return float(match.group(1))


def save_gzipped_text(path, text):
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        handle.write(text)


def save_text(path, text):
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def restore_best_train():
    if BEST_TRAIN_PATH.exists():
        shutil.copy2(BEST_TRAIN_PATH, TRAIN_PATH)


def save_best_train(run_id, score, description, log_text):
    BEST_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(TRAIN_PATH, BEST_TRAIN_PATH)
    artifact_prefix = BEST_DIR / run_id
    shutil.copy2(TRAIN_PATH, artifact_prefix.with_suffix(".train.py"))
    save_gzipped_text(artifact_prefix.with_suffix(".log.gz"), log_text)
    meta = {
        "run_id": run_id,
        "brier_score": score,
        "description": description,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    save_best_meta(meta)
    return str(artifact_prefix.with_suffix(".log.gz").relative_to(ROOT))


def save_crash_artifact(run_id, log_text):
    artifact_prefix = CRASH_DIR / run_id
    shutil.copy2(TRAIN_PATH, artifact_prefix.with_suffix(".train.py"))
    save_gzipped_text(artifact_prefix.with_suffix(".log.gz"), log_text)
    return str(artifact_prefix.with_suffix(".log.gz").relative_to(ROOT))


def prune_crash_artifacts():
    crash_logs = sorted(CRASH_DIR.glob("*.log.gz"), key=lambda path: path.stat().st_mtime, reverse=True)
    for path in crash_logs[MAX_CRASH_ARTIFACTS:]:
        sibling = path.with_suffix("").with_suffix(".train.py")
        path.unlink(missing_ok=True)
        sibling.unlink(missing_ok=True)


def evaluate_current_train(description):
    ok, reason = storage_guard()
    if not ok:
        row = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "run_id": f"stop-{int(datetime.now(timezone.utc).timestamp())}",
            "brier_score": "",
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

    parsed_score = parse_brier_score(log_text)
    best_meta = load_best_meta()
    artifact_path = ""

    if result.returncode != 0 or parsed_score is None:
        artifact_path = save_crash_artifact(run_id, log_text)
        restore_best_train()
        status = "crash"
        score_str = ""
    else:
        best_score = best_meta["brier_score"] if best_meta else None
        if best_score is None or parsed_score < float(best_score):
            artifact_path = save_best_train(run_id, parsed_score, description, log_text)
            status = "keep"
        else:
            restore_best_train()
            status = "discard"
        score_str = f"{parsed_score:.6f}"

    prune_crash_artifacts()
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "brier_score": score_str,
        "status": status,
        "description": description,
        "artifact_path": artifact_path,
        "free_disk_gb": f"{get_free_disk_gb():.2f}",
    }
    append_result(row)
    write_summary()

    print(f"run_id:        {run_id}")
    print(f"status:        {status}")
    print(f"brier_score:   {score_str or 'n/a'}")
    print(f"artifact_path: {artifact_path or 'n/a'}")
    print(f"free_disk_gb:  {get_free_disk_gb():.2f}")


def main():
    parser = argparse.ArgumentParser(description="Manage weather-markets experiments and artifacts.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="Fetch market snapshot and historical data.")
    init_parser.add_argument("--venue", choices=["polymarket", "kalshi"], default="polymarket")
    init_parser.add_argument("--city", default="nyc")
    init_parser.add_argument("--target-date")
    init_parser.add_argument("--manual-snapshot")

    eval_parser = subparsers.add_parser("eval", help="Evaluate the current train.py and update best snapshots.")
    eval_parser.add_argument("--description", required=True)

    subparsers.add_parser("summary", help="Rewrite summary.txt from the results ledger.")

    args = parser.parse_args()
    if args.command == "init":
        run_init(args)
    elif args.command == "eval":
        evaluate_current_train(args.description)
    elif args.command == "summary":
        write_summary()
        print(f"Wrote summary to {SUMMARY_PATH}")


if __name__ == "__main__":
    main()
