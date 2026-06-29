# Scripts

Pipeline for fetching, merging, and deriving Premier League form comparison data.

## Execution Order

| Step | Script                         | Command                                        |
| ---- | ------------------------------ | ---------------------------------------------- |
| 1    | `fetch-understat.ts`           | `tsx scripts/fetch-understat.ts`               |
| 2    | `fetch-fbref-schedule.py`      | `python3 scripts/fetch-fbref-schedule.py`      |
| 3    | `fetch-fbref-match-details.py` | `python3 scripts/fetch-fbref-match-details.py` |
| 4    | `merge-migration.ts`           | `tsx scripts/merge-migration.ts`               |
| 5    | `derive-table.ts`              | `tsx scripts/derive-table.ts`                  |

Steps 1 and 2 are independent and can run in parallel. Step 3 depends on step 2 (reads the schedule output). Step 4 merges all three reference files from steps 1–3. Step 5 depends on step 4 (reads the merged season file).

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
