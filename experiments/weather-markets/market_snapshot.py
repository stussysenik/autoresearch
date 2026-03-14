import json
import re
from datetime import date, datetime, timedelta, timezone
from html import unescape
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
MARKET_SNAPSHOT_PATH = ROOT / "market_snapshot.json"
MANUAL_MARKET_SNAPSHOT_PATH = ROOT / "manual_market_snapshot.json.example"
POLYMARKET_WEATHER_URL = "https://polymarket.com/predictions/weather"
POLYMARKET_EVENT_URL = "https://polymarket.com/event/{slug}"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
}

CITY_DISPLAY_NAMES = {
    "nyc": "New York City",
}


def _request_text(url):
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def _parse_slug_date(slug):
    match = re.search(r"-on-([a-z]+)-(\d{1,2})-(\d{4})$", slug)
    if not match:
        raise ValueError(f"Could not parse date from slug: {slug}")
    month_name, day_num, year_num = match.groups()
    return datetime.strptime(
        f"{month_name.title()} {day_num} {year_num}",
        "%B %d %Y",
    ).date()


def _choose_slug(city, target_date=None):
    page_html = _request_text(POLYMARKET_WEATHER_URL)
    pattern = rf"\"slug\":\"(highest-temperature-in-{re.escape(city)}-on-[^\"]+)\""
    slugs = sorted(set(re.findall(pattern, page_html)))
    if not slugs:
        raise RuntimeError(f"No Polymarket weather event slug found for city={city}")

    desired_date = target_date or (date.today() + timedelta(days=1))
    dated_slugs = []
    for slug in slugs:
        try:
            dated_slugs.append((_parse_slug_date(slug), slug))
        except ValueError:
            continue
    if not dated_slugs:
        raise RuntimeError(f"No dated Polymarket weather slugs found for city={city}")

    future = [item for item in dated_slugs if item[0] >= desired_date]
    chosen_date, chosen_slug = min(future or dated_slugs, key=lambda item: item[0])
    return chosen_date, chosen_slug


def _format_bin_label(lower_temp_f, upper_temp_f):
    if lower_temp_f is None:
        return f"<={int(upper_temp_f)}F"
    if upper_temp_f is None:
        return f">={int(lower_temp_f)}F"
    return f"{int(lower_temp_f)}-{int(upper_temp_f)}F"


def _parse_bin_from_question(question):
    if match := re.search(r"be (\d+)°F or below", question):
        upper_temp_f = float(match.group(1))
        return {
            "label": _format_bin_label(None, upper_temp_f),
            "lower_temp_f": None,
            "upper_temp_f": upper_temp_f,
            "inclusive_lower": False,
            "inclusive_upper": True,
            "representative_temp_f": upper_temp_f - 2.0,
            "question": question,
        }
    if match := re.search(r"be between (\d+)-(\d+)°F", question):
        lower_temp_f = float(match.group(1))
        upper_temp_f = float(match.group(2))
        return {
            "label": _format_bin_label(lower_temp_f, upper_temp_f),
            "lower_temp_f": lower_temp_f,
            "upper_temp_f": upper_temp_f,
            "inclusive_lower": True,
            "inclusive_upper": True,
            "representative_temp_f": (lower_temp_f + upper_temp_f) / 2.0,
            "question": question,
        }
    if match := re.search(r"be (\d+)°F or higher", question):
        lower_temp_f = float(match.group(1))
        return {
            "label": _format_bin_label(lower_temp_f, None),
            "lower_temp_f": lower_temp_f,
            "upper_temp_f": None,
            "inclusive_lower": True,
            "inclusive_upper": False,
            "representative_temp_f": lower_temp_f + 2.0,
            "question": question,
        }
    raise ValueError(f"Unsupported question format: {question}")


def _extract_questions_from_event(event_html, city_display):
    raw_questions = re.findall(r"\"question\":\"([^\"]+)\"", event_html)
    prefix = f"Will the highest temperature in {city_display}"
    ordered = []
    seen = set()
    for question in raw_questions:
        if not question.startswith(prefix):
            continue
        normalized = unescape(question)
        if normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    if not ordered:
        raise RuntimeError(f"No weather questions found for {city_display}")
    return ordered


def fetch_polymarket_snapshot(city="nyc", target_date=None):
    city_display = CITY_DISPLAY_NAMES.get(city, city.upper())
    chosen_date, slug = _choose_slug(city, target_date=target_date)
    event_url = POLYMARKET_EVENT_URL.format(slug=slug)
    event_html = _request_text(event_url)
    questions = _extract_questions_from_event(event_html, city_display)
    bins = [_parse_bin_from_question(question) for question in questions]
    snapshot = {
        "venue": "polymarket",
        "city": city,
        "city_display": city_display,
        "market_type": "daily_high_temperature_partition",
        "market_date": chosen_date.isoformat(),
        "resolution_source": "Open-Meteo daily max temperature proxy for overnight research",
        "source_url": event_url,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "event_slug": slug,
        "bins": bins,
    }
    return snapshot


def load_snapshot(path=MARKET_SNAPSHOT_PATH):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_snapshot(snapshot, path=MARKET_SNAPSHOT_PATH):
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(snapshot, handle, indent=2, sort_keys=True)
        handle.write("\n")


def load_manual_snapshot(path=None):
    snapshot_path = Path(path) if path else MANUAL_MARKET_SNAPSHOT_PATH
    return load_snapshot(snapshot_path)


def build_snapshot(venue="polymarket", city="nyc", target_date=None, manual_snapshot_path=None):
    if venue == "polymarket":
        return fetch_polymarket_snapshot(city=city, target_date=target_date)
    if venue == "kalshi":
        return load_manual_snapshot(path=manual_snapshot_path)
    raise ValueError(f"Unsupported venue: {venue}")


def find_bin_index(bins, temperature_f):
    for index, bin_def in enumerate(bins):
        lower_temp_f = bin_def["lower_temp_f"]
        upper_temp_f = bin_def["upper_temp_f"]
        lower_ok = True if lower_temp_f is None else temperature_f >= lower_temp_f
        upper_ok = True if upper_temp_f is None else temperature_f <= upper_temp_f
        if lower_ok and upper_ok:
            return index
    return None
