// @ts-check
import axios from 'axios'
import dayjs from 'dayjs'
import fs from 'fs'

const COMPETITION_ID = 8
const SEASON_YEAR = 2025
const API_LIMIT = 100
const OUTPUT = `public/pl-form-comparison/${SEASON_YEAR}.json`

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

async function main() {
  const existingFile = fs.readFileSync(OUTPUT, 'utf-8')
  const existingJSON = JSON.parse(existingFile)

  /** @type {number[]} */
  const matchweeksToFetch = []

  for (const mw of existingJSON.matchweeks) {
    for (const match of mw.data.data) {
      const date = dayjs(match.kickoff, 'YYYY-MM-DD HH:mm:ss')
      if (date.isBefore(dayjs()) && match.period === 'FullTime') {
        continue
      }
      if (date.isAfter(dayjs())) {
        continue
      }

      if (!matchweeksToFetch.includes(mw.matchweek)) {
        // Add 2 more matchweeks in advance, just so it's possible to know future fixtures.
        matchweeksToFetch.push(mw.matchweek, Math.max(mw.matchweek, mw.matchweek + 1), Math.max(mw.matchweek, mw.matchweek + 2))
      }
    }
  }

  if (matchweeksToFetch.length === 0) {
    console.info('No past matchweeks to fetch. Exiting.')
    return
  }

  console.info(`Matchweeks to fetch: ${matchweeksToFetch.join(', ')}.`)
  const allData = []

  for (const week of matchweeksToFetch) {
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
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
