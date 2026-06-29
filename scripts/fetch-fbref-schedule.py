"""
Fetch FBref schedule using soccerdata (bypasses Cloudflare via undetected-chromedriver).

Requires Chrome/Chromium installed. Set path via env var SOCCERDATA_BROWSER
or the script auto-detects Playwright's bundled Chrome.
"""

from json import dumps
from os.path import dirname, join
from sys import exit as sysexit

from utils import YEAR, resolve_datetime, maybe_get_chrome_path

SCORE_DELIMITER = "\u2013"
OUTPUT_PATH = join(dirname(__file__), "references", f"{YEAR}-fbref-schedule.json")


def parse_score(score_str: str):
    if not score_str or score_str == SCORE_DELIMITER:
        return None
    parts = score_str.split(SCORE_DELIMITER)
    if len(parts) != 2:
        return None
    try:
        return {"home": int(parts[0]), "away": int(parts[1])}
    except ValueError:
        return None


def main():
    from soccerdata import FBref

    chrome_path = maybe_get_chrome_path()
    if not chrome_path:
        print(
            "Chrome not found. Install Chrome or set SOCCERDATA_BROWSER env var "
            "pointing to your Chrome/Chromium binary."
        )
        sysexit(1)

    print(f"Using Chrome: {chrome_path}")

    fbref = FBref(
        leagues="ENG-Premier League",
        seasons=YEAR,
        path_to_browser=chrome_path,
        headless=True,
    )

    print(f"Fetching FBref schedule for {YEAR}...")
    df = fbref.read_schedule()

    matches = []
    for _, row in df.iterrows():
        score_raw = row.get("score") or ""
        score = parse_score(score_raw)

        attendance = row.get("attendance")
        if attendance is not None and attendance != attendance:
            attendance = None
        if attendance is not None:
            try:
                attendance = int(attendance)
            except (TypeError, ValueError):
                attendance = None

        match_report_url = row.get("match_report")
        if match_report_url and not match_report_url.startswith("http"):
            match_report_url = "https://fbref.com" + match_report_url

        date_val = row.get("date")
        if hasattr(date_val, "strftime"):
            date_val = date_val.strftime("%Y-%m-%d")

        time_str = row.get("time") or ""
        matches.append({
            "matchweek": int(row["week"]),
            "datetime": resolve_datetime(date_val, time_str),
            "home": row["home_team"],
            "away": row["away_team"],
            "score": score,
            "attendance": attendance,
            "venue": row.get("venue") or "",
            "referee": row.get("referee") or None,
            "matchReportUrl": match_report_url,
        })

    print(f"  Parsed {len(matches)} matches for {YEAR}")

    with open(OUTPUT_PATH, "w") as f:
        f.write(dumps(matches, indent=2, ensure_ascii=False))

    print(f"Saved {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Fatal error:", error)
        sysexit(1)
