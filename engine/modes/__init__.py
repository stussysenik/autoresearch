"""
Analysis modes -- each module registers itself with the mode registry at import.

Importing this package triggers registration of all built-in modes:
- move_drill: single move biomechanical deep-dive
- battle_eval: full battle round evaluation with TRIVIUM scoring
- musicality: audio-motion synchronization focus
- pattern_hunt: cross-session pattern discovery
"""
# Import each mode module to trigger register_mode() calls
import engine.modes.move_drill   # noqa: F401
import engine.modes.battle_eval  # noqa: F401
import engine.modes.musicality   # noqa: F401
import engine.modes.pattern_hunt  # noqa: F401
