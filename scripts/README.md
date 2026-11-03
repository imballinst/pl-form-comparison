# Scripts

Pipeline for fetching, merging, and deriving Premier League form comparison data.

## Prerequisites

### TypeScript scripts (1, 4, 5)

```bash
yarn install
```

### Python scripts (2, 3)

Requires Python 3.10+ (uses `str | None` etc.).

```bash
pip install soccerdata beautifulsoup4 playwright
playwright install chromium --with-deps
```

The Python scripts auto-detect the Playwright-bundled Chromium via `maybe_get_chrome_path()` in `utils.py`. You can also set `SOCCERDATA_BROWSER` to an explicit browser path.

## Execution Order

| Step | Script                         | Command                                        |
| ---- | ------------------------------ | ---------------------------------------------- |
| 1    | `fetch-understat.ts`           | `tsx scripts/fetch-understat.ts`               |
| 1b   | `fetch-understat-backfill.ts`  | `tsx scripts/fetch-understat-backfill.ts`      |
| 2    | `fetch-fbref-schedule.py`      | `python3 scripts/fetch-fbref-schedule.py`      |
| 3    | `fetch-fbref-match-details.py` | `python3 scripts/fetch-fbref-match-details.py` |
| 4    | `merge-migration.ts`           | `tsx scripts/merge-migration.ts`               |
| 5    | `derive-table.ts`              | `tsx scripts/derive-table.ts`                  |

Steps 1 and 2 are independent and can run in parallel. Step 3 depends on step 2 (reads the schedule output). Step 4 merges all three reference files from steps 1–3. Step 5 depends on step 4 (reads the merged season file).

`fetch-understat-backfill.ts` (1b) is a fallback for when Understat is unavailable: it merges the FBref schedule (step 2) directly into `references/{YEAR}-understat-raw.json` in the Understat shape. Only matches not yet recorded by Understat are touched; results already present there (with real Understat xG) are kept. By default the backfill resumes strictly after the last result Understat recorded; set `UNDERSTAT_BACKFILL_SINCE=YYYY-MM-DD` (inclusive) to control the cutoff explicitly. Run `yarn stat:update:understat:backfill` to chain steps 2, 1b, 4, 5, leaving the rest of the pipeline unchanged. Because FBref no longer carries xG (its Opta license ended in January 2026), backfilled matches get `expectedGoals: 0` — a field the app never displays. When Understat returns, `stat:update:understat` re-fetches the full league data and overwrites the raw file wholesale, so no cleanup is needed.

## Data Flow

```
fetch-understat.ts ──────────────┐
                                 │
fetch-fbref-schedule.py ───────┐ │
                               │ │
fetch-fbref-match-details.py ──┤ │
  (reads fbref-schedule.json)  │ │
                               ▼ ▼
                        merge-migration.ts
                          (merges all 3 inputs)
                               │
                               ├──> public/pl-form-comparison/{YEAR}.json
                               └──> public/pl-form-comparison/{YEAR}-stats.json
                                        │
                                        ▼
                                 derive-table.ts
                                   (reads {YEAR}.json)
                                        │
                                        ▼
                                 public/pl-form-comparison/{YEAR}-table.json
```

## Notes

- `utils.ts` and `utils.py` provide shared utilities for the TypeScript and Python scripts respectively.
- `types.ts` contains shared type definitions used by the TypeScript scripts.
- The `YEAR` constant is set in both `utils.ts` and `utils.py` (currently `2023`).
- Intermediate fetch outputs are stored in `references/` as JSON files.
- Final outputs are written to `public/pl-form-comparison/`.
- `fetch-fbref-match-details.py` caches the raw match HTML in soccerdata's data dir (`~/soccerdata/data/FBref/match_<game_id>.html`) and reuses it on later runs. Delete a file to force a re-fetch.
- The FBref Python scripts run with `SOCCERDATA_LOGLEVEL=DEBUG` so each URL fetch/cache hit is logged. Override the env var to change this.
