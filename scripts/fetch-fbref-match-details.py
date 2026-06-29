import json
import os
import re
from os.path import dirname, join
from sys import exit as sysexit

from bs4 import BeautifulSoup

from utils import YEAR, maybe_get_chrome_path

SCHEDULE_PATH = join(dirname(__file__), "references", f"{YEAR}-fbref-schedule.json")
OUTPUT_PATH = join(dirname(__file__), "references", f"{YEAR}-fbref-match-details.json")


def parse_officials(soup: BeautifulSoup) -> list[dict]:
    scorebox_meta = soup.select_one(".scorebox_meta")
    if not scorebox_meta:
        return []

    for div in scorebox_meta.select("div"):
        text = div.get_text(strip=True)
        if "Officials" in text:
            spans = div.select("span")
            officials: list[dict] = []
            for span in spans:
                span_text = span.get_text(strip=True)
                m = re.match(r"^(.+?)\s*\((.+?)\)$", span_text)
                if m:
                    officials.append({"name": m.group(1).strip(), "role": m.group(2).strip()})
                else:
                    parts = re.split(r"\s*·\s*", span_text)
                    for part in parts:
                        m = re.match(r"^(.+?)\s*\((.+?)\)$", part)
                        if m:
                            officials.append({"name": m.group(1).strip(), "role": m.group(2).strip()})
            return officials
    return []


def parse_cards(soup: BeautifulSoup) -> dict:
    team_stats = soup.select_one("#team_stats")
    if not team_stats:
        return {"homeYellow": 0, "homeRed": 0, "awayYellow": 0, "awayRed": 0}

    cards_row = None
    for row in team_stats.select("tr"):
        th = row.select_one("th")
        if th and th.get_text(strip=True) == "Cards":
            cards_row = row.find_next_sibling("tr")
            break

    if not cards_row:
        return {"homeYellow": 0, "homeRed": 0, "awayYellow": 0, "awayRed": 0}

    tds = cards_row.select("td")
    if len(tds) < 2:
        return {"homeYellow": 0, "homeRed": 0, "awayYellow": 0, "awayRed": 0}

    home_cards_div = tds[0]
    away_cards_div = tds[1]

    home_yellow = len(home_cards_div.select(".yellow_card"))
    home_red = len(home_cards_div.select(".red_card, .yellow_red_card"))
    away_yellow = len(away_cards_div.select(".yellow_card"))
    away_red = len(away_cards_div.select(".red_card, .yellow_red_card"))

    return {"homeYellow": home_yellow, "homeRed": home_red, "awayYellow": away_yellow, "awayRed": away_red}


def parse_extra_stats(soup: BeautifulSoup) -> dict:
    extra_stats_div = soup.select_one("#team_stats_extra")
    if not extra_stats_div:
        return {"fouls": {"home": 0, "away": 0}, "corners": {"home": 0, "away": 0}, "offsides": {"home": 0, "away": 0}}

    result = {"fouls": {"home": 0, "away": 0}, "corners": {"home": 0, "away": 0}, "offsides": {"home": 0, "away": 0}}

    group_containers = list(extra_stats_div.children)
    for container in group_containers:
        if not hasattr(container, "select"):
            continue
        divs = container.select("div")
        if len(divs) < 3:
            continue

        is_header = "th" in divs[0].get("class", []) and len(divs) > 2 and "th" in divs[2].get("class", [])
        if is_header:
            continue

        home_val = divs[0].get_text(strip=True)
        label = divs[1].get_text(strip=True)
        away_val = divs[2].get_text(strip=True)

        try:
            home_num = int(home_val)
        except ValueError:
            home_num = 0
        try:
            away_num = int(away_val)
        except ValueError:
            away_num = 0

        if label == "Fouls":
            result["fouls"] = {"home": home_num, "away": away_num}
        elif label == "Corners":
            result["corners"] = {"home": home_num, "away": away_num}
        elif label == "Offsides":
            result["offsides"] = {"home": home_num, "away": away_num}

    return result


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

    print(f"Reading schedule from {SCHEDULE_PATH}...")
    with open(SCHEDULE_PATH) as f:
        schedule = json.load(f)

    matches = [m for m in schedule if m.get("score") is not None]

    print(f"Processing {len(matches)} finished matches for {YEAR}...")

    details: dict[str, dict] = {}

    for i, match in enumerate(matches):
        match_url = match.get("matchReportUrl")
        if not match_url:
            print(f"  Skipping match {i + 1}/{len(matches)} (no URL): {match['home']} vs {match['away']}")
            continue

        print(f"  Match {i + 1}/{len(matches)}: {match['home']} vs {match['away']}")
        try:
            page = fbref.get(match_url).read().decode("utf-8")
            soup = BeautifulSoup(page, "html.parser")

            officials = parse_officials(soup)
            cards = parse_cards(soup)
            extra_stats = parse_extra_stats(soup)

            match_key = f"{match['datetime'][:10]}_{match['home']}_{match['away']}"
            details[match_key] = {
                "officials": officials,
                "cards": cards,
                "extraStats": extra_stats,
            }
        except Exception as err:
            print(f"  Error fetching match details: {err}")

    with open(OUTPUT_PATH, "w") as f:
        json.dump(details, f, indent=2, ensure_ascii=False)

    print(f"Saved {OUTPUT_PATH} with {len(details)} match details")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Fatal error:", error)
        sysexit(1)
