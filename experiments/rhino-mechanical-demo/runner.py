import argparse
import csv
import gzip
import json
import os
import shutil
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RHINO_ROOT = Path(
    Path.home() / "Desktop" / "rhino-nlcli"
    if "RHINO_NLCLI_ROOT" not in os.environ
    else os.environ["RHINO_NLCLI_ROOT"]
).resolve()

ARTIFACTS_DIR = ROOT / "artifacts"
BEST_DIR = ARTIFACTS_DIR / "best"
CRASH_DIR = ARTIFACTS_DIR / "crashes"
CURRENT_LOG_PATH = ARTIFACTS_DIR / "current.log"
RESULTS_PATH = ROOT / "results.tsv"
SUMMARY_PATH = ROOT / "summary.txt"
BEST_META_PATH = BEST_DIR / "best.json"
BEST_SNAPSHOT_DIR = BEST_DIR / "worktree"
CRASH_STATE_PATH = ARTIFACTS_DIR / "crash_state.json"
DIAGNOSTIC_REPORTS_DIR = Path.home() / "Library" / "Logs" / "DiagnosticReports"
OBJECTIVE_PATH = RHINO_ROOT / "research" / "mpc-live-ii" / "objective.json"

MIN_FREE_BYTES = int(2.0 * 1024 ** 3)
MAX_ARTIFACT_BYTES = 1024 * 1024 * 1024
MAX_CRASH_ARTIFACTS = 12

RESULTS_HEADER = [
    "timestamp",
    "run_id",
    "total_score",
    "loss",
    "binary_pass_count",
    "binary_total_count",
    "binary_passes",
    "secondary_score",
    "live_build_score",
    "calibration_artifact_score",
    "runtime_integration_score",
    "objective_name",
    "status",
    "description",
    "artifact_path",
    "free_disk_gb",
]

SNAPSHOT_ITEMS = [
    "ARCHITECTURE.md",
    "CONTRIBUTING.md",
    "PRD.md",
    "README.md",
    "ROADMAP.md",
    "TECHSTACK.md",
    "VISION.md",
    "build.zig",
    "build.zig.zon",
    "bridges",
    "openspec",
    "research",
    "schemas",
    "scripts",
    "src",
]

CAP_PROMPT = "create mpc live ii button cap play start named overnight-play-start-cap"
PANEL_PROMPT = "create mpc live ii panel demo named overnight-panel-demo"
CAP_CALIBRATION_PATH = RHINO_ROOT / "research" / "mpc-live-ii" / "cap-calibration.json"
RUNTIME_SOURCE_PATH = RHINO_ROOT / "src" / "rhino_live_demo.zig"
SOURCE_PACK_FILES = [
    RHINO_ROOT / "var" / "mpc-live-ii" / "source-pack" / "akai-mpc-live-ii-user-guide-v2.11.6.pdf",
    RHINO_ROOT / "var" / "mpc-live-ii" / "source-pack" / "akai-mpc-live-ii-page-data.json",
]

CALIBRATION_REQUIRED_NUMERIC_FIELDS = [
    "cap_width_mm",
    "cap_depth_mm",
    "cap_height_mm",
    "top_width_mm",
    "top_depth_mm",
    "corner_radius_mm",
    "shoulder_height_mm",
]

CALIBRATION_REQUIRED_TEXT_FIELDS = [
    "button_family",
    "measured_from",
    "provenance_tier",
    "notes",
]

DEFAULT_BINARY_METRIC_ORDER = [
    "source_pack_ready",
    "button_cap_generation_ok",
    "panel_demo_generation_ok",
    "calibration_artifact_valid",
    "runtime_uses_calibration",
    "calibrated_summary_ok",
    "cap_bbox_matches_calibration",
    "chronological_layers_ok",
]

DEFAULT_ORDERED_LAYER_NAMES = [
    "MPCLiveII::01_Sources",
    "MPCLiveII::02_Envelope",
    "MPCLiveII::03_Anchors",
    "MPCLiveII::04_ButtonFamily",
    "MPCLiveII::05_Cap2D",
    "MPCLiveII::06_Cap3D",
    "MPCLiveII::07_Mesh",
    "MPCLiveII::08_Export",
]

