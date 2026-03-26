"""
Analyzer implementations for the breaking analysis engine.

Each analyzer wraps an existing experiment module or implements new
computation. All conform to the Analyzer protocol defined in base.py.

Concrete analyzers are imported lazily to avoid circular imports
(context.py imports from base.py, and analyzers import context.py).
"""
from engine.analyzers.base import Analyzer, AnalysisResult

__all__ = [
    "Analyzer",
    "AnalysisResult",
    "MotionAnalyzer",
    "PhysicsAnalyzer",
    "AudioAnalyzer",
    "ScoringAnalyzer",
]


def __getattr__(name: str):
    """Lazy imports to break circular dependency with engine.context."""
    if name == "MotionAnalyzer":
        from engine.analyzers.motion import MotionAnalyzer
        return MotionAnalyzer
    if name == "PhysicsAnalyzer":
        from engine.analyzers.physics import PhysicsAnalyzer
        return PhysicsAnalyzer
    if name == "AudioAnalyzer":
        from engine.analyzers.audio import AudioAnalyzer
        return AudioAnalyzer
    if name == "ScoringAnalyzer":
        from engine.analyzers.scoring import ScoringAnalyzer
        return ScoringAnalyzer
    raise AttributeError(f"module 'engine.analyzers' has no attribute {name!r}")
