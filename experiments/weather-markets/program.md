# weather-markets autoresearch

This subproject adapts the autoresearch loop to weather prediction markets.

## Goal

Get the **lowest multiclass Brier score** for the active NYC next-day high-temperature market snapshot.

The live market snapshot is frozen in `market_snapshot.json`, and the historical data lives in `data/history.csv`.

## Setup

From the repo root:

```bash
uv run weather-markets/runner.py init --venue polymarket --city nyc
uv run weather-markets/runner.py eval --description baseline
```

## What you CAN do

- Modify only `weather-markets/train.py`
- Edit only the `predict_bin_probabilities(history_df, market_context)` function
- Use any columns already present in `history_df`
- Use the market bin metadata already loaded in `market_context`

## What you CANNOT do

- Do not modify `runner.py`, `market_snapshot.py`, or `get_data.py`
- Do not add new dependencies
- Do not change the scoring harness or the market snapshot format
- Do not touch files outside `weather-markets/`

## Experiment loop

1. Read `weather-markets/train.py`
2. Propose one idea for improving `predict_bin_probabilities`
3. Edit only that function
4. Run:

```bash
uv run weather-markets/runner.py eval --description "short experiment description"
```

5. If the result is `keep`, continue from the current file
6. If the result is `discard` or `crash`, the runner has already restored the previous best file
7. Loop forever

## Storage constraints

This machine is space-constrained.

- Do not keep ad-hoc logs
- Do not create extra artifacts
- Rely on `runner.py` to persist only best/crash logs

## Simplicity criterion

Prefer simple heuristics that clearly improve score.

- A small score improvement with a much simpler rule is good.
- A tiny score improvement with complex branching is not worth it.
- If a change is fragile or overfit-looking, discard it even if the metric barely improves.
