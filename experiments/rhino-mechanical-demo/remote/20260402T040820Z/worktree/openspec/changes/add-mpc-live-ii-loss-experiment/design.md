## Context

The current MPC Live II loop already builds the repo, runs the autoresearch flow, and evaluates the resulting live Rhino demo. The problem is that the core objective is not yet a first-class artifact in `rhino-nlcli`, the candidate selector is still effectively based on pass-count plus a secondary score, and the unattended loop does not explicitly stop on a fresh Rhino crash signal or a hard deadline.

The user wants a "self-learning" experiment, but in this repo that should mean a reproducible numerical objective and a low learning-rate search policy, not vague autonomous behavior. The experiment also needs a clear layer contract so the Rhino demo stays chronologically legible: sources first, export last, with stable stage names in between.

## Goals / Non-Goals

**Goals:**

- Make the MPC Live II experiment objective canonical inside `rhino-nlcli`.
- Switch keep/discard decisions to a numerical loss that still prioritizes binary product improvements.
- Define the exact ordered layer sequence the runtime and evaluation should honor.
- Add unattended-run stop conditions for a deadline and fresh Rhino crash evidence.
- Launch a bounded experiment that can safely run until 11:00 AM local time.

**Non-Goals:**

- Build a generic hyperparameter tuning framework for every repo experiment.
- Add online learning, model training, or probabilistic search infrastructure.
- Change the existing MPC Live II demo geometry itself in this change unless needed to satisfy the ordered-layer contract.
- Suppress or ignore real Rhino crashes in order to keep the loop active.

## Decisions

### 1. Store the objective as repo-local JSON under `research/mpc-live-ii/objective.json`

The experiment objective should live with the MPC research artifacts, not only in the playground harness. The JSON file will define:

- objective name and optimization goal
- learning-rate policy for the search loop
- ordered binary metrics
- numerical loss formula and secondary weight
- ordered Rhino layer names
- bounding-box tolerances for calibration checks

This keeps the harness subordinate to the product repo and gives the autoresearch loop a single source of truth.

Alternative considered:

- Leave the loss definition embedded only in the playground runner.
  Rejected because it makes the experiment harder to inspect, version, and reason about from the actual product repo.

### 2. Use a loss that is dominated by binary pass fraction and only lightly shaped by the secondary score

The loop should minimize:

`loss = (1 - binary_pass_fraction) + secondary_weight * (1 - secondary_score / 100)`

with `secondary_weight = 0.25`.

This preserves the user's requirement that a change only really counts when it improves real product behavior, while still preferring stronger live-demo quality when binary progress is tied.

Alternative considered:

- Optimize only the binary pass count.
  Rejected because it discards useful gradient between two candidates that pass the same number of hard checks.

### 3. Treat the ordered Rhino layers as a contract, not just a recommendation

The demo and the evaluator should share the same exact layer names:

1. `MPCLiveII::01_Sources`
2. `MPCLiveII::02_Envelope`
3. `MPCLiveII::03_Anchors`
4. `MPCLiveII::04_ButtonFamily`
5. `MPCLiveII::05_Cap2D`
6. `MPCLiveII::06_Cap3D`
7. `MPCLiveII::07_Mesh`
8. `MPCLiveII::08_Export`

This gives the live Rhino build a stable chronology and makes the evaluation contract mechanically legible.

Alternative considered:

- Keep loose layer naming guidance in the prompt only.
  Rejected because the evaluation loop cannot reliably reward or penalize presentation clarity unless the names are explicit and shared.

### 4. Stop unattended runs on fresh Rhino crash evidence or a hard deadline

The loop will seed a baseline of existing Rhino crash reports at initialization, then stop if a newer report appears or if a Rhino error-reporting process is active. The shell wrapper will also stop before starting another round once the configured deadline has been reached.

Alternative considered:

- Continue looping after crashes and just rely on restore logic.
  Rejected because repeated native Rhino aborts are a real operational failure and should not be normalized during an unattended experiment.

## Risks / Trade-offs

- [Objective drift] -> If the repo-local objective and runner diverge, the loop may optimize the wrong thing. Mitigation: load metric order, loss weight, layer names, and tolerances directly from the repo-local objective.
- [False-positive crash stop] -> Old crash reports could prematurely stop the run. Mitigation: seed the current latest report at initialization and only stop on newer evidence.
- [Overfitting to documentation] -> A strict layer contract may reward naming without improving geometry. Mitigation: keep the layer check as one binary metric among several product and calibration checks.
- [Deadline truncation] -> A run may end mid-improvement at 11:00 AM. Mitigation: persist the current best snapshot continuously and stop only between rounds.

## Migration Plan

1. Add the new OpenSpec artifacts for the loss-driven experiment and layer contract.
2. Create `research/mpc-live-ii/objective.json` and document it in the repo README for that directory.
3. Update the experiment runner and shell wrapper to load the repo-local objective, compute loss, and honor crash/deadline stops.
4. Reinitialize the baseline under the new objective.
5. Launch the bounded unattended run with a stop time of `2026-04-02 11:00:00 CEST`.

Rollback is straightforward: remove the objective file, revert the runner/shell changes, and restore the previous baseline snapshot.

## Open Questions

- Do we later want the runtime itself to emit the ordered layer list in result metadata, or is source-text verification enough for now?
- Should future experiments support deadline timestamps in UTC only, or keep accepting local wall-clock deadlines for operator convenience?
