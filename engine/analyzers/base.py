"""
Analyzer Protocol and AnalysisResult container.

The Analyzer protocol defines the contract every analyzer must satisfy:
- name: unique string identifier used for dependency resolution
- depends_on: list of analyzer names that must run first
- analyze(ctx): takes an AnalysisContext, returns an AnalysisResult

AnalysisResult is a structured container that separates scalar metrics
from array data, keeping downstream consumers clean.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Protocol, runtime_checkable

import numpy as np

if TYPE_CHECKING:
    from engine.context import AnalysisContext


@dataclass
class AnalysisResult:
    """Container for analyzer output.

    Separates concerns:
    - data: arbitrary structured output (dicts, lists, nested objects)
    - metrics: named scalar floats for quick summary / comparison
    - arrays: named numpy arrays for time-series, feature matrices, etc.
    - metadata: provenance info (versions, params, timing)
    """

    analyzer_name: str
    data: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    arrays: Dict[str, np.ndarray] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def summary(self) -> Dict[str, Any]:
        """Return a JSON-safe summary (no numpy arrays)."""
        return {
            "analyzer": self.analyzer_name,
            "metrics": dict(self.metrics),
            "array_shapes": {k: list(v.shape) for k, v in self.arrays.items()},
            "metadata": self.metadata,
        }


@runtime_checkable
class Analyzer(Protocol):
    """Protocol that every analyzer must implement.

    - name: unique string used as the key in AnalysisContext.results
    - depends_on: list of analyzer names whose results must already
      be present in ctx.results before this analyzer runs
    - analyze(ctx): execute analysis and return an AnalysisResult
    """

    name: str
    depends_on: List[str]

    def analyze(self, ctx: AnalysisContext) -> AnalysisResult:  # noqa: F821
        ...
