# color-science-bench autoresearch

This subproject adapts the autoresearch loop to serious color-science work.

## Goal

Maximize `total_score` while reducing the raw scientific errors:

- `spectral_delta_e00`
- `spectral_xyz_rmse`
- `adaptation_delta_e00`
- `distance_rmse`
- `neutral_ab_rmse`

Higher `total_score` is better.

## Setup

From the repo root:

```bash
uv run experiments/color-science-bench/runner.py init
uv run experiments/color-science-bench/runner.py eval --description baseline
```

## What You CAN Do

- Modify only `experiments/color-science-bench/train.py`
- Improve the spectral surrogate, adaptation logic, and perceptual distance model
- Use rigorous, explicit color science if it fits inside `train.py`
- Reuse helper math from `color_bench.py`, but do not modify it
- Tune the statistical fit itself: learning rate, step count, loss weights, regularization, and feature basis
- Use the measured-data scaffold once `data/measured/manifest.json` is populated, but keep the evaluator itself fixed

## What You CANNOT Do

- Do not modify `runner.py`, `color_bench.py`, or `program.md`
- Do not add new dependencies
- Do not change the benchmark cases or the scoring formulas
- Do not write ad-hoc artifact files outside the runner flow

## Scientific Priorities

Prefer improvements that move the system toward production-grade color engineering:

1. Better spectral approximation or exact integration
2. Better behavior under spiky LED spectra
3. Better fit statistics: lower mean, median, and p95 errors
4. Better neutral preservation after adaptation
5. Better production portability to Julia, MATLAB, ICC, ACES, and OCIO contexts

## Production Criterion

This is not a toy palette generator.

Prefer methods that are:

- auditable
- numerically stable
- portable to Julia and MATLAB
- plausible in camera, display, ICC, ACES, or OCIO pipelines

Opaque hacks are worse than slightly lower score with clear math.

## Experiment Loop

1. Read `experiments/color-science-bench/train.py`
2. Propose one coherent improvement
3. Edit only that file
4. Run:

```bash
uv run experiments/color-science-bench/runner.py eval --description "short experiment description"
```

5. If the result is `keep`, continue from the current file
6. If the result is `discard` or `crash`, the runner has already restored the previous best file
7. Loop forever

## Simplicity Criterion

Prefer mathematically defensible improvements over decorative complexity.

- Exact or near-exact color science is good if the code stays clear
- A tiny score gain from brittle branching is not worth keeping
- If a change improves one submetric but damages neutrality or adaptation badly, discard it
