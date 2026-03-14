import math
from pathlib import Path

import numpy as np
import pandas as pd

from market_snapshot import find_bin_index, load_snapshot

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "history.csv"
MARKET_SNAPSHOT_PATH = ROOT / "market_snapshot.json"
WINDOW_SIZE = 14
SEASONAL_WINDOW_DAYS = 45


def predict_bin_probabilities(history_df, market_context):
    """
    THE AGENT MAY EDIT ONLY THIS FUNCTION.

    history_df columns:
    - time
    - temperature_2m_max
    - temperature_2m_min
    - apparent_temperature_max
    - precipitation_sum
    - rain_sum
    - snowfall_sum
    - wind_speed_10m_max
    - month
    - day
    - day_of_year
    - weekday
    - is_weekend
    - temp_range

    market_context keys:
    - city
    - market_date
    - bins

    Return:
    - list[float] with one probability per bin
    """
    recent_highs = history_df["temperature_2m_max"].tail(5)
    recent_lows = history_df["temperature_2m_min"].tail(5)
    center_temp_f = 0.55 * recent_highs.iloc[-1] + 0.45 * recent_highs.mean()
    trend_adjustment = recent_highs.iloc[-1] - recent_highs.iloc[0]
    center_temp_f += 0.35 * trend_adjustment
    diff_mean = recent_highs.diff().abs().dropna().mean()
    if pd.isna(diff_mean):
        diff_mean = 0.0
    range_mean = (recent_highs - recent_lows).mean()
    if pd.isna(range_mean):
        range_mean = 0.0
    spread_temp_f = max(
        2.0,
        float(diff_mean),
        float(range_mean * 0.35),
    )

    scores = []
    for bin_def in market_context["bins"]:
        representative_temp_f = bin_def["representative_temp_f"]
        distance = (representative_temp_f - center_temp_f) / spread_temp_f
        scores.append(math.exp(-0.5 * distance * distance))
    return scores


def normalize_probabilities(raw_probabilities, num_bins):
    try:
        values = [float(value) for value in raw_probabilities]
    except Exception:
        return np.full(num_bins, 1.0 / num_bins)

    if len(values) != num_bins:
        return np.full(num_bins, 1.0 / num_bins)

    probs = np.array(values, dtype=np.float64)
    probs = np.nan_to_num(probs, nan=0.0, posinf=0.0, neginf=0.0)
    probs = np.clip(probs, 0.0, None)
    total = probs.sum()
    if total <= 0.0:
        return np.full(num_bins, 1.0 / num_bins)
    return probs / total


def load_history():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Missing historical data at {DATA_PATH}. Run get_data.py first.")
    frame = pd.read_csv(DATA_PATH, parse_dates=["time"])
    return frame


def filter_for_market_season(frame, market_date):
    target_day_of_year = market_date.timetuple().tm_yday
    day_distance = (frame["day_of_year"] - target_day_of_year).abs()
    wrap_distance = 366 - day_distance
    seasonal_distance = np.minimum(day_distance, wrap_distance)
    return frame.loc[seasonal_distance <= SEASONAL_WINDOW_DAYS].copy()


def add_targets(frame, bins):
    future_max = frame["temperature_2m_max"].shift(-1)
    frame["target_temp_f"] = future_max
    frame["target_bin_index"] = future_max.apply(
        lambda temp_f: find_bin_index(bins, temp_f) if pd.notnull(temp_f) else None
    )
    frame = frame.dropna(subset=["target_bin_index"]).copy()
    frame["target_bin_index"] = frame["target_bin_index"].astype(int)
    return frame


def multiclass_brier_score(probabilities, actual_index):
    outcome = np.zeros_like(probabilities)
    outcome[actual_index] = 1.0
    return float(np.mean((probabilities - outcome) ** 2))


def evaluate():
    snapshot = load_snapshot(MARKET_SNAPSHOT_PATH)
    frame = load_history()
    market_date = pd.Timestamp(snapshot["market_date"]).date()
    frame = filter_for_market_season(frame, market_date=market_date)
    frame = add_targets(frame, snapshot["bins"])

    if len(frame) <= WINDOW_SIZE:
        raise RuntimeError(
            f"Not enough seasonal rows to evaluate. Need more than {WINDOW_SIZE}, got {len(frame)}."
        )

    market_context = {
        "venue": snapshot["venue"],
        "city": snapshot["city"],
        "city_display": snapshot["city_display"],
        "market_date": snapshot["market_date"],
        "bins": snapshot["bins"],
    }

    scores = []
    num_bins = len(snapshot["bins"])
    for index in range(WINDOW_SIZE, len(frame)):
        history_df = frame.iloc[index - WINDOW_SIZE:index]
        actual_index = int(frame.iloc[index]["target_bin_index"])
        try:
            raw_probabilities = predict_bin_probabilities(history_df, market_context)
        except Exception:
            raw_probabilities = np.full(num_bins, 1.0 / num_bins)
        probabilities = normalize_probabilities(raw_probabilities, num_bins)
        scores.append(multiclass_brier_score(probabilities, actual_index))

    mean_brier = float(np.mean(scores))
    print("---")
    print(f"venue:             {snapshot['venue']}")
    print(f"city:              {snapshot['city_display']}")
    print(f"market_date:       {snapshot['market_date']}")
    print(f"brier_score:       {mean_brier:.6f}")
    print(f"num_samples:       {len(scores)}")
    print(f"window_size:       {WINDOW_SIZE}")
    print(f"seasonal_window:   {SEASONAL_WINDOW_DAYS}")
    print(f"num_bins:          {num_bins}")


if __name__ == "__main__":
    evaluate()
