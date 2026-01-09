// @ts-check
import axios from 'axios'
import dayjs from 'dayjs'
import fs from 'fs'
import path from 'path'

const COMPETITION_ID = 8
const SEASON_YEAR = 2025
const API_LIMIT = 100
const OUTPUT = `public/pl-form-comparison/${SEASON_YEAR}.json`
const UPCOMING_MATCHES_FILE = `scripts/resources/upcoming-matches.json`

/**
 *
 * @param {number} matchweek
 * @returns
 */
async function fetchMatches(matchweek) {
  const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=${COMPETITION_ID}&season=${SEASON_YEAR}&matchweek=${matchweek}&_limit=${API_LIMIT}`

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  try {
    const response = await axios.get(url, { headers, timeout: 10000 })
    return response.data
  } catch (/** @type {*} */ error) {
    console.error(`Error fetching matchweek ${matchweek}:`, error.message)
    return null
  }
}

/**
 *
 * @param {*} upcoming
 * @returns
 */
function classifyMatchweeksTime(upcoming) {
  /** @type {Record<string, number[]>}*/
  const past = {}
  /** @type {Record<string, number[]>}*/
  const future = {}
  for (const [date, weeks] of Object.entries(upcoming)) {
    if (dayjs(date).isAfter(dayjs())) {
      future[date] = weeks
    } else {
      past[date] = weeks
    }
  }
  return { past, future }
}

function ensureResourcesDir() {
  const dir = path.dirname(UPCOMING_MATCHES_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function main() {
  const upcomingMatchweeksRecord = JSON.parse(fs.readFileSync(UPCOMING_MATCHES_FILE, 'utf-8'))
  const { future, past } = classifyMatchweeksTime(upcomingMatchweeksRecord)
  const pastMatchweeks = new Set(Object.values(past).flat())

  console.info(`Fetching matchweeks: ${Array.from(pastMatchweeks).join(', ')}...`)
  const allData = []

  for (const week of pastMatchweeks) {
    console.info(`Fetching matchweek ${week}...`)
    const data = await fetchMatches(week)

    if (data !== null) {
      allData.push({
        matchweek: week,
        data: data,
      })
    } else {
      throw new Error(`Failed to fetch matchweek ${week}`)
    }
  }

  const result = {
    season: SEASON_YEAR,
    competition: COMPETITION_ID,
    matchweeks: allData,
  }

  let jsonOutput = result

  if (fs.existsSync(OUTPUT)) {
    const existingFile = fs.readFileSync(OUTPUT, 'utf-8')
    const existingJSON = JSON.parse(existingFile)

    const existingByWeek = Object.fromEntries(existingJSON.matchweeks.map((/** @type {*} */ mw) => [mw.matchweek, mw]))

    result.matchweeks.forEach((mw) => {
      existingByWeek[mw.matchweek] = mw
    })

    jsonOutput.matchweeks = Object.values(existingByWeek).sort((a, b) => a.matchweek - b.matchweek)
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(jsonOutput, null, 2))
  console.log(`Data saved to ${OUTPUT}`)

  ensureResourcesDir()

  fs.writeFileSync(UPCOMING_MATCHES_FILE, JSON.stringify(future, null, 2))
  console.log(`Upcoming matches saved to ${UPCOMING_MATCHES_FILE}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
