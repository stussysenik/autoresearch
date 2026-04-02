# Color Science Bench Post-Run Report

Date: `2026-04-02`

## Outcome

The self-learning swarm materially improved the benchmarked spectral core.

- Initial kept baseline in the main lane: `63.231874`
- Global best retained lane: [color-science-bench-swarm-b](/Users/s3nik/Desktop/autoresearch-playground/experiments/color-science-bench-swarm-b)
- Global best score: `68.118161`
- Absolute score gain: `+4.886287`
- Relative score gain: `+7.727%`

The strongest measurable improvement was in spectral reconstruction:

- Baseline `spectral_delta_e00`: `6.208359`
- Best `spectral_delta_e00`: `3.977618`
- Absolute improvement: `2.230741`
- Relative improvement: `35.931%`

Adaptation, perceptual distance, and neutral-axis terms remained effectively solved inside the synthetic harness, so the optimization pressure concentrated on the spectral surrogate.

## Promoted Baseline

The main baseline was promoted from the global winner into:

- [candidate_config.json](/Users/s3nik/Desktop/autoresearch-playground/experiments/color-science-bench/candidate_config.json)

Promoted parameters:

- `learning_rate = 0.00274291`
- `optimization_steps = 2200`
- `xyz_loss_weight = 1.09688`
- `y_loss_weight = 0.507405`
- `l2_regularization = 0.0001828572`

Promoted spectral basis:

- `band_centers = [395.5211, 429.3513, 473.1203, 519.4860, 533.4860, 557.4493, 584.3109, 690.0]`
- `band_widths = [26.7785, 8.0, 12.1291, 26.8310, 29.0425, 32.6313, 33.4204, 45.6024]`

## Lane Snapshot

The final visible frontier across the main six tracked lanes was:

- `color-science-bench`: `67.9208`
- `swarm-b`: `67.9583`
- `swarm-c`: `67.9570`
- `swarm-d`: `67.9627`
- `swarm-e`: `67.8597`
- `swarm-f`: `67.9642`

An earlier isolated lane, [color-science-bench-swarm-b](/Users/s3nik/Desktop/autoresearch-playground/experiments/color-science-bench-swarm-b), outperformed the active six-lane frontier and produced the promoted global winner at `68.118161`.

## What The Search Learned

The run surfaced a stable optimization basin rather than random noise.

The optimizer repeatedly favored:

- low learning rates, roughly `0.0027-0.0041`
- maximum or near-maximum step counts, often `2200`
- nontrivial `y_loss_weight`, roughly `0.5-0.8`
- moderate to high `xyz_loss_weight`, roughly `1.1-2.5`
- visible movement in the spectral basis, especially around the blue and yellow-green bands

The main saturation signal was that `optimization_steps` frequently wanted to sit at the ceiling. That means the next step should not be “more random search on the same synthetic benchmark.” It should be a harder benchmark and a better dataset.

## Measured-Data Upgrade

The benchmark now has a measured-data scaffold in:

- [data/measured/README.md](/Users/s3nik/Desktop/autoresearch-playground/experiments/color-science-bench/data/measured/README.md)
- [manifest.template.json](/Users/s3nik/Desktop/autoresearch-playground/experiments/color-science-bench/data/measured/manifest.template.json)
- [reflectances.template.csv](/Users/s3nik/Desktop/autoresearch-playground/experiments/color-science-bench/data/measured/reflectances.template.csv)
- [illuminants.template.csv](/Users/s3nik/Desktop/autoresearch-playground/experiments/color-science-bench/data/measured/illuminants.template.csv)

Once `manifest.json` is populated with measured spectra, the harness can:

- add measured calibration pairs into training
- add held-out measured spectral benchmark pairs
- add measured adaptation cases
- add measured perceptual-distance cases

## Recommended Next Step

Do not spend the next cycle only on more search over the current synthetic corpus.

The highest-value next move is:

1. populate the measured-data scaffold with real reflectance and illuminant spectra
2. define held-out measured eval pairs
3. rerun the self-learning search against that harder benchmark
