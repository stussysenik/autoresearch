# Observatory Code Extracted

**Date**: 2026-03-24
**Moved to**: `experiments/components/observatory/`

All Python code from this directory has been extracted into the main component system:

| Original file | New location |
|---------------|-------------|
| `body_state.py` | `experiments/components/observatory/body_state.py` |
| `color_system.py` | `experiments/components/observatory/color_system.py` |
| `skeleton_panel.py` | `experiments/components/observatory/skeleton_panel.py` |
| `video_panel.py` | `experiments/components/observatory/video_panel.py` |
| `header.py` | `experiments/components/observatory/header.py` |
| `timeline_strip.py` | `experiments/components/observatory/timeline_strip.py` |
| `render.py` | `experiments/components/observatory/render.py` |

Additionally, constants from `analyze_motion.py` (BONE_PAIRS, JOINT_WEIGHTS, etc.) were extracted to `experiments/components/observatory/constants.py`.

Imports were updated from `from analyze_motion import ...` and `from observatory.X import ...` to relative imports (`from .constants import ...`, `from .color_system import ...`).
