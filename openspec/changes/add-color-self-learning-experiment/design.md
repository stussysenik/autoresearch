## Context

The color-science benchmark now contains three critical ingredients:

- a fixed evaluator with explicit metrics
- a trainable surrogate with a declared loss function
- a runner that decides whether a candidate advances

What it still needs is a first-class self-learning loop that can optimize those ingredients over a bounded time window without breaking reproducibility. This design treats the experiment itself as a layered system whose boundaries are inspectable and testable.

## Goals / Non-Goals

**Goals:**
- Define the full layer stack of the self-learning experiment
- Keep the benchmark evaluator fixed while allowing the train configuration to evolve
- Reuse the existing keep/discard runner for acceptance
- Stop at an explicit deadline
- Preserve the best accepted configuration and search log

**Non-Goals:**
- Free-form code rewriting across the repo during the timed run
- Changing the benchmark math mid-run
- Adding external dependencies or remote services
- Claiming instrument-grade validity from synthetic fixtures alone

## Layer Model

### Layer 1: Spec Layer

Defines what the experiment is allowed to optimize and what remains fixed.

- Fixed: benchmark cases, scoring formulas, artifact policy
- Mutable: train configuration, loss weights, learning rate, step count, sensor basis placement and width

### Layer 2: Configuration Layer

Represents the mutable candidate state as structured data.

- `candidate_config.json` is the mutable experiment state
- The config is loadable by `train.py`
- The runner must snapshot and restore the config together with `train.py`

### Layer 3: Feature / Sensor Layer

Defines the surrogate measurement basis used by the spectral model.

- band centers
- band widths
- feature expansion derived from band responses

This layer matters because the search is not only tuning optimizer scalars. It is also shaping the surrogate sensing model.

### Layer 4: Loss Layer

Defines the optimization target used to fit the surrogate.

Current loss terms:

- normalized XYZ reconstruction error
- normalized luminance-channel error
- L2 regularization on weights

This layer is the scientific heart of the experiment. If the loss is poorly weighted, the surrogate can overfit one metric while damaging perceptual fidelity elsewhere.

### Layer 5: Optimizer Layer

Defines how the surrogate learns from the calibration corpus.

- Adam-style moments
- learning rate
- optimization step count
- decay schedule

This layer is distinct from the loss layer because good objectives can still fail under poor optimization schedules.

### Layer 6: Benchmark / Evaluation Layer

Defines the fixed acceptance boundary.

- spectral DeltaE00
- spectral XYZ RMSE
- adaptation DeltaE00
- perceptual-distance RMSE
- neutral-axis stability
- aggregate `total_score`

Only this layer decides whether a candidate is actually better.

### Layer 7: Orchestration Layer

Defines how candidates are proposed and promoted.

- timed loop until `2026-04-02 11:00:00 CEST`
- stochastic local search around the current accepted best
- keep/discard/crash decisions delegated to the runner

This layer is where the repo becomes self-learning in practice rather than in rhetoric.

### Layer 8: Reporting Layer

Defines what evidence survives the run.

- runner `results.tsv`
- runner `summary.txt`
- best accepted config snapshot
- search log with iteration, status, score, best score, and description

## Decisions

### Decision 1: Keep the evaluator fixed and move the search to configuration

**Choice**: Search over `candidate_config.json` instead of rewriting benchmark logic during the timed run.

**Rationale**: This makes the search auditable, keeps the acceptance boundary stable, and avoids self-corrupting the evaluator.

### Decision 2: Reuse the keep/discard runner

**Choice**: The timed loop must call `runner.py eval` rather than deciding promotion on its own.

**Rationale**: A second promotion path would fork the experiment semantics and destroy trust in the artifact trail.

### Decision 3: Treat loss design and sensor basis as co-optimized

**Choice**: Search both scalar optimization hyperparameters and the spectral surrogate basis.

**Rationale**: The benchmark error is shaped by both the objective and the representational basis. Searching one without the other is incomplete.

### Decision 4: Stop at an explicit deadline

**Choice**: The run is bounded by `2026-04-02T11:00:00+02:00`.

**Rationale**: The user requested a sleep-safe run window, and bounded runs are easier to review and compare.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
|------|----------|------------|
| Search overfits synthetic fixtures | High | Keep the evaluator fixed and plan measured datasets as the next milestone |
| Search generates too many low-value evaluations | Medium | Search locally around the current best and keep structured logs |
| Config drift is not restored on discard | High | Snapshot and restore `candidate_config.json` alongside `train.py` |
| Timed run silently stops early | Medium | Log every iteration and record completion in the search log |
| Zero-error adaptation/distance terms dominate score interpretation | Medium | Keep raw submetrics visible and prioritize spectral improvements in follow-up work |

## Delivery Plan

### Phase 0: OpenSpec Definition
- add proposal, design, tasks, and requirements
- define the experiment layers and acceptance boundary

### Phase 1: Configurable Benchmark Surface
- load train configuration from structured JSON
- snapshot and restore config with the runner

### Phase 2: Timed Self-Learning Runner
- implement stochastic search over loss and sensor parameters
- run candidates through the existing runner until the deadline

### Phase 3: Review
- inspect best score, search trajectory, and retained artifacts
- decide whether the next pass should expand the benchmark or refine the search
