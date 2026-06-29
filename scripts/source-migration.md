- Migrate from Premier League to Understat + FBref
  -- Understat: all stats https://understat.com/getLeagueData/EPL/2025. Source see [Understat](./references/understat.json)
  -- FBref: only take the officials

- FBref: URL is https://fbref.com/en/comps/9/2024-2025/schedule/2024-2025-Premier-League-Scores-and-Fixtures.
  -- Max 10 requests per second.
  -- Expected response is like [reference](./references/fbref-pl-season-matches.html)
  -- This data is "static", so it only needs to be fetched once, I believe.

- For automation:
  -- Use the current season's fixtures to "scrape" the "today's matches". A match day at max contains 10 matches, so 10 requests still fit.
  -- If there are fixture readjustments, then it will be done manually.
