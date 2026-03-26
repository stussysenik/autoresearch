"""
ScoringAnalyzer -- wraps match_beats.py to compute the TRIVIUM score.

Depends on both "motion" and "audio" analyzers. Combines motion accent
matching (Level 1), spectral cross-correlation (Level 2), and the full
TRIVIUM body/soul/mind scoring system.
"""
from __future__ import annotations

import sys
import os
from typing import Any, Dict, List

import numpy as np

from engine.analyzers.base import Analyzer, AnalysisResult
from engine.context import AnalysisContext

# Add the experiment directory to sys.path
_EXPERIMENT_DIR = os.path.join(
    os.path.dirname(__file__), os.pardir, os.pardir,
    "experiments", "bboy-battle-analysis",
)
_EXPERIMENT_DIR = os.path.abspath(_EXPERIMENT_DIR)
if _EXPERIMENT_DIR not in sys.path:
    sys.path.insert(0, _EXPERIMENT_DIR)

import match_beats as _beats_mod  # noqa: E402
import analyze_track as _audio_mod  # noqa: E402


class ScoringAnalyzer:
    """Compute TRIVIUM score from motion + audio features.

    TRIVIUM breakdown:
    - Body (40%): technique, vocabulary, progression, cleanliness
    - Soul (35%): musicality, phrasing, creativity
    - Mind (25%): flow, energy management, response quality, stage use

    Level 1: accent-to-beat matching (hit rate, groove lock)
    Level 2: spectral cross-correlation (motion-audio envelope sync)
    Final: weighted combination into a 0-100 score

    Depends on "motion" and "audio" results being present in ctx.results.
    """

    name: str = "scoring"
    depends_on: List[str] = ["motion", "audio"]

    def analyze(self, ctx: AnalysisContext) -> AnalysisResult:
        joints = ctx.get_primary_skeleton()
        joints = np.asarray(joints, dtype=np.float64)
        fps = ctx.fps

        # Get motion results for accents and kinematics
        motion_result = ctx.results["motion"]
        motion_accents = motion_result.data.get("motion_accents", [])
        trivium_motion = motion_result.data.get("trivium", {})

        # Get movement energy from motion kinematics
        movement_energy = motion_result.arrays.get("kinematics_movement_energy_smooth")
        if movement_energy is None:
            movement_energy = motion_result.arrays.get("kinematics_movement_energy")

        # Get audio results
        audio_result = ctx.results["audio"]
        audio_features = audio_result.arrays.get("features_9xN")
        audio_hotness = audio_result.arrays.get("hotness")
        audio_hop_sec = audio_result.metadata.get("hop_sec", _audio_mod.HOP_SEC)
        n_seg = audio_result.metadata.get("n_segments", 0)

        # Build audio payload for match_beats pipeline
        # Compute audio energy (hotness) from 9D features using bboy weights
        if audio_features is not None:
            audio_energy = _beats_mod.compute_audio_hotness(audio_features)
        elif audio_hotness is not None:
            audio_energy = audio_hotness
        else:
            # Fallback: uniform energy
            audio_energy = np.ones(max(n_seg, 1), dtype=np.float64) * 0.5

        # Compute sample_hz from hop_sec (segments per second)
        sample_hz = 1.0 / max(audio_hop_sec, 1e-8)

        # Detect beats from audio energy
        beat_times, beat_strengths = _beats_mod.detect_beats_from_envelope(
            audio_energy, sample_hz
        )
        downbeat_times = beat_times[::4] if beat_times.size > 0 else beat_times

        # Level 1: accent-to-beat matching
        level1 = _beats_mod.match_accents_to_beats(
            motion_accents=motion_accents,
            beat_times=beat_times,
            downbeat_times=downbeat_times,
            beat_strengths=beat_strengths,
            joints_3d=joints,
            fps=fps,
        )

        # Level 2: spectral cross-correlation (motion vs audio energy envelopes)
        if movement_energy is not None and movement_energy.size > 0:
            level2 = _beats_mod.spectral_cross_correlation(
                M_t=movement_energy,
                audio_energy=audio_energy,
                fps=fps,
                common_hz=100.0,
            )
        else:
            level2 = {
                "musicality_global": 0.5,
                "raw_correlation": 0.5,
                "correlation": 0.5,
                "optimal_lag_ms": 0.0,
                "anticipation_factor": 1.0,
                "multi_band_correlation": 0.5,
                "band_correlations": {},
            }

        # Combine into TRIVIUM score
        # Build the motion_analysis dict that compute_trivium_score expects
        motion_analysis = {
            "trivium": trivium_motion,
            "metadata": {
                "soul_motion_priors": {
                    "groove_lock": motion_result.metrics.get("groove_lock", 0.5),
                },
            },
        }
        trivium = _beats_mod.compute_trivium_score(motion_analysis, level1, level2)

        # Strip per_beat_hits from level1 for cleaner summary (it can be huge)
        level1_summary = {k: v for k, v in level1.items() if k != "per_beat_hits"}

        return AnalysisResult(
            analyzer_name=self.name,
            data={
                "trivium": trivium,
                "level1_summary": level1_summary,
                "level2_summary": {
                    k: v for k, v in level2.items()
                    if not isinstance(v, np.ndarray)
                },
                "n_beats": int(beat_times.size),
                "n_motion_accents": len(motion_accents),
            },
            metrics={
                "trivium_score_100": float(trivium.get("score_100", 0.0)),
                "trivium_score_norm": float(trivium.get("score_normalized", 0.0)),
                "body_score": float(trivium.get("body", {}).get("score", 0.0)),
                "soul_score": float(trivium.get("soul", {}).get("score", 0.0)),
                "mind_score": float(trivium.get("mind", {}).get("score", 0.0)),
                "accent_hit_rate": float(level1.get("accent_hit_rate", 0.0)),
                "weighted_hit_score": float(level1.get("weighted_hit_score", 0.0)),
                "groove_lock": float(level1.get("groove_lock", 0.0)),
                "musicality_global": float(level2.get("musicality_global", 0.0)),
                "multi_band_correlation": float(level2.get("multi_band_correlation", 0.0)),
            },
            arrays={
                "beat_times": beat_times,
                "beat_strengths": beat_strengths,
            },
            metadata={
                "level1_optimal_lag_ms": float(level1.get("optimal_lag_ms", 0.0)),
                "level2_optimal_lag_ms": float(level2.get("optimal_lag_ms", 0.0)),
            },
        )
