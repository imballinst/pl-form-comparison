// @ts-check
import fs from 'fs/promises'
import path from 'path'
import { readFileAsJSON, YEAR } from './utils.mjs'

const RAW_MATCH_DETAILS_FILE_PATH = path.join(process.cwd(), `scripts/references/${YEAR}-stats.json`)

const RAW_MATCHWEEKS_FILE_PATH = path.join(process.cwd(), `public/pl-form-comparison/${YEAR}.json`)
const MATCH_DETAILS_FILE_PATH = path.join(process.cwd(), `public/pl-form-comparison/${YEAR}-stats.json`)

const STATS_LIST = Object.keys(getGameStats())

const allMatchweeks = await readFileAsJSON(RAW_MATCHWEEKS_FILE_PATH, {})
const rawAllMatchStats = await readFileAsJSON(RAW_MATCH_DETAILS_FILE_PATH)
const matchDetails = await readFileAsJSON(MATCH_DETAILS_FILE_PATH, { teams: {}, matchStatRecord: {} })

async function main() {
  for (const matchweek of allMatchweeks.matchweeks) {
    const matches = matchweek.data.data

    for (const match of matches) {
      if (match.period !== 'FullTime') continue

      const id = match.matchId
      const { stats, officials } = rawAllMatchStats[id]

      if (!matchDetails.teams[match.homeTeam.name]) {
        matchDetails.teams[match.homeTeam.name] = {}
      }
      if (!matchDetails.teams[match.awayTeam.name]) {
        matchDetails.teams[match.awayTeam.name] = {}
      }

      const teams = [
        { ...match.homeTeam, side: 'Home' },
        { ...match.awayTeam, side: 'Away' },
      ]

      for (const team of teams) {
        const { name: teamName, side } = team

        if (!matchDetails.teams[teamName]) {
          matchDetails.teams[teamName] = {}
        }

        // Stats.
        const teamStat = stats.find((/** @type {*} */ stat) => stat.side === side).stats
        const statToBePushed = getGameStats()

        for (const stat of STATS_LIST) {
          statToBePushed[stat] += teamStat[stat] ?? 0
        }

        for (const official of officials) {
          const {
            official: { name },
            type: rawType,
          } = official
          const type = rawType.includes('#') ? rawType.slice(0, rawType.indexOf('#')) : rawType

          // Officials.
          let teamOfficialObject = matchDetails.teams[teamName][name]
          if (!teamOfficialObject) {
            teamOfficialObject = {
              Home: {
                Referee: [],
                'Assistant Referee': [],
                'Video Assistant Referee': [],
                'Assistant VAR Official': [],
              },
              Away: {
                Referee: [],
                'Assistant Referee': [],
                'Video Assistant Referee': [],
                'Assistant VAR Official': [],
              },
            }
            matchDetails.teams[teamName][name] = teamOfficialObject
          }

          if (!teamOfficialObject[side][type] || teamOfficialObject[side][type].includes(id)) {
            // Skip if the type is not "identified" or already exists.
            continue
          }

          teamOfficialObject[side][type].push(id)
        }

        if (!matchDetails.matchStatRecord[id]) {
          matchDetails.matchStatRecord[id] = {}
        }
        matchDetails.matchStatRecord[id][teamName] = statToBePushed
      }
    }
  }
}

main().finally(async () => {
  await fs.writeFile(MATCH_DETAILS_FILE_PATH, JSON.stringify(matchDetails), 'utf-8')
})

/** @returns {Record<string, number>} */
function getGameStats() {
  return {
    goals: 0,
    goalsConceded: 0,
    expectedGoals: 0,
    wonCorners: 0,
    duelWon: 0,
    totalDistance: 0, // metres
    // Fouls.
    fkFoulLost: 0,
    totalOffside: 0,
    penaltyConceded: 0,
    totalYelCard: 0,
    totalRedCard: 0,
  }
}
