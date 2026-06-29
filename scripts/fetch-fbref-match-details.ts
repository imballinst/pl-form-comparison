import axios from 'axios'
import fs from 'fs/promises'
import { JSDOM } from 'jsdom'
import { setTimeout } from 'timers/promises'
import type { FbrefScheduleEntry, MatchDetail, MatchOfficial, MatchCards, MatchExtraStats } from './types'

const YEARS = [2023, 2024, 2025]
const REQUEST_DELAY_MS = 7000

async function fetchMatchDetails(matchReportUrl: string): Promise<MatchDetail> {
  console.log(`  Fetching ${matchReportUrl}...`)
  const response = await axios.get(matchReportUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html',
    },
    timeout: 20000,
  })

  const dom = new JSDOM(response.data)
  const doc = dom.window.document

  const officials = parseOfficials(doc)
  const cards = parseCards(doc)
  const extraStats = parseExtraStats(doc)

  return { officials, cards, extraStats }
}

function parseOfficials(doc: Document): MatchOfficial[] {
  const scoreboxMeta = doc.querySelector('.scorebox_meta')
  if (!scoreboxMeta) return []

  const metaDivs = scoreboxMeta.querySelectorAll('div')
  for (const div of metaDivs) {
    const text = div.textContent!.trim()
    if (text.includes('Officials')) {
      const spans = div.querySelectorAll('span')
      const officials: MatchOfficial[] = []
      for (const span of spans) {
        const spanText = span.textContent!.trim()
        const match = spanText.match(/^(.+?)\s*\((.+?)\)$/)
        if (match) {
          officials.push({ name: match[1].trim(), role: match[2].trim() })
        } else {
          const parts = spanText.split(/\s*·\s*/)
          for (const part of parts) {
            const m = part.match(/^(.+?)\s*\((.+?)\)$/)
            if (m) {
              officials.push({ name: m[1].trim(), role: m[2].trim() })
            }
          }
        }
      }
      return officials
    }
  }
  return []
}

function parseCards(doc: Document): MatchCards {
  const teamStats = doc.getElementById('team_stats')
  if (!teamStats) return { homeYellow: 0, homeRed: 0, awayYellow: 0, awayRed: 0 }

  const cardsRows = teamStats.querySelectorAll('tr')
  let cardsRow: Element | null = null
  for (const row of cardsRows) {
    const th = row.querySelector('th')
    if (th && th.textContent!.trim() === 'Cards') {
      cardsRow = row.nextElementSibling
      break
    }
  }

  if (!cardsRow) return { homeYellow: 0, homeRed: 0, awayYellow: 0, awayRed: 0 }

  const tds = cardsRow.querySelectorAll('td')
  if (tds.length < 2) return { homeYellow: 0, homeRed: 0, awayYellow: 0, awayRed: 0 }

  const homeCardsDiv = tds[0]
  const awayCardsDiv = tds[1]

  const homeYellow = homeCardsDiv.querySelectorAll('.yellow_card').length
  const homeRed = homeCardsDiv.querySelectorAll('.red_card, .yellow_red_card').length
  const awayYellow = awayCardsDiv.querySelectorAll('.yellow_card').length
  const awayRed = awayCardsDiv.querySelectorAll('.red_card, .yellow_red_card').length

  return { homeYellow, homeRed, awayYellow, awayRed }
}

function parseExtraStats(doc: Document): MatchExtraStats {
  const extraStatsDiv = doc.getElementById('team_stats_extra')
  if (!extraStatsDiv) return { fouls: { home: 0, away: 0 }, corners: { home: 0, away: 0 }, offsides: { home: 0, away: 0 } }

  const result: MatchExtraStats = { fouls: { home: 0, away: 0 }, corners: { home: 0, away: 0 }, offsides: { home: 0, away: 0 } }

  const groupContainers = extraStatsDiv.children
  for (let gi = 0; gi < groupContainers.length; gi++) {
    const container = groupContainers[gi]
    const divs = container.querySelectorAll('div')
    if (divs.length < 3) continue

    const isHeaderRow =
      divs[0].classList.contains('th') &&
      divs[2] &&
      divs[2].classList.contains('th')

    if (isHeaderRow) continue

    if (divs.length >= 3) {
      const homeVal = divs[0].textContent!.trim()
      const label = divs[1].textContent!.trim()
      const awayVal = divs[2].textContent!.trim()

      const homeNum = parseInt(homeVal, 10)
      const awayNum = parseInt(awayVal, 10)

      if (label === 'Fouls') {
        result.fouls = { home: isNaN(homeNum) ? 0 : homeNum, away: isNaN(awayNum) ? 0 : awayNum }
      } else if (label === 'Corners') {
        result.corners = { home: isNaN(homeNum) ? 0 : homeNum, away: isNaN(awayNum) ? 0 : awayNum }
      } else if (label === 'Offsides') {
        result.offsides = { home: isNaN(homeNum) ? 0 : homeNum, away: isNaN(awayNum) ? 0 : awayNum }
      }
    }
  }

  return result
}

async function main() {
  for (const year of YEARS) {
    const schedulePath = `scripts/references/${year}-fbref-schedule.json`
    const schedule: FbrefScheduleEntry[] = JSON.parse(await fs.readFile(schedulePath, 'utf-8'))

    const finishedMatches = schedule.filter((m) => m.score !== null)
    console.log(`Processing ${finishedMatches.length} finished matches for ${year}...`)

    const details: Record<string, MatchDetail> = {}

    for (let i = 0; i < finishedMatches.length; i++) {
      const match = finishedMatches[i]
      if (!match.matchReportUrl) {
        console.log(`  Skipping match ${i + 1}/${finishedMatches.length} (no URL): ${match.home} vs ${match.away}`)
        continue
      }

      console.log(`  Match ${i + 1}/${finishedMatches.length}: ${match.home} vs ${match.away}`)
      try {
        const matchDetails = await fetchMatchDetails(match.matchReportUrl)
        const matchKey = `${match.date}_${match.home}_${match.away}`
        details[matchKey] = matchDetails
      } catch (err) {
        console.error(`  Error fetching match details: ${err}`)
      }

      if (i < finishedMatches.length - 1) {
        await setTimeout(REQUEST_DELAY_MS)
      }
    }

    const outputPath = `scripts/references/${year}-fbref-match-details.json`
    await fs.writeFile(outputPath, JSON.stringify(details, null, 2))
    console.log(`Saved ${outputPath} with ${Object.keys(details).length} match details`)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
