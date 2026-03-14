# Weather Markets

This subproject adapts the autoresearch workflow to weather prediction markets.

## Goal

The first overnight target is **NYC next-day high-temperature bin markets**. The objective is to minimize a **multiclass Brier score** against historical weather outcomes using the active market's bin partition.

This is stage one of a two-stage setup:

1. **Tonight:** a lightweight forecast-to-resolution scaffold using Open-Meteo daily history and a frozen market snapshot.
2. **Later:** raw NOAA GRIB2 ingestion and lower-latency model-release handling.

## Files

- `market_snapshot.py` — fetches and normalizes a market definition.
- `fetch_market_snapshot.py` — CLI entrypoint to save `market_snapshot.json`.
- `get_data.py` — downloads historical NYC daily weather.
- `train.py` — locked evaluator; the agent only edits `predict_bin_probabilities`.
- `runner.py` — manages baseline/best snapshots, logs, and storage guardrails.
- `program.md` — instructions for an external autoresearch agent.

## Quick Start

From the repo root:

```bash
uv run weather-markets/runner.py init --venue polymarket --city nyc
uv run weather-markets/runner.py eval --description baseline
```

For an overnight agent session, keep the Mac awake and work from the subproject instructions:

```bash
caffeinate -dimsu
```

Then point your coding agent at `weather-markets/program.md` and let it iterate with `runner.py eval`.

For a Kalshi-style market, point init at a manual snapshot file:

```bash
uv run weather-markets/runner.py init \
  --venue kalshi \
  --city nyc \
  --manual-snapshot weather-markets/manual_market_snapshot.json.example
```

## Overnight Workflow

1. Initialize the market snapshot and historical data.
2. Run the baseline once.
3. Edit only `predict_bin_probabilities` in `train.py`.
4. Run `runner.py eval --description "..."` after each idea.
5. The runner keeps improvements and restores the previous best after regressions or crashes.

## Storage Policy

This machine has tight free space, so the runner keeps:

- one rolling `artifacts/current.log`
- an append-only `results.tsv`
- snapshots/logs only for new best runs and crashes

The runner stops before disk exhaustion if free space drops below `1.5 GiB` or if `artifacts/` grows beyond `500 MiB`.
