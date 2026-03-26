"""
Move Drill mode -- deep analysis of a single move or short sequence.

Focuses on biomechanics: motion features + physics (angular momentum,
kinetic energy, bone angular velocities). No audio required.
Use this to break down technique, cleanliness, and power of individual moves.
"""
from engine.analyzers.motion import MotionAnalyzer
from engine.analyzers.physics import PhysicsAnalyzer
from engine.registry import ModeConfig, register_mode

move_drill = register_mode(ModeConfig(
    name="move_drill",
    required_analyzers=[MotionAnalyzer, PhysicsAnalyzer],
    optional_analyzers=[],
    description=(
        "Deep biomechanical analysis of a single move or short sequence. "
        "Extracts 9D motion features, physics (angular momentum, kinetic energy, "
        "bone angular velocity), and TRIVIUM body/mind scores."
    ),
))
