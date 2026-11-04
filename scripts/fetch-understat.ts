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

  // Guard against clobbering the reference data with an empty payload: Understat can return a
  // dataset without dates/teams (e.g. a future season that has no data yet), which previously
  // silently wiped the raw file and cascaded into an empty public/<YEAR>.json.
  const data = (response.data ?? {}) as { dates?: unknown[]; teams?: Record<string, unknown> }
  if (!Array.isArray(data.dates) || data.dates.length === 0 || !data.teams || Object.keys(data.teams).length === 0) {
    throw new Error(`Understat returned an empty league dataset for EPL ${YEAR}; keeping the existing ${OUTPUT_PATH} untouched`)
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2))
  console.log(`Saved ${OUTPUT_PATH}`)
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
