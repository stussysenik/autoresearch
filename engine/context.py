"""
AnalysisContext -- the shared state object passed through the pipeline.

Every analyzer reads from and writes to the context. The ``results`` dict
accumulates AnalysisResult objects keyed by analyzer name, so downstream
analyzers can access upstream outputs via ``ctx.results["motion"]``, etc.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

import numpy as np

from engine.analyzers.base import AnalysisResult


@dataclass
class AnalysisContext:
    """Shared context threaded through the analyzer pipeline.

    Attributes:
        mode: analysis mode name (move_drill, battle_eval, musicality, pattern_hunt)
        data: skeleton joint data -- shape [T, 24, 3] for single clip,
              or list of such arrays for battle (two dancers)
        audio: optional path to audio file or raw audio samples
        fps: frame rate of the skeleton data (default 30.0)
        params: mode-specific parameters (thresholds, weights, etc.)
        results: accumulator -- analyzers deposit their AnalysisResult here,
                 keyed by analyzer name
    """

    mode: str
    data: Union[np.ndarray, List[np.ndarray]]
    audio: Optional[Union[str, np.ndarray]] = None
    fps: float = 30.0
    params: Dict[str, Any] = field(default_factory=dict)
    results: Dict[str, AnalysisResult] = field(default_factory=dict)

    def get_primary_skeleton(self) -> np.ndarray:
        """Return the first (or only) skeleton array.

        For single-clip modes this returns self.data directly.
        For battle mode (list of arrays) this returns the first dancer.
        """
        if isinstance(self.data, list):
            return self.data[0]
        return self.data

    def get_all_skeletons(self) -> List[np.ndarray]:
        """Return all skeleton arrays as a list."""
        if isinstance(self.data, list):
            return self.data
        return [self.data]

    @property
    def has_audio(self) -> bool:
        return self.audio is not None
