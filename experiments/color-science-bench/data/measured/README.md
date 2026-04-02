# Measured Data Scaffold

This directory is the bridge from synthetic benchmark fixtures to measured spectra.

## Files

- `manifest.template.json` defines the dataset schema.
- `reflectances.template.csv` shows the expected reflectance table format.
- `illuminants.template.csv` shows the expected illuminant table format.

The benchmark only loads measured data when a real `manifest.json` exists in this directory.

## Workflow

1. Copy `manifest.template.json` to `manifest.json`.
2. Replace the template CSV contents with measured spectra.
3. Keep the first CSV column as `wavelength_nm`.
4. Keep every other column name stable and reference those names from the manifest.
5. Run `python3 experiments/color-science-bench/train.py` to confirm the measured case counts are nonzero.

## Manifest Sections

- `calibration_pairs`
  These samples are appended to the fitting set in `train.py`.
- `benchmark_pairs`
  These become held-out measured spectral evaluation cases.
- `adaptation_pairs`
  These create measured chromatic adaptation checks.
- `distance_pairs`
  These create measured perceptual-distance checks under a named illuminant.

## Sampling Rules

- The loader interpolates spectra onto the benchmark’s canonical `380-780 nm` grid.
- Your measured wavelengths must cover the full `380-780 nm` domain.
- Reflectance values should live in `[0, 1]`.
- Illuminant values must be non-negative.

## Intended First Real Data

Good first population targets:

- ColorChecker or IT8 reflectances
- measured D65 / A / F-series / LED illuminants
- skin, textile, paint, and fluorescent samples
- camera-sensitivity-linked chart captures for later profile fitting
