import axios from 'axios'
import fs from 'fs/promises'
import { YEAR } from './utils'

const OUTPUT_PATH = `scripts/references/${YEAR}-understat-raw.json`

async function main() {
  const url = `https://understat.com/getLeagueData/EPL/${YEAR}`
  console.log(`Fetching Understat for ${YEAR}...`)
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    timeout: 15000,
  })

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(manualAdjustments(response.data), null, 2))
  console.log(`Saved ${OUTPUT_PATH}`)
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

function manualAdjustments(data: any) {
  const adjusted: Record<string, { datetime: string }> = {
    'Manchester City_Sunderland': {
      datetime: '2026-09-20 14:00:00',
    },
    'Leeds_Crystal Palace': {
      datetime: '2026-09-20 14:00:00',
    },
    Liverpool_Brighton: {
      datetime: '2026-10-25 14:00:00',
    },
    'Aston Villa_Fulham': {
      datetime: '2026-10-31 20:00:00',
    },
  }
  const keys = Object.keys(adjusted)

  for (const match of data.dates) {
    const key = `${match.h.title}_${match.a.title}`
    if (keys.includes(key)) {
      match.datetime = adjusted[key].datetime
    }
  }

  return data
}
