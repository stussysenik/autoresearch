"""
Breaking Analysis Engine -- DI-based pipeline for bboy motion analysis.

Usage:
    from engine import analyze, AnalysisContext

    ctx = AnalysisContext(
        mode="move_drill",
        data=skeleton_joints,   # [T, 24, 3] numpy array
        fps=30.0,
    )
    result = analyze(ctx)

The engine wires analyzers together based on the analysis mode using
dependency injection. Each mode declares its required analyzers, and
the pipeline resolves execution order via topological sort.

Modes:
- move_drill: single move biomechanical analysis (motion + physics)
- battle_eval: full battle evaluation (motion + audio + physics + scoring)
- musicality: audio-motion sync analysis (motion + audio + scoring)
- pattern_hunt: cross-session pattern discovery (motion + physics)
"""
from engine.analyzers.base import AnalysisResult
from engine.context import AnalysisContext
from engine.pipeline import run_pipeline, MissingDependencyError, CircularDependencyError
from engine.registry import get_mode, list_modes, ModeConfig

# Import modes to trigger registration
import engine.modes  # noqa: F401


def analyze(ctx: AnalysisContext) -> AnalysisContext:
    """Run the analysis pipeline for the given context.

    This is the main entry point. Creates a context, sets the mode,
    and runs the pipeline. Returns the context with all results populated.
    """
    return run_pipeline(ctx)


__all__ = [
    "analyze",
    "AnalysisContext",
    "AnalysisResult",
    "MissingDependencyError",
    "CircularDependencyError",
    "get_mode",
    "list_modes",
    "ModeConfig",
]
