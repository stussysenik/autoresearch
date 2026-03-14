import argparse
from datetime import date
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DATA_PATH = DATA_DIR / "history.csv"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def fetch_history(start_date, end_date, latitude, longitude, timezone):
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "apparent_temperature_max",
                "precipitation_sum",
                "rain_sum",
                "snowfall_sum",
                "wind_speed_10m_max",
            ]
        ),
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": timezone,
    }
    response = requests.get(OPEN_METEO_ARCHIVE_URL, params=params, timeout=60)
    response.raise_for_status()
    payload = response.json()
    frame = pd.DataFrame(payload["daily"])
    frame["time"] = pd.to_datetime(frame["time"])
    frame["month"] = frame["time"].dt.month
    frame["day"] = frame["time"].dt.day
    frame["day_of_year"] = frame["time"].dt.dayofyear
    frame["weekday"] = frame["time"].dt.weekday
    frame["is_weekend"] = frame["weekday"].isin([5, 6]).astype(int)
    frame["temp_range"] = frame["temperature_2m_max"] - frame["temperature_2m_min"]
    return frame


def main():
    parser = argparse.ArgumentParser(description="Download historical NYC weather data for market backtests.")
    parser.add_argument("--start-date", default="2014-01-01")
    parser.add_argument("--end-date", default=date.today().isoformat())
    parser.add_argument("--latitude", type=float, default=40.7143)
    parser.add_argument("--longitude", type=float, default=-74.0060)
    parser.add_argument("--timezone", default="America/New_York")
    parser.add_argument("--output", default=str(DATA_PATH))
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    frame = fetch_history(
        start_date=args.start_date,
        end_date=args.end_date,
        latitude=args.latitude,
        longitude=args.longitude,
        timezone=args.timezone,
    )
    frame.to_csv(args.output, index=False)
    print(f"Saved historical data to {args.output}")
    print(f"rows:        {len(frame)}")
    print(f"start_date:  {frame['time'].min().date()}")
    print(f"end_date:    {frame['time'].max().date()}")


if __name__ == "__main__":
    main()
