## 1. OpenSpec Foundation

- [x] 1.1 Create the `add-color-self-learning-experiment` change set
- [x] 1.2 Define the experiment layers and bounded run policy
- [x] 1.3 Add the requirement spec for the timed self-learning loop

## 2. Config Surface (spec: color-self-learning-experiment)

- [x] 2.1 Move train hyperparameters into `candidate_config.json`
- [x] 2.2 Load the config from `train.py`
- [x] 2.3 Ensure the runner snapshots and restores the config together with `train.py`

## 3. Timed Search (spec: color-self-learning-experiment)

- [x] 3.1 Implement a timed search runner for loss and basis mutations
- [x] 3.2 Bound the run by `2026-04-02T11:00:00+02:00`
- [x] 3.3 Review the kept runs after the window closes

## 4. Reporting (spec: color-self-learning-experiment)

- [x] 4.1 Persist iteration-level search logs
- [x] 4.2 Reuse `results.tsv` and `summary.txt` for acceptance reporting
- [x] 4.3 Write a post-run analysis summary from the final retained best
