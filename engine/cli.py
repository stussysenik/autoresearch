#!/usr/bin/env python3
"""
CLI for the breaking analysis engine.

Usage:
    python -m engine.cli <mode> <input_path> [--audio PATH] [--output json|table] [--fps 30]
    python -m engine.cli move_drill skeleton.npy
    python -m engine.cli battle_eval skeleton.npy --audio track.wav
    python -m engine.cli musicality skeleton.npy --audio track.wav --output table
    python -m engine.cli --test move_drill
    python -m engine.cli --list-modes

Modes:
    move_drill   - Single move biomechanical analysis
    battle_eval  - Full battle evaluation with TRIVIUM scoring
    musicality   - Audio-motion synchronization analysis
    pattern_hunt - Cross-session pattern discovery
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import os
from pathlib import Path
from typing import Any, Dict

import numpy as np

# Ensure the project root is importable
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from engine import analyze, AnalysisContext, list_modes
from engine.analyzers.base import AnalysisResult


def _to_serializable(obj: Any) -> Any:
    """Convert numpy types to JSON-safe Python types."""
    if isinstance(obj, dict):
        return {str(k): _to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_serializable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.floating, np.integer)):
        val = obj.item()
        if isinstance(val, float) and not math.isfinite(val):
            return None
        return val
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


def _load_skeleton(path: str) -> np.ndarray:
    """Load skeleton joint data from .npy or .npz file."""
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Skeleton file not found: {path}")

    suffix = file_path.suffix.lower()
    if suffix == ".npy":
        joints = np.load(file_path)
    elif suffix == ".npz":
        data = np.load(file_path)
        files = list(data.files)
        for key in ("joints", "joints_3d", "arr_0"):
            if key in files:
                joints = data[key]
                break
        else:
            if len(files) == 1:
                joints = data[files[0]]
            else:
                raise KeyError(
                    f"Could not find joints array in {path}. "
                    f"Available keys: {files}"
                )
    else:
        raise ValueError(f"Unsupported file format: {suffix}. Use .npy or .npz")

    joints = np.asarray(joints, dtype=np.float64)
    if joints.ndim != 3 or joints.shape[1:] != (24, 3):
        raise ValueError(
            f"Expected joints shape [T, 24, 3], got {joints.shape}"
        )
    return joints


def _generate_test_skeleton(duration_s: float = 10.0, fps: float = 30.0) -> np.ndarray:
    """Generate synthetic skeleton data for testing."""
    exp_dir = os.path.join(_PROJECT_ROOT, "experiments", "bboy-battle-analysis")
    if exp_dir not in sys.path:
        sys.path.insert(0, exp_dir)
    import analyze_motion as motion_mod
    return motion_mod.generate_synthetic_joints(duration_s=duration_s, fps=fps)


def _format_table(ctx: AnalysisContext) -> str:
    """Format results as a human-readable table."""
    lines = []
    lines.append("")
    lines.append(f"  Mode: {ctx.mode}")
    lines.append(f"  FPS: {ctx.fps}")
    lines.append("")

    for name, result in ctx.results.items():
        lines.append(f"  === {name.upper()} ===")

        if result.metrics:
            lines.append("  Metrics:")
            max_key_len = max(len(k) for k in result.metrics)
            for key, value in sorted(result.metrics.items()):
                lines.append(f"    {key:<{max_key_len+2}s} {value:.4f}")

        if result.arrays:
            lines.append("  Arrays:")
            for key, arr in result.arrays.items():
                lines.append(f"    {key}: shape={list(arr.shape)} dtype={arr.dtype}")

        if result.data:
            data_keys = list(result.data.keys())
            lines.append(f"  Data keys: {', '.join(data_keys)}")

        lines.append("")

    return "\n".join(lines)


def _format_json(ctx: AnalysisContext) -> str:
    """Format results as JSON."""
    output = {
        "mode": ctx.mode,
        "fps": ctx.fps,
        "analyzers": {},
    }
    for name, result in ctx.results.items():
        output["analyzers"][name] = _to_serializable(result.summary())
        output["analyzers"][name]["metrics"] = _to_serializable(result.metrics)
        output["analyzers"][name]["data"] = _to_serializable(result.data)
    return json.dumps(output, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Breaking analysis engine CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "mode",
        nargs="?",
        help="Analysis mode: move_drill, battle_eval, musicality, pattern_hunt",
    )
    parser.add_argument(
        "input_path",
        nargs="?",
        help="Path to skeleton data (.npy or .npz with joints_3d)",
    )
    parser.add_argument(
        "--audio",
        help="Path to audio file (.wav) for modes that need audio",
    )
    parser.add_argument(
        "--output",
        choices=["json", "table"],
        default="table",
        help="Output format (default: table)",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=30.0,
        help="Skeleton frame rate (default: 30.0)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run with synthetic test data (no input file needed)",
    )
    parser.add_argument(
        "--list-modes",
        action="store_true",
        help="List all available analysis modes and exit",
    )

    args = parser.parse_args()

    # List modes
    if args.list_modes:
        modes = list_modes()
        print("\nAvailable modes:\n")
        for mode in modes:
            analyzers = ", ".join(c.__name__ for c in mode.required_analyzers)
            print(f"  {mode.name}")
            print(f"    {mode.description}")
            print(f"    Analyzers: {analyzers}")
            print()
        return

    # Validate mode
    if args.mode is None:
        parser.error("mode is required (or use --list-modes)")

    # Load or generate data
    if args.test:
        print(f"  Generating synthetic test data (10s, {args.fps} fps)...", file=sys.stderr)
        skeleton = _generate_test_skeleton(duration_s=10.0, fps=args.fps)
    elif args.input_path:
        print(f"  Loading skeleton: {args.input_path}", file=sys.stderr)
        skeleton = _load_skeleton(args.input_path)
    else:
        parser.error("input_path is required (or use --test)")

    print(f"  Skeleton shape: {skeleton.shape}", file=sys.stderr)
    print(f"  Mode: {args.mode}", file=sys.stderr)

    # Build context
    ctx = AnalysisContext(
        mode=args.mode,
        data=skeleton,
        audio=args.audio,
        fps=args.fps,
    )

    # Run pipeline
    print("  Running pipeline...", file=sys.stderr)
    try:
        ctx = analyze(ctx)
    except KeyError as exc:
        parser.error(str(exc))
    print("  Done.\n", file=sys.stderr)

    # Output
    if args.output == "json":
        print(_format_json(ctx))
    else:
        print(_format_table(ctx))


if __name__ == "__main__":
    main()
