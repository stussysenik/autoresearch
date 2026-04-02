# Rhino Mechanical Demo

This experiment adapts the autoresearch pattern to `rhino-nlcli`.

## Goal

Maximize the quality of the MPC Live II live-build demo so it becomes a more source-backed, mechanical-ready Rhino proof instead of a mostly inferred reference.

The current floor is already good:

- official Akai envelope dimensions are sourced
- official control names are sourced
- the live Rhino build succeeds
- STL export succeeds

The current ceiling is blocked by one gap:

- the cap geometry is still treated as inferred, not a calibrated mechanical reference

## What The Harness Does

`runner.py` protects the best-known Rhino implementation while an external coding agent experiments.

For every evaluation it:

1. builds `rhino-nlcli`
2. runs a live button-cap demo
3. runs a live panel demo
4. scores the result
5. keeps the new work only if the score improves
6. restores the previous best snapshot on regressions or crashes

This repo state is not commit-backed yet, so the harness uses file snapshots instead of Git resets.

## Files

- `program.md` — instructions for the external overnight agent
- `runner.py` — keep/discard harness with snapshot restore
- `run_overnight.sh` — unattended launcher around `codex exec`

## Quick Start

From this directory:

```bash
python3 runner.py init
python3 runner.py status
```

Launch the unattended loop:

```bash
./run_overnight.sh
```

The launcher keeps the Mac awake with `caffeinate`, runs `codex exec`, and records logs in `logs/`.

## Success Metrics

The primary score is now binary and product-facing.

Each metric is either `1` or `0`:

- `source_pack_ready`
- `button_cap_generation_ok`
- `panel_demo_generation_ok`
- `calibration_artifact_valid`
- `runtime_uses_calibration`
- `calibrated_summary_ok`
- `cap_bbox_matches_calibration`
- `chronological_layers_ok`

The total score is:

`passed_metrics / 8 * 100`

That means the overnight loop only keeps work that improves clear product behavior, not just softer heuristic scoring.

The old weighted sub-scores still exist as a secondary tie-breaker:

- `live_build_score`
- `calibration_artifact_score`
- `runtime_integration_score`

The baseline on April 2, 2026 passes only the basic live-generation checks. Calibration and chronological-demo quality are still missing.
