import axios from 'axios'
import fs from 'fs'

// API Configuration
const COMPETITION_ID = 8
const SEASON_YEAR = 2025
const MAX_MATCHWEEKS = 38
const START_MATCHWEEK = process.env.START_MATCHWEEK ? Number(process.env.START_MATCHWEEK) : 1
const END_MATCHWEEK = process.env.END_MATCHWEEK ? Number(process.env.END_MATCHWEEK) : MAX_MATCHWEEKS
const API_LIMIT = 100
const OUTPUT = `public/pl-form-comparison/${SEASON_YEAR}.json`
const OVERRIDE = process.env.OVERRIDE === 'true'

async function fetchMatches(matchweek) {
  const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=${COMPETITION_ID}&season=${SEASON_YEAR}&matchweek=${matchweek}&_limit=${API_LIMIT}`

  // Create request with headers to mimic a browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  try {
    const response = await axios.get(url, { headers, timeout: 10000 })
    return response.data
  } catch (error) {
    console.error(`Error fetching matchweek ${matchweek}:`, error.message)
    return null
  }
}

async function main() {
  if (fs.existsSync(OUTPUT) && !OVERRIDE) {
    console.info(`File ${OUTPUT} exists, skipping sync...`)
    return
  }

  console.info(`Fetching all matchweeks (${START_MATCHWEEK}-${END_MATCHWEEK})...`)
  const allData = []

  for (let week = START_MATCHWEEK; week <= END_MATCHWEEK; week++) {
    console.info(`Fetching matchweek ${week}...`)
    const data = await fetchMatches(week)

    if (data !== null) {
      allData.push({
        matchweek: week,
        data: data,
      })
    } else {
      throw new Error(`Warning: Failed to fetch matchweek ${week}`)
    }
  }

  const result = {
    season: SEASON_YEAR,
    competition: COMPETITION_ID,
    matchweeks: allData,
  }

  let jsonOutput = result

  if (START_MATCHWEEK !== 1) {
    const existingFile = fs.readFileSync(OUTPUT, 'utf-8')
    const existingJSON = JSON.parse(existingFile)

    jsonOutput.matchweeks = existingJSON.matchweeks
      .slice(0, START_MATCHWEEK - 1)
      .concat(result.matchweeks)
      .concat(existingJSON.matchweeks.slice(END_MATCHWEEK))
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(jsonOutput, null, 2))
  console.log(`Data saved to ${OUTPUT}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
