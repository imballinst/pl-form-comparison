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
  const existingFile = fs.readFileSync(OUTPUT, 'utf-8')
  const existingJSON = JSON.parse(existingFile)
  let upcomingMatchweeksRecord = JSON.parse(fs.readFileSync(UPCOMING_MATCHES_FILE, 'utf-8'))

  if (Object.keys(upcomingMatchweeksRecord).length === 0) {
    console.info('No upcoming matchweeks found, initializing with default values...')

    existingJSON.matchweeks.forEach((/** @type {*} */ mw) => {
      if (mw.data.data.length > 0) {
        const date = dayjs(mw.data.data[0].kickoff, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD')
        if (!upcomingMatchweeksRecord[date]) {
          upcomingMatchweeksRecord[date] = []
        }
        if (!upcomingMatchweeksRecord[date].includes(mw.matchweek)) {
          upcomingMatchweeksRecord[date].push(mw.matchweek)
        }
      }
    })

    console.info(upcomingMatchweeksRecord)
  }

  const { future, past } = classifyMatchweeksTime(upcomingMatchweeksRecord)
  const pastMatchweeks = new Set(Object.values(past).flat())

  if (pastMatchweeks.size === 0) {
    console.info('No past matchweeks to fetch. Exiting.')
    return
  }

  console.info(`Matchweeks to fetch: ${Array.from(pastMatchweeks).join(', ')}.`)
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

  const existingByWeek = Object.fromEntries(existingJSON.matchweeks.map((/** @type {*} */ mw) => [mw.matchweek, mw]))
  allData.forEach((mw) => {
    existingByWeek[mw.matchweek] = mw
  })

  const result = {
    season: SEASON_YEAR,
    competition: COMPETITION_ID,
    matchweeks: allData,
  }
  result.matchweeks = Object.values(existingByWeek).sort((a, b) => a.matchweek - b.matchweek)

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2))
  console.log(`Data saved to ${OUTPUT}`)

  ensureResourcesDir()

  fs.writeFileSync(UPCOMING_MATCHES_FILE, JSON.stringify(future, null, 2))
  console.log(`Upcoming matches saved to ${UPCOMING_MATCHES_FILE}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
