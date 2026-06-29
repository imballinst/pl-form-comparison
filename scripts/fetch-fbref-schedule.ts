import axios from 'axios'
import fs from 'fs/promises'
import { JSDOM } from 'jsdom'
import type { FbrefScheduleEntry } from './types'

const YEARS = [2023, 2024, 2025]

const FBREF_SEASON_MAP: Record<string, string> = {
  '2023': '2023-2024',
  '2024': '2024-2025',
  '2025': '2025-2026',
}

function parseScore(scoreStr: string): { home: number; away: number } | null {
  if (!scoreStr || scoreStr === '–') return null
  const parts = scoreStr.split('–')
  if (parts.length !== 2) return null
  return { home: parseInt(parts[0], 10), away: parseInt(parts[1], 10) }
}

function parseAttendance(attStr: string): number | null {
  if (!attStr) return null
  return parseInt(attStr.replace(/,/g, ''), 10) || null
}

async function fetchSchedule(year: number): Promise<FbrefScheduleEntry[]> {
  const seasonPath = FBREF_SEASON_MAP[year]
  const url = `https://fbref.com/en/comps/9/${seasonPath}/schedule/${seasonPath}-Premier-League-Scores-and-Fixtures`

  console.log(`Fetching FBref schedule for ${year}...`)
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html',
    },
    timeout: 20000,
  })

  const dom = new JSDOM(response.data)
  const doc = dom.window.document

  const table = doc.querySelector(`table[id^="sched_${seasonPath}"]`)
  if (!table) {
    throw new Error(`Schedule table not found for ${year}`)
  }

  const rows = table.querySelectorAll('tbody tr')
  const matches: FbrefScheduleEntry[] = []

  for (const row of rows) {
    const cells = row.querySelectorAll('td, th')
    if (cells.length < 11) continue

    const matchweek = parseInt(cells[0].textContent!.trim(), 10)
    if (isNaN(matchweek)) continue

    const date = cells[2].textContent!.trim()
    const time = cells[3].textContent!.trim()
    const home = cells[4].textContent!.trim()
    const scoreRaw = cells[5].textContent!.trim()
    const away = cells[6].textContent!.trim()
    const attendanceRaw = cells[7].textContent!.trim()
    const venue = cells[8].textContent!.trim()
    const referee = cells[9].textContent!.trim()

    const matchReportLink = cells[10].querySelector('a')
    const matchReportUrl = matchReportLink ? matchReportLink.getAttribute('href') : null

    const score = parseScore(scoreRaw)
    const attendance = parseAttendance(attendanceRaw)

    matches.push({
      matchweek,
      date,
      time,
      home,
      away,
      score,
      attendance,
      venue,
      referee: referee || null,
      matchReportUrl: matchReportUrl ? `https://fbref.com${matchReportUrl}` : null,
    })
  }

  console.log(`  Parsed ${matches.length} matches for ${year}`)
  return matches
}

async function main() {
  for (const year of YEARS) {
    const matches = await fetchSchedule(year)
    const outputPath = `scripts/references/${year}-fbref-schedule.json`
    await fs.writeFile(outputPath, JSON.stringify(matches, null, 2))
    console.log(`Saved ${outputPath}`)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
