import argparse
from datetime import datetime

from market_snapshot import MARKET_SNAPSHOT_PATH, build_snapshot, save_snapshot


def main():
    parser = argparse.ArgumentParser(description="Fetch and normalize a weather market snapshot.")
    parser.add_argument("--venue", choices=["polymarket", "kalshi"], default="polymarket")
    parser.add_argument("--city", default="nyc")
    parser.add_argument("--target-date", help="Optional YYYY-MM-DD override for the market date")
    parser.add_argument("--manual-snapshot", help="Path to a manual snapshot JSON for Kalshi or fallback use")
    parser.add_argument("--output", default=str(MARKET_SNAPSHOT_PATH))
    args = parser.parse_args()

    target_date = datetime.strptime(args.target_date, "%Y-%m-%d").date() if args.target_date else None
    snapshot = build_snapshot(
        venue=args.venue,
        city=args.city,
        target_date=target_date,
        manual_snapshot_path=args.manual_snapshot,
    )
    save_snapshot(snapshot, path=args.output)
    print(f"Saved market snapshot to {args.output}")
    print(f"venue:       {snapshot['venue']}")
    print(f"city:        {snapshot['city_display']}")
    print(f"market_date: {snapshot['market_date']}")
    print(f"num_bins:    {len(snapshot['bins'])}")


if __name__ == "__main__":
    main()
