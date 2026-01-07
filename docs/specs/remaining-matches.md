## Add Opposition Strength / Difficulty Rating to Remaining Matches

Add a "Fixture Difficulty Rating" (FDR) system to the Remaining Matches page, using league table position to rank opponent strength and display average difficulty over configurable match ranges (next 5, 10, or all remaining).

### Steps

- Create a new spec file remaining-matches-difficulty.md documenting the feature requirements, FDR calculation formula, color scale, and UI components.
- Extend seasons-fetcher.ts to always load the current season's table data alongside match data in clientLoader.
- Add a getDifficultyRating utility function that maps opponent league position (1-20) to an FDR score (1-5), adjusting for home/away venue.
- Update RemainingMatchesTable in compare.remaining-matches.tsx to display an FDR badge per fixture and a summary row showing average difficulty.
- Add a toggle/dropdown UI to filter the difficulty calculation window (next 5 / next 10 / all remaining matches).

### Clarification Questions

Please answer or choose defaults for the following implementation details:

1. Data source

- Use current-season table only (`2025-table.json`) or require historical tables (`2024-table.json`, `2023-table.json`) for comparisons?
  - For the difficulty, use current season table only. The historical tables is only for past results.

2. Difficulty scale

- Prefer a tiered FDR (1–5) or continuous numeric score (e.g., 0–100)? (Recommend tiered for readability.)
  - Tiered FDR

3. Tier boundaries

- If tiered, confirm mapping. Suggested default:
  - FDR 5: positions 1–4
  - FDR 4: positions 5–8
  - FDR 3: positions 9–12
  - FDR 2: positions 13–16
  - FDR 1: positions 17–20
    Accept or adjust?
    - Adjust. FDR should not be based on positions but based on number of points. The closer the FDR is to leader, the bigger the FDR number is. The FDR should be based on distance between rank 1 and rank 20 league position.
    - Example test case, if rank 1 is on 48 points and rank 20 is on 7 points, then the distance is 41.
    - If a team has 35 points, then it's 35/41 \* 100% = 85% \* 5 = the FDR is 4.25

4. Home/away adjustment

- Apply a fixed penalty (e.g., +0.5 FDR for away) or a multiplier, or no adjustment? Accept default +0.5 for away?
  - Yes

5. Aggregation window

- UI should offer next 5, next 10, or all remaining matches. Should we also allow a custom N?
  - No, keep it granular per match against per oppoennt.

6. Missing opponents or promoted/relegated mapping

- How to handle opponents not found in `TEAMS_PER_SEASON` or equivalent-team mapping: (A) treat as neutral mid-tier, (B) attempt `getEquivalentTeamFromAnotherSeason`, (C) block and show `—`? Recommend A with a tooltip.
  - Use the current approach with (B) for results only in past seasons. Not relevant for current season.

7. Display locations

- Show per-fixture FDR badge in the table and a per-team average row/column. Confirm both.
  - Yes.

8. UI / colors

- Use green→red gradient for FDR 1→5. Any color preferences or WCAG contrast needs?
  - No, but use WCAG contrast.

9. Tooltip content

- What details should the fixture tooltip show? Suggested: opponent position, points, FDR calculation (position + home/away adjustment).
  - The tooltip should only be shown for past season results for opponent that has been relegated. No need for too many tooltips.

10. Data freshness & caching

- How often should table data refresh? (On page load only, or auto-refresh every X minutes?) Recommend page-load fetch; allow manual refresh button if wanted.
  - Page load fetch, using clientLoader like other patterns.

11. Sorting / export

- Should we allow sorting teams by average FDR, or exporting the difficulty summary (CSV)?
  - No.

12. Tests & edge cases

- Accept basic unit tests for `getDifficultyRating` plus an integration test for the average calculation?
  - Yes.

If you prefer, I can pick sensible defaults and implement the feature; tell me which of the above you want to change.
