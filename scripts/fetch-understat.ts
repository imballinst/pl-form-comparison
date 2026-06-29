import axios from 'axios'
import fs from 'fs/promises'

const YEARS = [2023, 2024, 2025]

interface UnderstatResponse {
  dates: unknown[]
  teams: Record<string, unknown>
  players: unknown[]
}

async function fetchUnderstat(year: number): Promise<UnderstatResponse> {
  const url = `https://understat.com/getLeagueData/EPL/${year}`
  console.log(`Fetching Understat for ${year}...`)
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    timeout: 15000,
  })
  return response.data
}

async function main() {
  for (const year of YEARS) {
    const data = await fetchUnderstat(year)
    const outputPath = `scripts/references/${year}-understat-raw.json`
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2))
    console.log(`Saved ${outputPath}`)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
