## Why

`autoresearch-playground` now has a credible color-science benchmark, but it still lacks a timed, repo-native self-learning experiment that can optimize its own loss function, learning rate, feature basis, and search behavior while preserving reproducibility. The missing piece is a formally defined experiment stack that can run for a bounded window, keep only validated improvements, and expose each layer of the optimization pipeline for review.

## What Changes

- Add an OpenSpec change for a timed self-learning color-science experiment
- Define the layered architecture of the experiment from spec, config, loss, optimization, evaluation, orchestration, and reporting
- Add a timed search runner that mutates the benchmark configuration and reuses the keep/discard harness
- Require the experiment to stop at an explicit deadline and persist the best accepted configuration

## Capabilities

### New Capabilities
- `color-self-learning-experiment`: bounded search over loss and optimization configuration for the color-science benchmark
- `timed-experiment-orchestration`: deadline-aware runner that advances only on measured improvement
- `loss-statistics-reporting`: explicit reporting of fit loss, learning-rate configuration, and raw benchmark metrics

### Modified Capabilities
- `autoresearch-framework`: expands from generic experiment loops into a self-optimizing statistical search over color-science loss design

## Impact

- **Repository direction**: adds a concrete, running example of self-learning optimization inside the repo
- **Execution model**: uses the existing keep/discard artifact policy rather than inventing a second acceptance path
- **OpenSpec coverage**: makes the experiment layers and responsibilities explicit before the long run executes
- **Operational boundary**: constrains the experiment to a declared deadline instead of indefinite drift
