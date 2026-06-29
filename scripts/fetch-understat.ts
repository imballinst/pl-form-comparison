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

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(response.data, null, 2))
  console.log(`Saved ${OUTPUT_PATH}`)
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
