# Rhino Mechanical Demo Autoresearch

Your job is to improve the MPC Live II live-build demo inside:

`/Users/s3nik/Desktop/rhino-nlcli`

The harness for this overnight run lives here:

`/Users/s3nik/Desktop/autoresearch-playground/experiments/rhino-mechanical-demo`

## Goal

Produce the most accurate, mechanically credible, source-backed 3D live-build demo for `rhino-nlcli`, centered on the MPC Live II reconstruction path.

More specifically:

- keep the live Rhino build working
- keep STL export working
- improve the mechanical/provenance story around the cap geometry
- move the system from an inferred reference toward a calibrated reference demo
- make the live build read as a chronological reconstruction, not just a final mesh dump

## Ground Rules

- Edit `rhino-nlcli`, not this harness
- Do not modify `runner.py`, `program.md`, or `run_overnight.sh`
- Do not edit generated files under `rhino-nlcli/var/`
- Do not touch `.env.local`
- Prefer official Akai sources already downloaded in `rhino-nlcli/var/mpc-live-ii/source-pack/`
- If you need more evidence, prefer official Akai pages and manuals over third-party sources

## Important Context

The harness already gives you a protected keep/discard loop.

Use it:

```bash
python3 /Users/s3nik/Desktop/autoresearch-playground/experiments/rhino-mechanical-demo/runner.py status
python3 /Users/s3nik/Desktop/autoresearch-playground/experiments/rhino-mechanical-demo/runner.py eval --description "short note"
```

When `eval` returns:

- `keep`: the score improved; continue from the current repo state
- `discard`: the harness already restored the previous best snapshot
- `crash`: the harness already restored the previous best snapshot

## Binary Success Metrics

The canonical objective for this loop now lives in:

`/Users/s3nik/Desktop/rhino-nlcli/research/mpc-live-ii/objective.json`

The harness evaluates the product using explicit `1/0` checks.

You are primarily trying to flip these from `0` to `1`:

- `source_pack_ready`
- `button_cap_generation_ok`
- `panel_demo_generation_ok`
- `calibration_artifact_valid`
- `runtime_uses_calibration`
- `calibrated_summary_ok`
- `cap_bbox_matches_calibration`
- `chronological_layers_ok`

The public score is `passed / 8 * 100`.

Keep/discard is decided by minimizing:

`loss = (1 - binary_pass_fraction) + 0.25 * (1 - secondary_score / 100)`

Treat the loop as low learning-rate search:

- make one coherent product change per round
- prefer stable, verifiable improvements over large speculative rewrites
- keep the ordered MPC layer contract intact while improving generation quality

## Where To Focus

Prioritize the MPC Live II path:

- `src/rhino_live_demo.zig`
- `src/planner.zig`
- `src/types.zig`
- `research/mpc-live-ii/`
- `scripts/autoresearcher`
- `scripts/mpc-live-ii-loop.lib.sh`
- top-level docs only if they clarify provenance honestly

## Best Opportunities

The current baseline is strong on live execution but weak on calibration.

High-value improvements:

1. Add a real `research/mpc-live-ii/cap-calibration.json` artifact with explicit numeric dimensions and provenance.
2. Load and use that calibration inside the Rhino demo path instead of leaving everything hardcoded and inferred.
3. Make the button-cap and panel-demo outputs say `calibrated` only when that is actually true.
4. Improve the staged Rhino presentation so it still reads as a live mechanical reconstruction, not a generic loft demo.
5. Keep the provenance language honest. Do not claim factory exactness if the source material does not justify it.
6. Name layers and stages clearly enough that a human watching Rhino can understand the build order at a glance.

## Layer And Stage Discipline

Treat the Rhino presentation as a chronologically legible build sequence.

- Prefer explicit ordered layers such as `MPCLiveII::01_Sources`, `MPCLiveII::02_Envelope`, `MPCLiveII::03_Anchors`, `MPCLiveII::04_ButtonFamily`, `MPCLiveII::05_Cap2D`, `MPCLiveII::06_Cap3D`, `MPCLiveII::07_Mesh`, `MPCLiveII::08_Export`
- Keep names stable and mechanical, not decorative
- Preserve a clear progression from official source anchors to calibrated geometry to final export
- If you add annotations or text dots, make them reinforce provenance and stage order
- Favor improvements that make the demo easier to present live in Rhino

## Loop

1. Read the current status
2. Inspect the relevant Rhino files
3. Make one coherent improvement
4. Run:

```bash
python3 /Users/s3nik/Desktop/autoresearch-playground/experiments/rhino-mechanical-demo/runner.py eval --description "what changed"
```

5. Continue from the current state only if the result is `keep`
6. Loop until the score reaches `100` or you run out of meaningful ideas

## Simplicity Criterion

Prefer changes that make the demo more trustworthy and more mechanically legible.

- An honest calibrated reference is better than fake exactness
- A simpler, defensible geometry story is better than decorative complexity
- Do not add sprawling abstractions for tiny gains
- A clearer chronological stage sequence is better than clever but opaque scene setup
