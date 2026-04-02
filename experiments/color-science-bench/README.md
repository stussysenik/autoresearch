# Color Science Bench

This experiment turns the generic autoresearch playground into a color-science R&D harness.

The point is not to claim "the colors feel better." The point is to make that claim measurable, reproducible, and worth engineering against.

## What Is Here

- `color_bench.py` is the fixed evaluator.
- `train.py` is the only file the autoresearch agent should edit.
- `runner.py` gives a keep/discard/crash loop with artifact retention.
- `program.md` tells an external autoresearch agent how to iterate safely.
- `data/measured/` is the scaffold for measured spectra once you move beyond synthetic-only fixtures.

## Scientific Scope

This first version is a serious foundation, but it is still stage zero rather than a finished X-Rite competitor.

The fixed benchmark currently covers:

- spectral forward modeling from reflectance and illuminant SPD to XYZ
- chromatic adaptation, with CAT16 as the reference and current implementation
- perceptual distance, with CIEDE2000 as the reference and current implementation
- neutral-axis stability after adaptation
- spiky-light failure modes via warm LED, cool LED, and RGB LED proxy illuminants

The current implementation in `train.py` is strongest in adaptation and distance, and still leaves room in the spectral surrogate:

- a learned multi-band surrogate model instead of full spectral integration
- a learned spectral surrogate fit instead of a hardcoded closed-form table

That means the immediate autoresearch headroom is mostly in spectral prediction, robustness, training statistics, and eventual measured-data replacement.

## Why This Matters

If you want this repo to become relevant to ARRI, Hasselblad, Leica, DaVinci Resolve, ACES, ICC, OCIO, or instrument-grade tooling, the core has to be:

- spectrally literate
- adaptation-aware
- appearance-aware
- benchmarked against fixed reference math
- portable across Python, Julia, and MATLAB

This harness is built around plain `numpy`, deterministic synthetic cases, and explicit formulas so the same math can be ported into Julia or MATLAB without reverse-engineering opaque ML artifacts.

## Loss And Optimization

`train.py` now contains an explicit optimization step instead of a hidden least-squares shortcut.

The spectral surrogate is fit with Adam-style updates and a named learning rate:

- `LEARNING_RATE`
- `OPTIMIZATION_STEPS`
- `XYZ_LOSS_WEIGHT`
- `Y_LOSS_WEIGHT`
- `L2_REGULARIZATION`

The implemented fit loss is:

```text
L = w_xyz * mean(((xyz_hat - xyz) / sigma_xyz)^2)
  + w_y   * mean(((Y_hat - Y) / sigma_Y)^2)
  + lambda * mean(W^2)
```

This keeps the fit tied to measurable colorimetric error, luminance stability, and statistical regularization.

## What It Does Not Claim Yet

It does **not** yet replace measured datasets, commercial instrument workflows, or full camera/display characterization.

To move toward that level, the next upgrades should be:

1. Replace the synthetic reflectance library with measured targets such as ColorChecker, IT8, textile, paint, skin, and fluorescent samples.
2. Replace the proxy illuminants with measured CIE daylight, A/F-series, and modern LED spectra.
3. Add camera spectral sensitivity sets, IDT fitting, and ACES/OCIO/ICC validation targets.
4. Add observer variants, flare/stray-light models, and metameric failure analysis.
5. Export benchmark tables in CSV/JSON so Julia and MATLAB can consume the same test corpus.

## Measured Data Scaffold

The benchmark now has a repo-native measured-data hook.

To use it:

1. Copy `data/measured/manifest.template.json` to `data/measured/manifest.json`.
2. Replace the template CSV files with measured reflectance and illuminant spectra.
3. Declare calibration, benchmark, adaptation, and distance pairs in the manifest.

The loader interpolates arbitrary wavelength sampling onto the canonical `380-780 nm` grid as long as the measured data covers that full range.

Until `manifest.json` exists, the benchmark stays synthetic-only.

## Quick Start

From the repo root:

```bash
uv run experiments/color-science-bench/runner.py init
uv run experiments/color-science-bench/runner.py eval --description baseline
uv run experiments/color-science-bench/runner.py status
```

The runner will keep only improvements and will restore the previous best `train.py` after regressions or crashes.

## Scoring

`total_score` is a convenience score on a 0-100 style scale where higher is better.

The raw metrics matter more:

- `spectral_delta_e00`
- `spectral_xyz_rmse`
- `adaptation_delta_e00`
- `distance_rmse`
- `neutral_ab_rmse`
- `spectral_de_median`
- `spectral_de_p95`
- `adaptation_de_p95`
- `distance_abs_median`
- `distance_abs_p95`

Use `total_score` to drive the overnight loop. Use the raw metrics to understand what actually improved.
