// @ts-check
import { readFile, writeFile } from 'fs/promises'

// API Configuration
const SEASON_YEAR = 2025
const INPUT = `public/pl-form-comparison/${SEASON_YEAR}.json`
const OUTPUT = `public/pl-form-comparison/${SEASON_YEAR}-table.json`

async function main() {
  /** @type {*} */
  const inputJSON = JSON.parse(await readFile(INPUT, 'utf-8'))
  const rawMatches = inputJSON.matchweeks.flatMap((/** @type {{ data: { data: any; }; }} */ matches) => matches.data.data)
  const finishedMatches = rawMatches.filter((/** @type {{ period: string; }} */ match) => match.period === 'FullTime')
  /** @type {*} */
  const teamsObject = {}

  for (const match of finishedMatches) {
    const { homeTeam, awayTeam } = match

    if (!teamsObject[homeTeam.name]) {
      teamsObject[homeTeam.name] = {
        name: homeTeam.name,
        abbr: homeTeam.abbr,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        gf: 0,
        ga: 0,
        gd: 0,
      }
    }
    if (!teamsObject[awayTeam.name]) {
      teamsObject[awayTeam.name] = {
        name: awayTeam.name,
        abbr: awayTeam.abbr,
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        gd: 0,
      }
    }

    const homeTeamResult = teamsObject[homeTeam.name]
    const awayTeamResult = teamsObject[awayTeam.name]

    if (homeTeam.score === awayTeam.score) {
      homeTeamResult.points += 1
      homeTeamResult.draws += 1

      awayTeamResult.points += 1
      awayTeamResult.draws += 1
    } else if (homeTeam.score > awayTeam.score) {
      homeTeamResult.points += 3
      awayTeamResult.points += 0

      homeTeamResult.wins += 1
      awayTeamResult.losses += 1
    } else {
      homeTeamResult.points += 0
      awayTeamResult.points += 3

      homeTeamResult.losses += 1
      awayTeamResult.wins += 1
    }

    homeTeamResult.played += 1
    awayTeamResult.played += 1

    homeTeamResult.gf += homeTeam.score
    homeTeamResult.ga += awayTeam.score
    homeTeamResult.gd += homeTeam.score - awayTeam.score

    awayTeamResult.gf += awayTeam.score
    awayTeamResult.ga += homeTeam.score
    awayTeamResult.gd += awayTeam.score - homeTeam.score
  }

  const table = Object.values(teamsObject).sort((a, b) => {
    if (b.points > a.points) {
      return 1
    } else if (b.points < a.points) {
      return -1
    }

    if (b.gd > a.gd) {
      return 1
    } else if (b.gd < a.gd) {
      return -1
    }

    if (b.gf > a.gf) {
      return 1
    } else if (b.gf < a.gf) {
      return -1
    }

    return 0
  })

  await writeFile(OUTPUT, JSON.stringify(table, null, 2))
  console.log(`Data saved to ${OUTPUT}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
