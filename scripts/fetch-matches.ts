import axios from 'axios'
import dayjs from 'dayjs'
import fs from 'fs'

const COMPETITION_ID = 8
const SEASON_YEAR = 2025
const API_LIMIT = 100
const FETCH_REMAINING_MATCHWEEKS = process.env.FETCH_REMAINING_MATCHWEEKS === 'true'
const OUTPUT = `public/pl-form-comparison/${SEASON_YEAR}.json`

interface MatchweekData {
  matchweek: number
  data: {
    pagination: { _limit: number; _prev: unknown; _next: unknown }
    data: unknown[]
  }
}

interface ExistingJSON {
  season: number
  competition: number
  matchweeks: MatchweekData[]
}

async function fetchMatches(matchweek: number): Promise<MatchweekData | null> {
  const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=${COMPETITION_ID}&season=${SEASON_YEAR}&matchweek=${matchweek}&_limit=${API_LIMIT}`

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  try {
    const response = await axios.get(url, { headers, timeout: 10000 })
    return response.data
  } catch (error) {
    console.error(`Error fetching matchweek ${matchweek}:`, (error as Error).message)
    return null
  }
}

async function main() {
  const existingFile = fs.readFileSync(OUTPUT, 'utf-8')
  const existingJSON: ExistingJSON = JSON.parse(existingFile)

  const matchweeksToFetch: number[] = []

  for (const mw of existingJSON.matchweeks) {
    for (const match of (mw.data.data as Array<{ kickoff: string; period: string }>)) {
      const date = dayjs(match.kickoff, 'YYYY-MM-DD HH:mm:ss')
      if (date.isBefore(dayjs()) && match.period === 'FullTime') {
        continue
      }
      if (date.isAfter(dayjs())) {
        if (FETCH_REMAINING_MATCHWEEKS) {
          for (let i = mw.matchweek; i <= existingJSON.matchweeks.length; i++) {
            if (!matchweeksToFetch.includes(i)) {
              matchweeksToFetch.push(i)
            }
          }
        }

        continue
      }

      if (!matchweeksToFetch.includes(mw.matchweek)) {
        matchweeksToFetch.push(mw.matchweek, Math.max(mw.matchweek, mw.matchweek + 1), Math.max(mw.matchweek, mw.matchweek + 2))
      }
    }
  }

  if (matchweeksToFetch.length === 0) {
    console.info('No past matchweeks to fetch. Exiting.')
    return
  }

  console.info(`Matchweeks to fetch: ${matchweeksToFetch.join(', ')}.`)
  const allData: MatchweekData[] = []

  for (const week of matchweeksToFetch) {
    console.info(`Fetching matchweek ${week}...`)
    const data = await fetchMatches(week)

    if (data !== null) {
      allData.push({
        matchweek: week,
        data: data.data,
      })
    } else {
      throw new Error(`Failed to fetch matchweek ${week}`)
    }
  }

  const existingByWeek: Record<number, MatchweekData> = Object.fromEntries(
    existingJSON.matchweeks.map((mw: MatchweekData) => [mw.matchweek, mw]),
  )
  allData.forEach((mw) => {
    existingByWeek[mw.matchweek] = mw
  })

  const result: ExistingJSON = {
    season: SEASON_YEAR,
    competition: COMPETITION_ID,
    matchweeks: Object.values(existingByWeek).sort((a, b) => a.matchweek - b.matchweek),
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2))
  console.log(`Data saved to ${OUTPUT}`)
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
