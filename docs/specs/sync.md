# Sync

Currently, the sync has to be done rather manually. This is a chore. Ideally, every day, 5AM ICT (that is usually the time where Premier League ends), there is a GitHub Actions that will check if there is a match played in the past few days or not. If yes, then sync, otherwise don't.

## Script logic

- The script scans the 2025.json file and looks for those with "PreMatch" match period
- Collect those matches in a JSON file (but outside of public folder because we don't need it in the app)
- The JSON file format is something like this:

```json
{
  "2026-01-09T00:00:00Z": [23],
  "2026-01-16T00:00:00Z": [24]
}
```

- The number in the JSON above represents matchweek. The above means, in that date, there are matchweek 23 playing.
- This JSON is updated whenever we do sync. So, it may be possible that a key that previously existed, doesn't exist anymore after the sync process is done.
- Matchweek fetching logic is changed from range into possible "jumps". For example, previously we do 25-30 (25, 26, 27, 28, 29, 30), now we can do 25, 26, 28, 30. Basically allow single matchweek fetch only in the function, but the parent caller will call it multiple times possibly.

## GitHub Actions

- A GitHub Action runs every day, 5AM ICT using ubuntu-latest
- It first checks if there is a key that indicates a time before current.
  - If there are datetimes before current, then fetch those matchweeks
  - Fetch the matchweeks based on the new logic.

## Open Questions

1. **JSON file location**: Where exactly should the intermediate JSON file (with matchweek dates) be stored? A specific folder like `scripts/` or a new `data/` folder?
   1.1. Let's put it in `scripts/resources` folder.

1. **Initial JSON creation**: Does the script create the JSON file if it doesn't exist, or should it be pre-seeded manually?
   1.1. Create if it doesn't exist.

1. **Multiple matchweeks on same date**: The format shows an array per date (e.g., `[23]`). Can there be multiple matchweeks on the same date (e.g., `[23, 24]` for rescheduled matches)?
   1.1. Yes.

1. **Fetch script changes**: Does the matchweek fetching logic change require modifications to the existing `fetch-matches.mjs`, or is this a new separate script?
   1.1. Yes, it requires modification.

1. **Post-sync actions**: After fetching, should the GitHub Action automatically commit and push the updated `2025.json` and the intermediate JSON file?
   1.1. Yes.

1. **Error handling**: What should happen if a fetch fails? Retry logic? Fail the workflow? Continue with other matchweeks?
   1.1. Fail the workflow.

1. **Timezone handling**: The spec mentions "5AM ICT" but JSON uses UTC. Should the comparison logic account for timezone conversion, or assume all comparisons are in UTC?
   1.1. 5 AM ICT equals to around 10PM, but let's just make it 11PM UTC just to be safe.

1. **Notification**: Should there be any notification (e.g., GitHub issue, Slack) when a sync occurs or fails?
   1.1. No, it's already provided on GitHub by default.
