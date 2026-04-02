## Why

The overnight MPC Live II loop is already capable of iterating, but its optimization target still lives mostly in the playground harness and its keep/discard decision is too implicit. We need a repo-local objective, an explicit numerical loss, a stable ordered layer contract, and a bounded unattended run window so the experiment improves the actual product rather than drifting around the harness.

## What Changes

- Add a canonical MPC Live II experiment objective file under `research/mpc-live-ii/` that defines the binary metrics, numerical loss, learning-rate policy, ordered layer names, and geometry tolerances.
- Update the overnight experiment runner to load the objective from `rhino-nlcli`, compute and persist loss, and keep candidates by lower loss rather than by an informal secondary tie-break alone.
- Add explicit guardrails for unattended runs so the loop stops on a fresh Rhino crash signal or once the configured experiment deadline is reached.
- Align the live demo instructions and verification path around an exact chronological layer sequence for the MPC Live II reconstruction.

## Capabilities

### New Capabilities
- `mpc-live-ii-loss-driven-experiment`: Evaluate MPC Live II demo candidates against a repo-local binary-plus-loss objective and stop safely when unattended conditions are no longer valid.
- `mpc-live-ii-chronological-layer-contract`: Define and verify the exact ordered Rhino layer sequence for the staged MPC Live II reconstruction demo.

### Modified Capabilities

## Impact

- Affected repo files: `research/mpc-live-ii/README.md`, `research/mpc-live-ii/objective.json`
- Affected harness files: `experiments/rhino-mechanical-demo/runner.py`, `experiments/rhino-mechanical-demo/program.md`, `experiments/rhino-mechanical-demo/run_overnight.sh`
- Affected behavior: best-candidate selection, summary/status output, stop conditions for unattended runs, and the live-demo layer naming contract
- Operational target: run the loss-driven MPC Live II experiment until `2026-04-02 11:00:00 CEST`
