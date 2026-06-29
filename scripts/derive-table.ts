import { readFile, writeFile } from 'fs/promises'
import type { SeasonFile, SeasonTableData } from '../app/types'

const YEARS = [2023, 2024, 2025]

async function deriveTable(year: number): Promise<void> {
  const inputPath = `public/pl-form-comparison/${year}.json`
  const outputPath = `public/pl-form-comparison/${year}-table.json`

  const inputJSON: SeasonFile = JSON.parse(await readFile(inputPath, 'utf-8'))
  const rawMatches = Object.values(inputJSON.matches).flat()
  const finishedMatches = rawMatches.filter((match) => match.period === 'FullTime')

  const teamsObject: Record<string, SeasonTableData> = {}

  for (const match of finishedMatches) {
    const { homeTeam, awayTeam } = match

    if (!teamsObject[homeTeam.name]) {
      teamsObject[homeTeam.name] = {
        name: homeTeam.name,
        abbr: homeTeam.abbr,
        shortName: homeTeam.shortName,
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
        shortName: awayTeam.shortName,
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

    const homeTeamResult = teamsObject[homeTeam.name]
    const awayTeamResult = teamsObject[awayTeam.name]

    const homeScore = homeTeam.score!
    const awayScore = awayTeam.score!

    if (homeScore === awayScore) {
      homeTeamResult.points += 1
      homeTeamResult.draws += 1

      awayTeamResult.points += 1
      awayTeamResult.draws += 1
    } else if (homeScore > awayScore) {
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

    homeTeamResult.gf += homeScore
    homeTeamResult.ga += awayScore
    homeTeamResult.gd += homeScore - awayScore

    awayTeamResult.gf += awayScore
    awayTeamResult.ga += homeScore
    awayTeamResult.gd += awayScore - homeScore
  }

  const table = Object.values(teamsObject).sort((a, b) => {
    if (b.points > a.points) return 1
    if (b.points < a.points) return -1

    if (b.gd > a.gd) return 1
    if (b.gd < a.gd) return -1

    if (b.gf > a.gf) return 1
    if (b.gf < a.gf) return -1

    return 0
  })

  await writeFile(outputPath, JSON.stringify(table, null, 2))
  console.log(`Table data saved to ${outputPath}`)
}

async function main() {
  for (const year of YEARS) {
    await deriveTable(year)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
