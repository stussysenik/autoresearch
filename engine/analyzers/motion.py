"""
MotionAnalyzer -- wraps the existing analyze_motion.py from experiments.

Calls extract_features() to produce the 9D normalized feature matrix and
rich metadata (kinematics, trivium body/mind scores, phase labels, etc.).
No dependencies -- this is a root analyzer in the DAG.
"""
from __future__ import annotations

import sys
import os
from typing import Any, Dict, List

import numpy as np

from engine.analyzers.base import Analyzer, AnalysisResult
from engine.context import AnalysisContext

# Add the experiment directory to sys.path so we can import analyze_motion
_EXPERIMENT_DIR = os.path.join(
    os.path.dirname(__file__), os.pardir, os.pardir,
    "experiments", "bboy-battle-analysis",
)
_EXPERIMENT_DIR = os.path.abspath(_EXPERIMENT_DIR)
if _EXPERIMENT_DIR not in sys.path:
    sys.path.insert(0, _EXPERIMENT_DIR)

import analyze_motion as _motion_mod  # noqa: E402


class MotionAnalyzer:
    """Extract 9D motion features from skeleton joint data.

    Wraps analyze_motion.extract_features() which produces:
    - 9xN normalized feature matrix (movement_tempo_stability, low_freq_motion_energy,
      distal_expressivity, movement_accent_strength, movement_flux,
      movement_complexity, movement_periodicity, motion_dynamic_range, movement_groove)
    - Rich metadata dict with kinematics, trivium scores, phase labels, etc.

    No dependencies -- this is always a root node in the pipeline.
    """

    name: str = "motion"
    depends_on: List[str] = []

    def analyze(self, ctx: AnalysisContext) -> AnalysisResult:
        joints = ctx.get_primary_skeleton()
        joints = np.asarray(joints, dtype=np.float64)

        features, metadata = _motion_mod.extract_features(joints, fps=ctx.fps)

        # Extract key scalar metrics from the trivium scores
        trivium = metadata.get("trivium", {})
        body_score = float(trivium.get("body", {}).get("score", 0.0))
        mind_score = float(trivium.get("mind", {}).get("score", 0.0))
        soul_priors = metadata.get("soul_motion_priors", {})
        groove_lock = float(soul_priors.get("groove_lock", 0.0))
        tempo_bpm = float(soul_priors.get("movement_tempo_bpm", 0.0))

        # Collect kinematics arrays
        kinematics = metadata.get("kinematics", {})
        arrays: Dict[str, np.ndarray] = {
            "features_9xN": features,
        }
        # Transfer all kinematics arrays
        for key, val in kinematics.items():
            if isinstance(val, np.ndarray):
                arrays[f"kinematics_{key}"] = val

        return AnalysisResult(
            analyzer_name=self.name,
            data={
                "trivium": trivium,
                "phase_labels": metadata.get("phase_labels", []),
                "phase_counts": metadata.get("phase_counts", {}),
                "motion_accents": metadata.get("motion_accents", []),
                "feature_names": metadata.get("feature_names", []),
                "segment_metrics": metadata.get("segment_metrics", []),
            },
            metrics={
                "body_score": body_score,
                "mind_score": mind_score,
                "groove_lock": groove_lock,
                "tempo_bpm": tempo_bpm,
            },
            arrays=arrays,
            metadata={
                "fps": ctx.fps,
                "n_frames": int(joints.shape[0]),
                "segment_window_frames": metadata.get("segment_window_frames", 0),
                "segment_hop_frames": metadata.get("segment_hop_frames", 0),
            },
        )
