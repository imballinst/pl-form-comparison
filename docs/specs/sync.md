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
