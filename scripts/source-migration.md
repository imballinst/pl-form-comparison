- Migrate from Premier League to Understat + FBref
  -- Understat: all stats https://understat.com/getLeagueData/EPL/2025. Source see [Understat](./references/understat.json)
  -- FBref: only take the officials

- FBref: URL is https://fbref.com/en/comps/9/2024-2025/schedule/2024-2025-Premier-League-Scores-and-Fixtures.
  -- Max 10 requests per minute (not per second).
  -- Expected response is like [reference](./references/fbref-pl-season-matches.html)
  -- This data is "static", so it only needs to be fetched once, I believe.

- For automation:
  -- Use the current season's fixtures to "scrape" the "today's matches". A match day at max contains 10 matches, so 10 requests still fit.
  -- If there are fixture readjustments, then it will be done manually.

## Answers

### 1. Where should the primary match fixture data come from?

--> No, the understat is primary data. FBref will only be used for the match officials only.

### 2. How to generate match IDs and team identity fields?

--> No, we don't "match" by match ID since it's cross dataset. We should match by the team who's playing home and away.

### 3. FBref schedule page only has the main Referee

--> Yes, we should scrape individual match pages.

### 4. Past seasons (2023, 2024) data availability

--> Yes. Understat's 2024 stands for https://fbref.com/en/comps/9/2024-2025/schedule/2024-2025-Premier-League-Scores-and-Fixtures, and Understat's 2025 stands for https://fbref.com/en/comps/9/2025-2026/schedule/2025-2026-Premier-League-Scores-and-Fixtures.

### 5. Handling stats not available from Understat

--> Actually, we should also get corners, fouls, offside from FBref, including the yellow card/red card we should also get from the `class="yellow_card"` and presumably `class="red_card"`.

### 6. Understat lacks matchweek structure

--> Good point, then we actually should be combining FBref and Understat instead of one acting as "primary" and other "secondary".

### 7. Proposed new script pipeline

--> Looks about right, but also incorporate my answers above.

---

## Detailed Migration Plan

### Season identifier mapping

| Project year | Understat URL                                  | FBref season path |
| ------------ | ---------------------------------------------- | ----------------- |
| `2023`       | `https://understat.com/getLeagueData/EPL/2023` | `2023-2024`       |
| `2024`       | `https://understat.com/getLeagueData/EPL/2024` | `2024-2025`       |
| `2025`       | `https://understat.com/getLeagueData/EPL/2025` | `2025-2026`       |

FBref schedule URL pattern: `https://fbref.com/en/comps/9/{START}-{END}/schedule/{START}-{END}-Premier-League-Scores-and-Fixtures`

### Understat API structure

The Understat endpoint (`/getLeagueData/EPL/{YEAR}`) returns a JSON with three top-level keys:

- **`dates`** (array of 380 match objects) — match-level data including both teams, scores, datetime, match `id`, `isResult` flag. This is the primary source for match fixtures.
- **`teams`** (keyed by team ID) — per-team match history with advanced stats (xG, xGA, npxG, npxGA, ppda, deep, scored, missed, xpts, result). Does NOT include opponent information.
- **`players`** (array of player stats) — not needed for this migration.

Each `dates[]` entry has:

```json
{
  "id": "28778",
  "isResult": true,
  "h": { "id": "87", "title": "Liverpool", "short_title": "LIV" },
  "a": { "id": "73", "title": "Bournemouth", "short_title": "BOU" },
  "goals": { "h": "4", "a": "2" },
  "xG": { "h": "2.33007", "a": "1.57303" },
  "datetime": "2025-08-15 19:00:00",
  "forecast": { "w": "0.5498", "d": "0.2276", "l": "0.2226" }
}
```

Each `teams[].history[]` entry has (for a given team):

