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
                    name = m.group(1).strip().replace('\u00a0', ' ')
                    officials.append({"name": name, "role": m.group(2).strip()})
                else:
                    parts = re.split(r"\s*·\s*", span_text)
                    for part in parts:
                        m = re.match(r"^(.+?)\s*\((.+?)\)$", part)
                        if m:
                            name = m.group(1).strip().replace('\u00a0', ' ')
                            officials.append({"name": name, "role": m.group(2).strip()})
            return officials
    return []


def parse_cards(soup: BeautifulSoup) -> tuple[int, int, int, int]:
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

    return home_yellow, home_red, away_yellow, away_red


def parse_extra_stats(soup: BeautifulSoup) -> tuple[dict, dict]:
    empty = {"fouls": 0, "corners": 0, "offsides": 0}

    extra_stats_div = soup.select_one("#team_stats_extra")
    if not extra_stats_div:
        return empty, empty

    home = {"fouls": 0, "corners": 0, "offsides": 0}
    away = {"fouls": 0, "corners": 0, "offsides": 0}

    group_containers = list(extra_stats_div.children)
    for container in group_containers:
        if not hasattr(container, "select"):
            continue
        divs = container.select("div")
        if len(divs) < 6:
            continue

        is_header = "th" in divs[0].get("class", []) and "th" in divs[2].get("class", [])
        if not is_header:
            continue

        for i in range(3, len(divs), 3):
            if i + 2 >= len(divs):
                break
            home_val = divs[i].get_text(strip=True)
            label = divs[i + 1].get_text(strip=True)
            away_val = divs[i + 2].get_text(strip=True)

            try:
                home_num = int(home_val)
            except ValueError:
                home_num = 0
            try:
                away_num = int(away_val)
            except ValueError:
                away_num = 0

            if label == "Fouls":
                home["fouls"] = home_num
                away["fouls"] = away_num
            elif label == "Corners":
                home["corners"] = home_num
                away["corners"] = away_num
            elif label == "Offsides":
                home["offsides"] = home_num
                away["offsides"] = away_num

    return home, away


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
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH) as f:
            details = json.load(f)
        print(f"Loaded {len(details)} existing match details from {OUTPUT_PATH}")

    for i, match in enumerate(matches):
        match_url = match.get("matchReportUrl")
        if not match_url:
            print(f"  Skipping match {i + 1}/{len(matches)} (no URL): {match['home']} vs {match['away']}")
            continue

        match_key = f"{match['datetime'][:10]}_{match['home']}_{match['away']}"
        if match_key in details:
            print(f"  Match {i + 1}/{len(matches)}: {match['home']} vs {match['away']} — already exists, skipping")
            continue

        print(f"  Match {i + 1}/{len(matches)}: {match['home']} vs {match['away']}")
        try:
            page = fbref.get(match_url).read().decode("utf-8")
            soup = BeautifulSoup(page, "html.parser")

            officials = parse_officials(soup)
            home_yellow, home_red, away_yellow, away_red = parse_cards(soup)
            home_extra, away_extra = parse_extra_stats(soup)

            details[match_key] = {
                "officials": officials,
                "home": {
                    "yellowCards": home_yellow,
                    "redCards": home_red,
                    **home_extra,
                },
                "away": {
                    "yellowCards": away_yellow,
                    "redCards": away_red,
                    **away_extra,
                },
            }
        except Exception as err:
            print(f"  Error fetching match details: {err}")

        break

    with open(OUTPUT_PATH, "w") as f:
        json.dump(details, f, indent=2, ensure_ascii=False)

    print(f"Saved {OUTPUT_PATH} with {len(details)} match details")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Fatal error:", error)
        sysexit(1)
