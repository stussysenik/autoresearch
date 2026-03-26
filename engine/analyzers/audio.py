"""
AudioAnalyzer -- wraps the existing analyze_track.py from experiments.

Extracts 9D audio features (BPM stability, bass energy, vocal presence,
beat strength, spectral flux, rhythm complexity, harmonic richness,
dynamic range, groove/swing) plus segment classifications and energy arcs.

No dependencies -- this is a root analyzer. Requires audio data in the context.
"""
from __future__ import annotations

import sys
import os
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from scipy.io import wavfile

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

import analyze_track as _audio_mod  # noqa: E402


class AudioAnalyzer:
    """Extract 9D audio features from an audio file or waveform.

    The context.audio field can be:
    - A string path to a .wav file
    - A numpy array of raw audio samples (mono float32 at 44.1kHz)
    - None (generates a synthetic test tone for dev/testing)

    Returns features, segment classifications, and bboy-mode analysis
    (hotness curve, builds, drops, phrase boundaries).
    """

    name: str = "audio"
    depends_on: List[str] = []

    def _load_audio(self, ctx: AnalysisContext) -> np.ndarray:
        """Resolve audio from context into a waveform array."""
        audio = ctx.audio
        if audio is None:
            import warnings
            warnings.warn(
                "No audio provided; using synthetic test tone. "
                "Pass ctx.audio or --audio for real analysis.",
                UserWarning,
                stacklevel=3,
            )
            return _audio_mod.generate_test_tone(duration=10.0)

        if isinstance(audio, np.ndarray):
            # Already raw samples -- ensure float32 mono
            y = audio.astype(np.float32)
            if y.ndim > 1:
                y = y.mean(axis=1)
            return y

        if isinstance(audio, str):
            path = Path(audio)
            if not path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio}")
            return _audio_mod.load_audio(str(path))

        raise TypeError(f"Unsupported audio type: {type(audio)}")

    def analyze(self, ctx: AnalysisContext) -> AnalysisResult:
        y = self._load_audio(ctx)
        duration_sec = len(y) / _audio_mod.SR

        # Extract 9D features -- returns (9, N_segments) matrix
        features, segments, n_seg = _audio_mod.extract_features(y)

        # Run bboy-mode analysis for hotness, builds, drops
        bboy_profile = _audio_mod.WEIGHT_PROFILES["bboy"]
        bboy_analysis = _audio_mod.analyze_mode(
            features, n_seg, "bboy", bboy_profile["labels"]
        )

        # Segment classification
        classifications = _audio_mod.classify_segments(features, n_seg)

        # Compute per-dimension means as summary metrics
        dim_names = _audio_mod.DIMENSION_NAMES
        metrics: Dict[str, float] = {}
        for d, name in enumerate(dim_names):
            key = name.lower().replace(" ", "_").replace("/", "_")
            metrics[f"mean_{key}"] = float(features[d].mean())

        metrics["duration_sec"] = duration_sec
        metrics["n_segments"] = float(n_seg)
        metrics["hotness_mean"] = float(bboy_analysis["hotness"].mean())
        metrics["hotness_max"] = float(bboy_analysis["hotness"].max())

        return AnalysisResult(
            analyzer_name=self.name,
            data={
                "dimension_names": list(dim_names),
                "classifications": classifications,
                "hot_times": bboy_analysis["hot_times"].tolist()
                if hasattr(bboy_analysis["hot_times"], "tolist")
                else list(bboy_analysis["hot_times"]),
                "build_count": len(bboy_analysis["build_idx"]),
                "drop_count": len(bboy_analysis["drop_idx"]),
                "phrase_times": bboy_analysis["phrase_times"],
            },
            metrics=metrics,
            arrays={
                "features_9xN": features,
                "hotness": bboy_analysis["hotness"],
                "energy_velocity": bboy_analysis["velocity"],
            },
            metadata={
                "sample_rate": _audio_mod.SR,
                "window_sec": _audio_mod.WINDOW_SEC,
                "hop_sec": _audio_mod.HOP_SEC,
                "n_segments": n_seg,
            },
        )