```json
{
  "h_a": "h",
  "xG": 0.318601,
  "xGA": 1.40098,
  "npxG": 0.318601,
  "npxGA": 1.40098,
  "ppda": { "att": 227, "def": 12 },
  "ppda_allowed": { "att": 146, "def": 24 },
  "deep": 2,
  "deep_allowed": 6,
  "scored": 0,
  "missed": 0,
  "xpts": 0.4258,
  "result": "d",
  "date": "2025-08-16 11:30:00",
  "wins": 0,
  "draws": 1,
  "loses": 0,
  "pts": 1,
  "npxGD": -1.082379
}
```

**Key insight:** Understat's `dates` already provides match-level data with both home/away teams identified. This can directly produce `{season}.json`.

### Team name normalization

Understat team `title` values differ from the app's `TEAMS_PER_SEASON` constants in 4 cases:

| Understat title | Understat short_title | App constant name            |
| --------------- | --------------------- | ---------------------------- |
| `"Tottenham"`   | `"TOT"`               | `"Tottenham Hotspur"`        |
| `"West Ham"`    | `"WHU"`               | `"West Ham United"`          |
| `"Brighton"`    | `"BRI"`               | `"Brighton and Hove Albion"` |
| `"Leeds"`       | `"LED"`               | `"Leeds United"`             |

All other team names match directly.

**Action:** Create a static name mapping file `scripts/team-name-map.json` with:

```json
{
  "Tottenham": "Tottenham Hotspur",
  "West Ham": "West Ham United",
  "Brighton": "Brighton and Hove Albion",
  "Leeds": "Leeds United"
}
```

And also include `short_title` → `abbr` pairing and `title` → `shortName` mapping for the output.

### New script pipeline

```
Step 1: fetch-understat.mjs (NEW)
  ├─ GET https://understat.com/getLeagueData/EPL/{YEAR}
  ├─ Saves raw JSON to scripts/references/{YEAR}-understat-raw.json
  └─ Also saves scripts/references/{YEAR}-understat-team-history.json (teams section only, keyed by team name)

Step 2: fetch-fbref-schedule.mjs (NEW)
  ├─ GET https://fbref.com/en/comps/9/{START}-{END}/schedule/{START}-{END}-Premier-League-Scores-and-Fixtures
  ├─ Parse HTML table into match list with: matchweek, date, home, away, score, attendance, venue, referee, match report URL
  ├─ Rate-limited (max 10 req/s)
  └─ Saves raw parsed data to scripts/references/{YEAR}-fbref-schedule.json

Step 3: fetch-fbref-match-details.mjs (NEW)
  ├─ Reads match report URLs from Step 2
  ├─ For each finished match, GET the individual FBref match page
  ├─ Extract: full officiating crew (Referee, Assistants, VAR, Assistant VAR), additional stats (corners, fouls, offside, yellow cards, red cards)
  ├─ Rate-limited (max 10 req/s, with delay)
  └─ Saves to scripts/references/{YEAR}-fbref-match-details.json (keyed by match date + teams)

Step 4: merge-migration.mjs (NEW — replaces fetch-matches.mjs + enhance-match-official-with-stats.mjs)
  ├─ Reads: understat raw data, fbref schedule, fbref match details
  ├─ Cross-references by: date + home team name + away team name
  ├─ Produces:
  │   ├─ public/pl-form-comparison/{YEAR}.json (matchweeks with matches)
  │   └─ public/pl-form-comparison/{YEAR}-stats.json (team stats + officials)
  └─ This is the core merge step

Step 5: derive-table.mjs (MODIFIED — reads from {YEAR}.json same as before)
  └─ public/pl-form-comparison/{YEAR}-table.json
```

### Cross-referencing strategy

Since both Understat and FBref don't share a common match ID, join by:

- **Match date** (compare date portion of `kickoff`/`datetime`)
- **Home team name** (normalized via team-name-map.json)
- **Away team name** (normalized)

The merge in `merge-migration.mjs` works as follows:

