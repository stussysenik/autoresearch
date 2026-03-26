"""
Pattern Hunt mode -- cross-session pattern discovery.

Uses motion + physics to find recurring movement signatures across
multiple clips. Useful for identifying signature moves, tracking
skill progression, and discovering biomechanical patterns.
"""
from engine.analyzers.motion import MotionAnalyzer
from engine.analyzers.physics import PhysicsAnalyzer
from engine.registry import ModeConfig, register_mode

pattern_hunt = register_mode(ModeConfig(
    name="pattern_hunt",
    required_analyzers=[MotionAnalyzer, PhysicsAnalyzer],
    optional_analyzers=[],
    description=(
        "Cross-session pattern discovery. Analyzes motion features and physics "
        "across multiple clips to identify recurring movement signatures, "
        "track skill progression, and discover biomechanical patterns."
    ),
))
