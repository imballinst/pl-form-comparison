# pl-form-comparison

Premier League form comparison tool with match results data.

## Data Files

- `matches-2024-2025.json` - Match results for the 2024/2025 season (matchdays 1-14)

## Scripts

### fetch-matches.py

A Python script to fetch Premier League match results directly from the official Premier League API.

**Usage:**

```bash
# Fetch matchweek 15 (default)
python3 fetch-matches.py

# Fetch specific matchweek
python3 fetch-matches.py --matchweek 10

# Fetch all matchweeks (1-38)
python3 fetch-matches.py --all

# Save to file
python3 fetch-matches.py --matchweek 15 --output matchweek-15.json

# Fetch all and save
python3 fetch-matches.py --all --output all-matches.json
```

**API Endpoint:**

The script fetches data from:
```
https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2024&matchweek={week}&_limit=100
```

**Note:** The API endpoint may be blocked in some network environments. If you encounter connectivity issues, try running the script from a different network.