```
For each match in Understat.dates[]:
  match = {
    matchId: Understat.dates[].id,                // e.g. "28778"
    kickoff: Understat.dates[].datetime,
    homeTeam: {
      name: normalize(h.title),                    // normalize via team-name-map.json
      id: h.id,                                    // Understat team ID
      shortName: h.short_title,                    // e.g. "LIV"
      abbr: h.short_title,                         // e.g. "LIV"
      score: int(goals.h),
      halfTimeScore: null,                          // not available from Understat
      redCards: null,                               // from FBref match details
    },
    awayTeam: { ... same pattern ... },
    period: isResult ? "FullTime" : "scheduled",
    competition: "Premier League",
    competitionId: "8",
    matchWeek: fbref_schedule[].matchweek,         // from FBref schedule
    ground: fbref_schedule[].venue,                // from FBref schedule
    attendance: fbref_schedule[].attendance,        // from FBref schedule
    referee: fbref_schedule[].referee,             // main referee from FBref schedule
  }

  Also create stats record by merging:
  - Understat team history stats (xG, xGA, npxG, npxGA, ppda, deep, xpts)
  - FBref match details stats (corners, fouls, offside, yellow cards, red cards)
  - FBref match details officials (all roles)
```

### Data model changes

**`MatchInfo` type** — Populate from Understat `dates[]` + FBref schedule. Understat's `short_title` (e.g. "LIV") serves as both `shortName` and `abbr`. HalfTimeScore and redCards won't be available from Understat; set to `null` / `0` and populate from FBref match details when available.

**`MatchFullStatData`** — The following fields are populated:
| Field | Source |
|---|---|
| `goals` | Understat `dates[].goals.h/a` |
| `goalsConceded` | Understat `dates[].goals.a/h` (opposite side) |
| `expectedGoals` | Understat `teams[].history[].xG` |
| `wonCorners` | FBref match details (`#team_stats_extra` Corners) |
| `fkFoulLost` | FBref match details (`#team_stats_extra` Fouls) |
| `totalOffside` | FBref match details (`#team_stats_extra` Offsides) |
| `totalYelCard` | FBref match details (`yellow_card` spans count) |
| `totalRedCard` | FBref match details (`red_card` spans count) |

**Dropped fields:** `duelWon`, `totalDistance`, `penaltyConceded` — not available from Understat or FBref.

### FBref individual match page — data extraction

For each finished match, the individual FBref match page at `/en/matches/{hash}/{slug}` contains (see [reference](./references/fbref-pl-match-page.html)):

1. **Scorebox** — attendance, venue, referee (already in schedule page). Officials listed as `<span>Name (Role)</span>` separated by `·` with roles: Referee, AR1, AR2, 4th, VAR.
2. **`#team_stats`** — possession, shots on target, saves, cards (`yellow_card`/`red_card`/`yellow_red_card` spans in a `.cards` div).
3. **`#team_stats_extra`** — Fouls, Corners, Crosses, Interceptions, Offsides as `<div>` pairs per team.
4. **Events** (`.event` divs) — goal and card events including `yellow_red_card` class (second yellow = red).
5. **Half-time scores** — not directly available in a dedicated element, but the player stats table `tfoot` sums player stats for team totals.

### Automation / "today's matches" strategy

- Understat's `dates[].isResult` flag distinguishes played vs scheduled matches.
- FBref's schedule page always has the full season.
- For daily updates:
  1. Re-fetch Understat → update `{year}.json` (can replay whole season since Understat is static-ish for past matches)
  2. For "today's matches" that now show `isResult: true`, fetch FBref individual match pages for officials + extra stats
  3. Re-run `merge-migration.mjs` → regenerate output files
- Since Understat data changes rarely (only when new matches finish), fetching the full season each time is acceptable (380 matches, small JSON).

### Season backward compatibility

Re-fetch all 3 seasons (2023, 2024, 2025) from Understat + FBref to replace existing PulseLive data.

### Match timezone handling

Understat's `datetime` is UK local time (BST/GMT). FBref schedule page also uses local time. Store as-is in UK local time, use date-fns with timezone to convert to GMT as needed.

### Half-time scores and red cards

Half-time scores and red cards per team are available on FBref individual match pages (see the events section with `yellow_red_card` class). Populate from FBref match details when available; leave as `null`/`0` when not.

---