DEFAULT_OBJECTIVE_CONFIG = {
    "objective_name": "mpc_live_ii_demo_loss_v1",
    "goal": "minimize_loss",
    "search_policy": {
        "learning_rate": "one coherent product change per evaluation round",
        "mode": "low",
    },
    "loss_function": {
        "formula": "loss = (1 - binary_pass_fraction) + secondary_weight * (1 - secondary_score / 100)",
        "secondary_weight": 0.25,
    },
    "binary_metrics": DEFAULT_BINARY_METRIC_ORDER,
    "ordered_layers": DEFAULT_ORDERED_LAYER_NAMES,
    "bbox_tolerance_mm": {
        "width": 1.5,
        "depth": 1.5,
        "height": 1.0,
    },
}


def load_objective_config():
    payload = {}
    if OBJECTIVE_PATH.exists():
        try:
            with open(OBJECTIVE_PATH, "r", encoding="utf-8") as handle:
                loaded = json.load(handle)
            if isinstance(loaded, dict):
                payload = loaded
        except Exception:
            payload = {}

    config = {
        "objective_name": DEFAULT_OBJECTIVE_CONFIG["objective_name"],
        "goal": DEFAULT_OBJECTIVE_CONFIG["goal"],
        "search_policy": dict(DEFAULT_OBJECTIVE_CONFIG["search_policy"]),
        "loss_function": dict(DEFAULT_OBJECTIVE_CONFIG["loss_function"]),
        "binary_metrics": list(DEFAULT_OBJECTIVE_CONFIG["binary_metrics"]),
        "ordered_layers": list(DEFAULT_OBJECTIVE_CONFIG["ordered_layers"]),
        "bbox_tolerance_mm": dict(DEFAULT_OBJECTIVE_CONFIG["bbox_tolerance_mm"]),
    }

    if isinstance(payload.get("objective_name"), str) and payload["objective_name"].strip():
        config["objective_name"] = payload["objective_name"].strip()
    if isinstance(payload.get("goal"), str) and payload["goal"].strip():
        config["goal"] = payload["goal"].strip()

    search_policy = payload.get("search_policy")
    if isinstance(search_policy, dict):
        learning_rate = search_policy.get("learning_rate")
        mode = search_policy.get("mode")
        if isinstance(learning_rate, str) and learning_rate.strip():
            config["search_policy"]["learning_rate"] = learning_rate.strip()
        if isinstance(mode, str) and mode.strip():
            config["search_policy"]["mode"] = mode.strip()

    loss_function = payload.get("loss_function")
    if isinstance(loss_function, dict):
        formula = loss_function.get("formula")
        secondary_weight = loss_function.get("secondary_weight")
        if isinstance(formula, str) and formula.strip():
            config["loss_function"]["formula"] = formula.strip()
        if isinstance(secondary_weight, (int, float)) and secondary_weight >= 0:
            config["loss_function"]["secondary_weight"] = float(secondary_weight)

    binary_metrics = payload.get("binary_metrics")
    if isinstance(binary_metrics, list):
        cleaned = [item.strip() for item in binary_metrics if isinstance(item, str) and item.strip()]
        if cleaned:
            config["binary_metrics"] = cleaned

    ordered_layers = payload.get("ordered_layers")
    if isinstance(ordered_layers, list):
        cleaned = [item.strip() for item in ordered_layers if isinstance(item, str) and item.strip()]
        if cleaned:
            config["ordered_layers"] = cleaned

    bbox_tolerance = payload.get("bbox_tolerance_mm")
    if isinstance(bbox_tolerance, dict):
        for key in ("width", "depth", "height"):
            value = bbox_tolerance.get(key)
            if isinstance(value, (int, float)) and value > 0:
                config["bbox_tolerance_mm"][key] = float(value)

    return config


OBJECTIVE_CONFIG = load_objective_config()
BINARY_METRIC_ORDER = OBJECTIVE_CONFIG["binary_metrics"]
ORDERED_LAYER_NAMES = OBJECTIVE_CONFIG["ordered_layers"]
BBOX_TOLERANCE_MM = OBJECTIVE_CONFIG["bbox_tolerance_mm"]
SECONDARY_LOSS_WEIGHT = float(OBJECTIVE_CONFIG["loss_function"]["secondary_weight"])


def ensure_dirs():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    BEST_DIR.mkdir(parents=True, exist_ok=True)
    CRASH_DIR.mkdir(parents=True, exist_ok=True)


