# Home-Away Cross Table

The Home-Away Cross Table is a feature in this repository with this requirements.

1. It is listed in the "Tools" dropdown.
2. The table has a size of 20x20 cells. Columns represent away teams whereas rows represent home teams.
3. Cell that come from the same team (the diagonals) will have the cell blocked.
4. Result cells (use existing colors from the `getScoreResult` function)
   4.1. If home team wins, the cell color is green.
   4.2. If home team loses, the cell color is red.
   4.3. If home team draws, the cell color is gray.
   4.4. If doesn't meet yet, the cell color is transparent and show "-" as the score.
5. The pathname is `/cross-table`.

## Clarifications / Open Questions

- Season scope: Should the cross table show only the `CURRENT_SEASON`, or allow selecting a season (e.g., 2023/2024/2025) similar to other views? If selectable, what is the default and control placement?
  - Current season only.
- Team ordering: What ordering should rows/columns use — alphabetical, `TEAMS_PER_SEASON[season]` order, or current league table? If alphabetical, confirm case/spacing rules for consistency.
  - Alphabetical.
- Cell content: Should each non-diagonal cell display the score text (e.g., `2-1`) in addition to background color? Any preference for font (monospace) or including extra info like half-time score or red cards?
  - Full time score only + background. Font monospace, no other infos required.
- Unplayed fixture definition: For "doesn't meet yet", should we treat any `period` not equal to `FullTime` as unplayed? Do postponed or abandoned matches get a distinct marker, or all show `-` with transparent background?
  - Yes, treat all period not equal to `FullTime` as unplayed.
  - Postponed/abandoned matches get the same treatment.
- Color mapping: Confirm using `getScoreResult` classes exactly (`bg-green-400`, `bg-red-400`, `bg-gray-400`). For unplayed, should we use `bg-transparent` or no background class at all?
  - No background at all.
- Diagonal cells: How should blocked diagonals render — a specific symbol (e.g., `—`), tooltip, or fully disabled/blank? Any color or border conventions?
  - Use black color #000.
- Navigation label: In the "Tools" dropdown, what exact label and description should we use for this feature (e.g., "Home-Away Cross Table" with a one-line description)?
  - "Home-Away" Cross Table with a description "Compare all home and away matches from every team in the current season."
- Layout details: Do we want sticky row/column headers for better scrolling on desktop/mobile? Any minimum cell size or responsive behavior requirements?
  - Yes, use sticky row/column.
  - Minimum cell size should be 50px or any value equal to 5 characters of monospace text + a bit of padding (e.g. 2px).
- Team names: Use full club names everywhere, or abbreviations for headers to keep the grid compact (e.g., `abbr` from data)? If abbreviations, should full names appear on hover via tooltip?
  - Use abbreviations. No tooltip necessary.
- Data source: Confirm the table pulls from `/pl-form-comparison/{year}.json` and filters by Premier League matches only. Any need to handle teams not present in a given season?
  - No.
- Interactions: Should clicking a cell navigate to a match detail page or external source, or is the table purely informational and non-interactive?
  - No.
- Routing/base path: Path is `/cross-table` under the existing base `/pl-form-comparison/`. Confirm this is the desired URL and prerendering behavior.
  - The path should be `/compare/cross-table` since it's a comparison.
