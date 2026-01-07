## Add Opposition Strength / Difficulty Rating to Remaining Matches

Add a "Fixture Difficulty Rating" (FDR) system to the Remaining Matches page, using league table position to rank opponent strength and display average difficulty over configurable match ranges (next 5, 10, or all remaining).

### Steps

- Create a new spec file remaining-matches-difficulty.md documenting the feature requirements, FDR calculation formula, color scale, and UI components.
- Extend seasons-fetcher.ts to always load the current season's table data alongside match data in clientLoader.
- Add a getDifficultyRating utility function that maps opponent league position (1-20) to an FDR score (1-5), adjusting for home/away venue.
- Update RemainingMatchesTable in compare.remaining-matches.tsx to display an FDR badge per fixture and a summary row showing average difficulty.
- Add a toggle/dropdown UI to filter the difficulty calculation window (next 5 / next 10 / all remaining matches).