def init_results_file():
    if not RESULTS_PATH.exists():
        with open(RESULTS_PATH, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, delimiter="\t")
            writer.writerow(RESULTS_HEADER)
        return

    with open(RESULTS_PATH, "r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        existing_header = next(reader, [])

    if existing_header == RESULTS_HEADER:
        return

    rows = []
    with open(RESULTS_PATH, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        rows.extend(reader)

    with open(RESULTS_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(RESULTS_HEADER)
        for row in rows:
            writer.writerow([row.get(column, "") for column in RESULTS_HEADER])


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
        return False, "free disk below 2.0 GiB"
    if get_artifact_bytes() > MAX_ARTIFACT_BYTES:
        return False, "artifacts exceeded 1.0 GiB"
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


def load_crash_state():
    if not CRASH_STATE_PATH.exists():
        return {}
    try:
        with open(CRASH_STATE_PATH, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict):
            return payload
    except Exception:
        return {}
    return {}


def save_crash_state(state):
    CRASH_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CRASH_STATE_PATH, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)
        handle.write("\n")


def latest_rhino_crash_report():
    if not DIAGNOSTIC_REPORTS_DIR.exists():
        return None
    reports = sorted(DIAGNOSTIC_REPORTS_DIR.glob("Rhinoceros-*.ips"))
    if not reports:
        return None
    return reports[-1]


def seed_crash_state():
    latest_report = latest_rhino_crash_report()
    state = {
        "latest_report_name": latest_report.name if latest_report else "",
        "latest_report_mtime": latest_report.stat().st_mtime if latest_report else 0.0,
        "last_stop_reason": "",
        "last_stop_report_name": "",
        "seeded_at": datetime.now(timezone.utc).isoformat(),
    }
    save_crash_state(state)
    return state


def rhino_error_reporting_active():
    probe = run_command(["pgrep", "-f", "Rhino Error Reporting"], ROOT, timeout=10)
    return probe.returncode == 0 and bool((probe.stdout or "").strip())


def crash_guard_reason():
    state = load_crash_state()
    if not state:
        state = seed_crash_state()

    latest_report = latest_rhino_crash_report()
    latest_name = latest_report.name if latest_report else ""
    baseline_name = state.get("latest_report_name", "")

    if rhino_error_reporting_active():
        if latest_name:
            return f"Rhino Error Reporting is active after crash report {latest_name}"
        return "Rhino Error Reporting is active"

    if latest_name and latest_name > baseline_name:
        return f"new Rhino crash report detected: {latest_name}"

    return ""


def note_guard_stop(reason):
    state = load_crash_state()
    latest_report = latest_rhino_crash_report()
    latest_name = latest_report.name if latest_report else ""
    if (
        state.get("last_stop_reason") == reason
        and state.get("last_stop_report_name") == latest_name
    ):
        return

    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_id": f"stop-{int(datetime.now(timezone.utc).timestamp())}",
        "status": "stopped",
        "description": reason,
        "artifact_path": "",
        "free_disk_gb": f"{get_free_disk_gb():.2f}",
        "objective_name": OBJECTIVE_CONFIG["objective_name"],
    }
    append_result(row)
    write_summary()

    state["last_stop_reason"] = reason
    state["last_stop_report_name"] = latest_name
    save_crash_state(state)


def write_summary():
    rows = []
    if RESULTS_PATH.exists():
        with open(RESULTS_PATH, "r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            rows.extend(reader)

    best_meta = load_best_meta()
    crash_count = sum(1 for row in rows if row["status"] == "crash")
    lines = [
        "Rhino mechanical demo overnight summary",
        f"runs:          {len(rows)}",
        f"crashes:       {crash_count}",
        f"free_disk_gb:  {get_free_disk_gb():.2f}",
    ]
    if best_meta:
        binary_pass_count = int(best_meta.get("binary_pass_count", 0))
        binary_total_count = int(best_meta.get("binary_total_count", len(BINARY_METRIC_ORDER)))
        lines.extend(
            [
                f"best_score:    {best_meta['total_score']:.1f}",
                f"best_loss:     {best_meta.get('loss', 0.0):.4f}",
                f"binary_pass:   {binary_pass_count}/{binary_total_count}",
                f"best_run_id:   {best_meta['run_id']}",
                f"description:   {best_meta['description']}",
                f"objective:     {best_meta.get('objective_name', OBJECTIVE_CONFIG['objective_name'])}",
                f"secondary:     {best_meta.get('secondary_score', 0.0):.1f}",
                f"live_build:    {best_meta['live_build_score']:.1f}",
                f"artifact:      {best_meta['calibration_artifact_score']:.1f}",
                f"integration:   {best_meta['runtime_integration_score']:.1f}",
            ]
        )
    with open(SUMMARY_PATH, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def snapshot_repo(dest: Path):
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    for rel in SNAPSHOT_ITEMS:
        src = RHINO_ROOT / rel
        if not src.exists():
            continue
        target = dest / rel
        if src.is_dir():
            shutil.copytree(src, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)


def restore_snapshot(snapshot_dir: Path):
    for rel in SNAPSHOT_ITEMS:
        dest = RHINO_ROOT / rel
        if dest.exists():
            if dest.is_dir():
                shutil.rmtree(dest)
            else:
                dest.unlink()
        src = snapshot_dir / rel
        if not src.exists():
            continue
        if src.is_dir():
            shutil.copytree(src, dest)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)


def source_pack_ready():
    return all(path.exists() for path in SOURCE_PACK_FILES)


def cli_generation_ok(cli_payload):
    result = cli_payload.get("result", {})
    export_path = result.get("export_path")
    return (
        result.get("status") == "ok"
        and isinstance(export_path, str)
        and bool(export_path)
        and Path(export_path).exists()
        and isinstance(result.get("objects"), list)
        and len(result.get("objects")) > 0
    )


def chronological_layers_ok(source_text: str):
    return all(layer_name in source_text for layer_name in ORDERED_LAYER_NAMES)


def run_command(command, cwd: Path, timeout: int = 600):
    try:
        return subprocess.run(
            command,
            cwd=cwd,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        return subprocess.CompletedProcess(
            command,
            returncode=124,
            stdout=exc.stdout or "",
            stderr=(exc.stderr or "") + f"\nTIMEOUT after {timeout}s\n",
        )


def extract_json(text: str):
    text = text.strip()
    if not text:
        raise ValueError("empty output")
    return json.loads(text)


def load_iteration_cli(iteration_id: str):
    path = RHINO_ROOT / "var" / "mpc-live-ii" / "iterations" / iteration_id / "cli.json"
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


def parse_binary_stl_bbox(path: Path):
    with open(path, "rb") as handle:
        data = handle.read()
    if len(data) < 84:
        raise ValueError("stl too small")
    tri_count = struct.unpack("<I", data[80:84])[0]
    expected_len = 84 + tri_count * 50
    if expected_len != len(data):
        raise ValueError("not a binary stl")
    mins = [float("inf"), float("inf"), float("inf")]
    maxs = [float("-inf"), float("-inf"), float("-inf")]
    offset = 84
    for _ in range(tri_count):
        offset += 12
        for _ in range(3):
            x, y, z = struct.unpack("<fff", data[offset : offset + 12])
            offset += 12
            mins[0] = min(mins[0], x)
            mins[1] = min(mins[1], y)
            mins[2] = min(mins[2], z)
            maxs[0] = max(maxs[0], x)
            maxs[1] = max(maxs[1], y)
            maxs[2] = max(maxs[2], z)
        offset += 2
    return {
        "width_mm": round(maxs[0] - mins[0], 3),
        "depth_mm": round(maxs[1] - mins[1], 3),
        "height_mm": round(maxs[2] - mins[2], 3),
        "triangles": tri_count,
    }


def read_export_bbox(cli_payload):
    export_path = cli_payload.get("result", {}).get("export_path")
    if not export_path:
        return None
    path = Path(export_path)
    if not path.exists():
        return None
    try:
        return parse_binary_stl_bbox(path)
    except Exception:
        return None


def score_live_components(score_payload):
    components = score_payload["score"]["score_components"]
    return (
        (components["source_coverage_score"] * 0.35)
        + (components["control_anchor_score"] * 0.20)
        + (components["execution_score"] * 0.15)
        + (components["export_artifact_score"] * 0.10)
    )


def load_calibration_artifact():
    if not CAP_CALIBRATION_PATH.exists():
        return None, ["missing calibration artifact"]
    try:
        with open(CAP_CALIBRATION_PATH, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except Exception as exc:
        return None, [f"invalid calibration artifact: {exc}"]
    return payload, []


def score_calibration_artifact(payload):
    if payload is None:
        return 0.0, ["no calibration artifact"], False

    notes = []
    score = 0.0
    score += 3.0

    numeric_ok = True
    for key in CALIBRATION_REQUIRED_NUMERIC_FIELDS:
        value = payload.get(key)
        if not isinstance(value, (int, float)) or value <= 0:
            numeric_ok = False
            notes.append(f"bad numeric field: {key}")
    if numeric_ok:
        score += 4.0

    text_ok = True
    for key in CALIBRATION_REQUIRED_TEXT_FIELDS:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            text_ok = False
            notes.append(f"missing text field: {key}")
    source_urls = payload.get("official_sources")
    if not isinstance(source_urls, list) or not source_urls or not all(isinstance(v, str) and "akai" in v.lower() for v in source_urls):
        text_ok = False
        notes.append("official_sources missing Akai URLs")
    if text_ok:
        score += 3.0

    return score, notes, numeric_ok and text_ok


def score_runtime_integration(calibration_payload, calibration_valid, cap_cli_payload, panel_cli_payload, cap_bbox):
    score = 0.0
    notes = []

    source_text = ""
    if RUNTIME_SOURCE_PATH.exists():
        source_text = RUNTIME_SOURCE_PATH.read_text(encoding="utf-8", errors="replace")

    runtime_uses_calibration = "cap-calibration.json" in source_text or "cap_calibration" in source_text
    if runtime_uses_calibration:
        score += 3.0
    else:
        notes.append("runtime does not appear to reference calibration artifact")

    cap_summary = (cap_cli_payload.get("result", {}).get("summary") or "").lower()
    panel_summary = (panel_cli_payload.get("result", {}).get("summary") or "").lower()
    calibrated_summary_ok = calibration_valid and ("calibrated" in cap_summary or "calibrated" in panel_summary)
    if calibrated_summary_ok:
        score += 3.0
    else:
        notes.append("cli summary still lacks calibrated language")

    bbox_match_ok = False
    if calibration_payload and calibration_valid and cap_bbox:
        width_ok = abs(cap_bbox["width_mm"] - float(calibration_payload["cap_width_mm"])) <= BBOX_TOLERANCE_MM["width"]
        depth_ok = abs(cap_bbox["depth_mm"] - float(calibration_payload["cap_depth_mm"])) <= BBOX_TOLERANCE_MM["depth"]
        height_ok = abs(cap_bbox["height_mm"] - float(calibration_payload["cap_height_mm"])) <= BBOX_TOLERANCE_MM["height"]
        if width_ok and depth_ok and height_ok:
            bbox_match_ok = True
            score += 2.0
        else:
            notes.append("exported cap bbox does not match calibration dimensions tightly enough")
    else:
        notes.append("missing exported cap bbox or calibration payload")

    chronological_layers = chronological_layers_ok(source_text)
    if chronological_layers:
        score += 2.0
    else:
        notes.append("chronological ordered MPC layers are missing from runtime")

    return score, notes, {
        "runtime_uses_calibration": int(runtime_uses_calibration),
        "calibrated_summary_ok": int(calibrated_summary_ok),
        "cap_bbox_matches_calibration": int(bbox_match_ok),
        "chronological_layers_ok": int(chronological_layers),
    }


def build_binary_metrics(calibration_valid, cap_cli_payload, panel_cli_payload, runtime_metrics):
    return {
        "source_pack_ready": int(source_pack_ready()),
        "button_cap_generation_ok": int(cli_generation_ok(cap_cli_payload)),
        "panel_demo_generation_ok": int(cli_generation_ok(panel_cli_payload)),
        "calibration_artifact_valid": int(calibration_valid),
        "runtime_uses_calibration": int(runtime_metrics["runtime_uses_calibration"]),
        "calibrated_summary_ok": int(runtime_metrics["calibrated_summary_ok"]),
        "cap_bbox_matches_calibration": int(runtime_metrics["cap_bbox_matches_calibration"]),
        "chronological_layers_ok": int(runtime_metrics["chronological_layers_ok"]),
    }


def save_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def save_gzipped_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        handle.write(text)


def restore_best_snapshot():
    if BEST_SNAPSHOT_DIR.exists():
        restore_snapshot(BEST_SNAPSHOT_DIR)


def save_best_snapshot(run_id: str, meta: dict, log_text: str):
    BEST_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_repo(BEST_SNAPSHOT_DIR)
    artifact_dir = BEST_DIR / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    save_gzipped_text(artifact_dir / "eval.log.gz", log_text)
    with open(artifact_dir / "eval.json", "w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2, sort_keys=True)
        handle.write("\n")
    save_best_meta(meta)
    return str(artifact_dir.relative_to(ROOT))


def save_crash_artifact(run_id: str, meta: dict, log_text: str):
    artifact_dir = CRASH_DIR / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    snapshot_repo(artifact_dir / "worktree")
    save_gzipped_text(artifact_dir / "eval.log.gz", log_text)
    with open(artifact_dir / "eval.json", "w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return str(artifact_dir.relative_to(ROOT))


def prune_crash_artifacts():
    crash_dirs = sorted(
        [path for path in CRASH_DIR.iterdir() if path.is_dir()],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    ) if CRASH_DIR.exists() else []
    for path in crash_dirs[MAX_CRASH_ARTIFACTS:]:
        shutil.rmtree(path, ignore_errors=True)


def compute_loss(binary_pass_count: int, binary_total_count: int, secondary_score: float):
    binary_pass_fraction = (binary_pass_count / binary_total_count) if binary_total_count else 0.0
    secondary_fraction = max(0.0, min(secondary_score / 100.0, 1.0))
    loss = (1.0 - binary_pass_fraction) + SECONDARY_LOSS_WEIGHT * (1.0 - secondary_fraction)
    return round(loss, 6), round(binary_pass_fraction, 6)


def evaluate_current_candidate(description: str):
    ok, reason = storage_guard()
    if not ok:
        row = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "run_id": f"stop-{int(datetime.now(timezone.utc).timestamp())}",
            "status": "stopped",
            "description": reason,
            "artifact_path": "",
            "free_disk_gb": f"{get_free_disk_gb():.2f}",
            "objective_name": OBJECTIVE_CONFIG["objective_name"],
        }
        append_result(row)
        write_summary()
        raise RuntimeError(reason)

    guard_reason = crash_guard_reason()
    if guard_reason:
        note_guard_stop(guard_reason)
        raise RuntimeError(guard_reason)

    ensure_dirs()
    init_results_file()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    build = run_command(["./scripts/zig", "build"], RHINO_ROOT, timeout=300)
    log_parts = [
        "$ ./scripts/zig build",
        build.stdout,
        build.stderr,
    ]
    if build.returncode != 0:
        log_text = "\n".join(log_parts)
        save_text(CURRENT_LOG_PATH, log_text)
        meta = {
            "run_id": run_id,
            "description": description,
            "error": "build failed",
        }
        artifact_path = save_crash_artifact(run_id, meta, log_text)
        restore_best_snapshot()
        row = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "run_id": run_id,
            "status": "crash",
            "description": description,
            "artifact_path": artifact_path,
            "free_disk_gb": f"{get_free_disk_gb():.2f}",
            "objective_name": OBJECTIVE_CONFIG["objective_name"],
        }
        append_result(row)
        write_summary()
        prune_crash_artifacts()
        return {"status": "crash", "run_id": run_id, "artifact_path": artifact_path}

    cap_args = [
        "./scripts/autoresearcher",
        "--iteration",
        f"{run_id}-cap",
        "--session",
        f"overnight-cap-{run_id}",
        "--prompt",
        CAP_PROMPT,
    ]
    panel_args = [
        "./scripts/autoresearcher",
        "--iteration",
        f"{run_id}-panel",
        "--session",
        f"overnight-panel-{run_id}",
        "--prompt",
        PANEL_PROMPT,
        "--no-refresh",
    ]
    if source_pack_ready():
        cap_args.append("--no-refresh")

    cap_run = run_command(cap_args, RHINO_ROOT, timeout=600)
    log_parts.extend(["", f"$ {' '.join(cap_args)}", cap_run.stdout, cap_run.stderr])
    if cap_run.returncode != 0:
        log_text = "\n".join(log_parts)
        save_text(CURRENT_LOG_PATH, log_text)
        meta = {
            "run_id": run_id,
            "description": description,
            "error": "button-cap run failed",
        }
        artifact_path = save_crash_artifact(run_id, meta, log_text)
        restore_best_snapshot()
        row = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "run_id": run_id,
            "status": "crash",
            "description": description,
            "artifact_path": artifact_path,
            "free_disk_gb": f"{get_free_disk_gb():.2f}",
            "objective_name": OBJECTIVE_CONFIG["objective_name"],
        }
        append_result(row)
        write_summary()
        prune_crash_artifacts()
        return {"status": "crash", "run_id": run_id, "artifact_path": artifact_path}

    panel_run = run_command(panel_args, RHINO_ROOT, timeout=600)
    log_parts.extend(["", f"$ {' '.join(panel_args)}", panel_run.stdout, panel_run.stderr])
    log_text = "\n".join(log_parts)
    save_text(CURRENT_LOG_PATH, log_text)
    if panel_run.returncode != 0:
        meta = {
            "run_id": run_id,
            "description": description,
            "error": "panel run failed",
        }
        artifact_path = save_crash_artifact(run_id, meta, log_text)
        restore_best_snapshot()
        row = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "run_id": run_id,
            "status": "crash",
            "description": description,
            "artifact_path": artifact_path,
            "free_disk_gb": f"{get_free_disk_gb():.2f}",
            "objective_name": OBJECTIVE_CONFIG["objective_name"],
        }
        append_result(row)
        write_summary()
        prune_crash_artifacts()
        return {"status": "crash", "run_id": run_id, "artifact_path": artifact_path}

    cap_payload = extract_json(cap_run.stdout)
    panel_payload = extract_json(panel_run.stdout)
    cap_cli_payload = load_iteration_cli(f"{run_id}-cap")
    panel_cli_payload = load_iteration_cli(f"{run_id}-panel")
    cap_bbox = read_export_bbox(cap_cli_payload)
    panel_bbox = read_export_bbox(panel_cli_payload)

    live_build_score = (score_live_components(cap_payload) + score_live_components(panel_payload)) / 2.0
    calibration_payload, calibration_load_notes = load_calibration_artifact()
    calibration_artifact_score, calibration_notes, calibration_valid = score_calibration_artifact(calibration_payload)
    runtime_integration_score, integration_notes, runtime_metric_flags = score_runtime_integration(
        calibration_payload,
        calibration_valid,
        cap_cli_payload,
        panel_cli_payload,
        cap_bbox,
    )
    binary_metrics = build_binary_metrics(
        calibration_valid,
        cap_cli_payload,
        panel_cli_payload,
        runtime_metric_flags,
    )
    binary_pass_count = sum(binary_metrics[name] for name in BINARY_METRIC_ORDER)
    binary_total_count = len(BINARY_METRIC_ORDER)
    total_score = round((binary_pass_count * 100.0) / binary_total_count, 3)
    secondary_score = round(live_build_score + calibration_artifact_score + runtime_integration_score, 3)
    loss, binary_pass_fraction = compute_loss(binary_pass_count, binary_total_count, secondary_score)

    meta = {
        "run_id": run_id,
        "description": description,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "objective_name": OBJECTIVE_CONFIG["objective_name"],
        "objective_goal": OBJECTIVE_CONFIG["goal"],
        "learning_rate": OBJECTIVE_CONFIG["search_policy"]["learning_rate"],
        "loss": loss,
        "total_score": total_score,
        "binary_pass_count": binary_pass_count,
        "binary_total_count": binary_total_count,
        "binary_pass_fraction": binary_pass_fraction,
        "binary_metrics": binary_metrics,
        "secondary_score": secondary_score,
        "live_build_score": round(live_build_score, 3),
        "calibration_artifact_score": round(calibration_artifact_score, 3),
        "runtime_integration_score": round(runtime_integration_score, 3),
        "cap_bbox_mm": cap_bbox,
        "panel_bbox_mm": panel_bbox,
        "cap_run": cap_payload,
        "panel_run": panel_payload,
        "cap_cli_payload": cap_cli_payload,
        "panel_cli_payload": panel_cli_payload,
        "calibration_load_notes": calibration_load_notes,
        "calibration_notes": calibration_notes,
        "integration_notes": integration_notes,
    }

    best_meta = load_best_meta()
    if best_meta is not None and (
        "binary_pass_count" not in best_meta
        or "loss" not in best_meta
    ):
        best_meta = None
    artifact_path = ""
    status = "discard"
    if (
        best_meta is None
        or loss < float(best_meta["loss"])
        or (
            loss == float(best_meta["loss"])
            and secondary_score > float(best_meta.get("secondary_score", 0.0))
        )
    ):
        artifact_path = save_best_snapshot(run_id, meta, log_text)
        status = "keep"
    else:
        restore_best_snapshot()

    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "total_score": f"{total_score:.3f}",
        "loss": f"{loss:.6f}",
        "binary_pass_count": str(binary_pass_count),
        "binary_total_count": str(binary_total_count),
        "binary_passes": ",".join(name for name in BINARY_METRIC_ORDER if binary_metrics[name]),
        "secondary_score": f"{secondary_score:.3f}",
        "live_build_score": f"{live_build_score:.3f}",
        "calibration_artifact_score": f"{calibration_artifact_score:.3f}",
        "runtime_integration_score": f"{runtime_integration_score:.3f}",
        "objective_name": OBJECTIVE_CONFIG["objective_name"],
        "status": status,
        "description": description,
        "artifact_path": artifact_path,
        "free_disk_gb": f"{get_free_disk_gb():.2f}",
    }
    append_result(row)
    write_summary()
    prune_crash_artifacts()
    return {
        "status": status,
        "run_id": run_id,
        "total_score": total_score,
        "loss": loss,
        "binary_pass_count": binary_pass_count,
        "binary_total_count": binary_total_count,
        "secondary_score": secondary_score,
        "live_build_score": round(live_build_score, 3),
        "calibration_artifact_score": round(calibration_artifact_score, 3),
        "runtime_integration_score": round(runtime_integration_score, 3),
        "artifact_path": artifact_path,
    }


def run_init(_args):
    ensure_dirs()
    init_results_file()
    seed_crash_state()
    guard_reason = crash_guard_reason()
    if guard_reason:
        note_guard_stop(guard_reason)
        print(json.dumps({"status": "stopped", "reason": guard_reason}, indent=2, sort_keys=True))
        return
    best_meta = load_best_meta()
    if best_meta is None or "binary_pass_count" not in best_meta or "loss" not in best_meta:
        result = evaluate_current_candidate("baseline-binary")
        print(json.dumps(result, indent=2, sort_keys=True))
        return
    print("baseline already initialized")
    run_status(_args)


def run_eval(args):
    result = evaluate_current_candidate(args.description)
    print(json.dumps(result, indent=2, sort_keys=True))


def run_status(_args):
    best_meta = load_best_meta()
    rows = []
    if RESULTS_PATH.exists():
        with open(RESULTS_PATH, "r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            rows.extend(reader)

    if best_meta is None:
        print("best_score: none")
        print("best_loss: none")
        print(f"runs: {len(rows)}")
        return

    print(f"best_score: {best_meta['total_score']:.1f}")
    print(f"best_loss: {best_meta.get('loss', 0.0):.4f}")
    print(f"binary_pass: {best_meta.get('binary_pass_count', 0)}/{best_meta.get('binary_total_count', len(BINARY_METRIC_ORDER))}")
    print(f"best_run_id: {best_meta['run_id']}")
    print(f"description: {best_meta['description']}")
    print(f"objective_name: {best_meta.get('objective_name', OBJECTIVE_CONFIG['objective_name'])}")
    print(f"secondary_score: {best_meta.get('secondary_score', 0.0):.1f}")
    print(f"live_build_score: {best_meta['live_build_score']:.1f}")
    print(f"calibration_artifact_score: {best_meta['calibration_artifact_score']:.1f}")
    print(f"runtime_integration_score: {best_meta['runtime_integration_score']:.1f}")
    print(f"runs: {len(rows)}")
    if best_meta.get("cap_bbox_mm"):
        bbox = best_meta["cap_bbox_mm"]
        print(
            "cap_bbox_mm: "
            f"{bbox['width_mm']} x {bbox['depth_mm']} x {bbox['height_mm']} "
            f"(triangles={bbox['triangles']})"
        )


def run_best_score(_args):
    best_meta = load_best_meta()
    if best_meta is None:
        print("")
        return
    print(f"{float(best_meta['total_score']):.3f}")


def run_guard(_args):
    ensure_dirs()
    init_results_file()
    if not CRASH_STATE_PATH.exists():
        seed_crash_state()
    reason = crash_guard_reason()
    if reason:
        note_guard_stop(reason)
        print(reason)
        raise SystemExit(1)
    print("ok")


def main():
    parser = argparse.ArgumentParser(description="Rhino mechanical demo autoresearch harness")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init")
    init_parser.set_defaults(func=run_init)

    eval_parser = subparsers.add_parser("eval")
    eval_parser.add_argument("--description", required=True)
    eval_parser.set_defaults(func=run_eval)

    status_parser = subparsers.add_parser("status")
    status_parser.set_defaults(func=run_status)

    best_score_parser = subparsers.add_parser("best-score")
    best_score_parser.set_defaults(func=run_best_score)

    guard_parser = subparsers.add_parser("guard")
    guard_parser.set_defaults(func=run_guard)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
