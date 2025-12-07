# pl-form-comparison

Premier League form comparison tool with match results data.

## Setup

Install dependencies:

```bash
npm install
```

## Scripts

### fetch-matches.js

A JavaScript/Node.js script to fetch Premier League match results directly from the official Premier League API.

**Usage:**

```bash
# Fetch matchweek 15 (default)
node scripts/fetch-matches.js

# Fetch specific matchweek
node scripts/fetch-matches.js --matchweek 10

# Fetch all matchweeks (1-38)
node scripts/fetch-matches.js --all

# Save to file
node scripts/fetch-matches.js --matchweek 15 --output matchweek-15.json

# Fetch all and save
node scripts/fetch-matches.js --all --output all-matches.json
```

**API Endpoint:**

The script fetches data from:
```
https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2024&matchweek={week}&_limit=100
```

**Note:** The API endpoint may be blocked in some network environments. If you encounter connectivity issues, try running the script from a different network.

## Development

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```