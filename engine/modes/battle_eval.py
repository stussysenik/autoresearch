"""
Battle Eval mode -- full evaluation of a dancer's round in a battle.

Uses all four analyzers: motion + audio + physics + scoring.
Produces the complete TRIVIUM score (body/soul/mind) with musicality
analysis, accent-beat matching, and biomechanical breakdown.
"""
from engine.analyzers.audio import AudioAnalyzer
from engine.analyzers.motion import MotionAnalyzer
from engine.analyzers.physics import PhysicsAnalyzer
from engine.analyzers.scoring import ScoringAnalyzer
from engine.registry import ModeConfig, register_mode

battle_eval = register_mode(ModeConfig(
    name="battle_eval",
    required_analyzers=[MotionAnalyzer, AudioAnalyzer, ScoringAnalyzer, PhysicsAnalyzer],
    optional_analyzers=[],
    description=(
        "Full battle round evaluation. Combines motion analysis, audio analysis, "
        "biomechanical physics, and TRIVIUM scoring. Produces body/soul/mind scores, "
        "musicality metrics, and accent-beat synchronization analysis."
    ),
))
