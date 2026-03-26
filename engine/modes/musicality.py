"""
Musicality mode -- audio-motion synchronization focus.

Uses motion + audio + scoring to analyze how well a dancer locks
to the music. Emphasizes beat matching, groove lock, spectral
cross-correlation, and anticipation factors.
"""
from engine.analyzers.audio import AudioAnalyzer
from engine.analyzers.motion import MotionAnalyzer
from engine.analyzers.scoring import ScoringAnalyzer
from engine.registry import ModeConfig, register_mode

musicality = register_mode(ModeConfig(
    name="musicality",
    required_analyzers=[MotionAnalyzer, AudioAnalyzer, ScoringAnalyzer],
    optional_analyzers=[],
    description=(
        "Audio-motion synchronization analysis. Measures how well the dancer "
        "locks to beats, rides the groove, and anticipates musical phrases. "
        "Outputs accent hit rate, groove lock, and multi-band correlation."
    ),
))
