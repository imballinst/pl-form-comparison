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
    let homeTeamPoints
    let awayTeamPoints

    if (homeTeam.score === awayTeam.score) {
      homeTeamPoints = 1
      awayTeamPoints = 1
    } else if (homeTeam.score > awayTeam.score) {
      homeTeamPoints = 3
      awayTeamPoints = 0
    } else {
      homeTeamPoints = 0
      awayTeamPoints = 3
    }

    if (!teamsObject[homeTeam.name]) {
      teamsObject[homeTeam.name] = {
        name: homeTeam.name,
        points: 0,
        gf: 0,
        ga: 0,
        gd: 0,
      }
    }
    if (!teamsObject[awayTeam.name]) {
      teamsObject[awayTeam.name] = {
        name: awayTeam.name,
        points: 0,
        gf: 0,
        ga: 0,
        gd: 0,
      }
    }

    const homeTeamGD = homeTeam.score - awayTeam.score
    const awayTeamGD = awayTeam.score - homeTeam.score

    teamsObject[homeTeam.name].gf += homeTeam.score
    teamsObject[homeTeam.name].ga += awayTeam.score
    teamsObject[homeTeam.name].gd += homeTeamGD
    teamsObject[homeTeam.name].points += homeTeamPoints

    teamsObject[awayTeam.name].gf += awayTeam.score
    teamsObject[awayTeam.name].ga += homeTeam.score
    teamsObject[awayTeam.name].gd += awayTeamGD
    teamsObject[awayTeam.name].points += awayTeamPoints
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
