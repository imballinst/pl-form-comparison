# pl-form-comparison

Premier League form comparison tool with match results data. Credit to https://x.com/DrRitzyy who started it in the first place.

## How to use

1. Select the team (only Premier League teams from 2025 that are available for selection).
2. Select the year to be the "anchor". By default, this is set to 2025. Limits to past 2 seasons (for now).
3. Select the year to be the "comparison". Limits to past 2 seasons (for now).

## Columns explanation

| Column name     | Description                                                                        |
| --------------- | ---------------------------------------------------------------------------------- |
| GW              | Game week, 1-38                                                                    |
| Opponent        | The opposing team from the currently selected team from the controls               |
| Venue           | Whether it's a home or an away game from the currently selected team's perspective |
| Compared season | The score for the same fixture in the compared season                              |
| Anchor season   | The score for the same fixture in the anchor season                                |
| +/-             | The points difference between the anchor and the compared fixture                  |
| Agg             | The accummulated points difference between the anchor and the compared fixtures    |
