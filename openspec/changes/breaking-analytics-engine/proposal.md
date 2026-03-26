# Breaking Analytics Engine

## Why

We have production-quality motion analysis (9D features), TRIVIUM scoring, and audio analysis — but they exist as standalone scripts with no unified interface. A bboy analyst today must manually orchestrate `analyze_motion.py`, `analyze_track.py`, and `match_beats.py`, switching between them depending on whether they're drilling a specific move, evaluating a battle, studying musicality, or hunting patterns across sessions.

Meanwhile, moves exist only as raw tensors and scalar scores — there's no mathematical representation that lets you compare, cluster, or match moves. The implicit graph structure (move transitions, counter-play, style signatures) is locked in human intuition, not computable.

By end of April we need to be event-ready: any musicology question, hip-hop committee pitch, or last-minute installation should produce results on demand, CPU-only, in under 60 seconds.

## What Changes

### New Capabilities

- **di-engine-core** — Dependency injection pipeline that wires analyzers, data sources, and renderers together based on analysis mode (move-drill, battle-eval, musicality, pattern-hunt). CLI entry point: `bboy analyze <mode> <input>`.

- **move-algebra** — Every move becomes a `MoveSignature` — a compact mathematical fingerprint (PCA-reduced pose, spectral envelope, angular profile, energy curve, contact sequence). Supports distance metrics, clustering, and taxonomy mapping.

- **graph-engine** — Explicit graph data structures for move relationships: transition Markov chains from BRACE data, strategy trees for counter-play, per-dancer style signature graphs, battle flow DAGs.

- **viz-layer** — CLI-native + matplotlib visualization. Terminal sparklines, matrix heatmaps, graph plots, energy time series, and pitch-ready PDF export. No browser required.

- **nineteen-nineties-proving-ground** — 1990s power move (one-hand spin) as the hardest test case validating all 4 layers: rotation analysis, spin counting, moment of inertia tracking, ice skater effect, wobble detection.

- **validator-mentor-agents** — Staff-level engineering intelligence as automated quality gates: Physics Validator, DX Mentor, Architecture Reviewer, Breaking Culture Mentor, Integration Smoke Tester.

### Breaking Changes

None — this is entirely new infrastructure. Existing scripts (`analyze_motion.py`, `match_beats.py`, `analyze_track.py`) are wrapped, not modified.

## Impact

- **Code**: New Python packages: `engine/`, `algebra/`, `graphs/`, `viz/`
- **Dependencies**: NumPy (existing), SciPy (existing), NetworkX (new), Matplotlib (existing), Rich (new)
- **Data**: Consumes BRACE dataset (1352 segments, 64 dancers), SMPL skeleton `.npz` files
- **CLI**: New entry point `bboy analyze` with mode switching
- **GPU**: None required — all CPU-only
