# MPC Live II Winning Run Bundle

Winning run: `20260402T040820Z`

This bundle captures the winning autoresearch result that reached:

- `best_score = 100.0`
- `best_loss = 0.0000`
- `binary_pass = 8/8`

## Preview Images

- `previews/cap-isometric.png`
- `previews/panel-isometric.png`
- `previews/panel-top.png`

## Included Artifacts

- `artifacts/overnight-cap-20260402T040820Z-overnight-play-start-cap-20264-2.stl`
- `artifacts/overnight-panel-20260402T040820Z-overnight-panel-demo-22082-2.stl`
- `artifacts/overnight-cap-20260402T040820Z-20264-2.py`
- `artifacts/overnight-panel-20260402T040820Z-22082-2.py`
- `artifacts/cap-calibration.json`
- `artifacts/objective.json`
- `artifacts/best.json`
- `artifacts/summary.txt`
- `worktree/` snapshot of the winning `rhino-nlcli` implementation

## Model Notes

- The cap reference is calibrated to official Akai sources, not factory CAD.
- The calibrated cap dimensions are `18.0 x 8.6 x 3.4 mm`.
- The Rhino demo uses the ordered layers `MPCLiveII::01_Sources` through `MPCLiveII::08_Export`.

## Recommended Remote Review Order

1. Open `previews/panel-isometric.png`
2. Open `previews/panel-top.png`
3. Inspect the two STL files
4. Review `artifacts/cap-calibration.json`
5. Review `artifacts/overnight-panel-20260402T040820Z-22082-2.py` for the live-build sequence
6. Review `worktree/src/rhino_live_demo.zig` and `worktree/openspec/changes/add-mpc-live-ii-loss-experiment/`
