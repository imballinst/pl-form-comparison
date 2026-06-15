// @ts-check
import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { setTimeout } from 'timers/promises'

const YEAR = 2025
const STATS_ENDPOINT = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v3/matches/{MATCH_ID}/stats`
const OFFICIALS_ENDPOINT = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v1/matches/{MATCH_ID}/officials`
const RAW_MATCHWEEKS_FILE_PATH = path.join(process.cwd(), `public/pl-form-comparison/${YEAR}.json`)
const MATCH_DETAILS_FILE_PATH = path.join(process.cwd(), `public/pl-form-comparison/${YEAR}-matches.json`)

const STATS_LIST = Object.keys(getGameStats())
// Unused.
// const MOMENTUM_ENDPOINT = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v1/matches/{MATCH_ID}/momentum`

const allMatchweeks = await readFileAsJSON(RAW_MATCHWEEKS_FILE_PATH, {})
const matchDetails = await readFileAsJSON(MATCH_DETAILS_FILE_PATH, { processedMatches: [], teams: {} })

async function main() {
  for (const matchweek of allMatchweeks.matchweeks) {
    const matches = matchweek.data.data

    for (const match of matches) {
      if (match.period !== 'FullTime') continue

      const id = match.matchId
      await populateCurrentMatchStats(id, [
        {
          ...match.homeTeam,
          side: 'Home',
        },
        {
          ...match.awayTeam,
          side: 'Away',
        },
      ])

      await setTimeout(1000)
    }
  }
}

main().finally(async () => {
  await fs.writeFile(MATCH_DETAILS_FILE_PATH, JSON.stringify(matchDetails), 'utf-8')
})

/**
 *
 * @param {string} id
 * @param {Array<{ name: string, score: number, side: string}>} teams
 */
async function populateCurrentMatchStats(id, teams) {
  /** @type {*} */
  let currentMatch = {}
  try {
    const debugText = `Match details between ${teams.map((team) => team.name).join(' and ')}`
    if (matchDetails.processedMatches.includes(id)) {
      console.debug(`${debugText} found, skipping...`)
      return
    }

    console.debug(`${debugText} not found, fetching...`)

    const statsResponse = await axios(STATS_ENDPOINT.replace('{MATCH_ID}', id))
    const officialsResponse = await axios(OFFICIALS_ENDPOINT.replace('{MATCH_ID}', id))

    currentMatch = {
      stats: statsResponse.data,
      officials: officialsResponse.data.matchOfficials,
    }
  } catch (err) {
    console.error(err)
    return
  }

  const { stats, officials } = currentMatch

  for (const team of teams) {
    if (!matchDetails.teams[team.name]) matchDetails.teams[team.name] = getNewDefaultObject()
  }

  for (const team of teams) {
    const { name: teamName, side } = team

    // Stats.
    const teamStat = stats.find((/** @type {*} */ stat) => stat.side === side).stats
    const statToBePushed = getGameStats()
    matchDetails.teams[teamName].games.push(statToBePushed)

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
      let teamOfficialObject = matchDetails.teams[teamName].officials[name]
      if (!teamOfficialObject) {
        teamOfficialObject = {
          Home: {
            Referee: 0,
            'Assistant Referee': 0,
            'Fourth official': 0,
            'Video Assistant Referee': 0,
            'Assistant VAR Official': 0,
          },
          Away: {
            Referee: 0,
            'Assistant Referee': 0,
            'Fourth official': 0,
            'Video Assistant Referee': 0,
            'Assistant VAR Official': 0,
          },
        }
        matchDetails.teams[teamName].officials[name] = teamOfficialObject
      }

      teamOfficialObject[side][type]++
    }
  }

  matchDetails.processedMatches.push(id)
}

function getNewDefaultObject() {
  return {
    /** @type {*} */
    officials: {},
    /** @type {*} */
    games: [],
  }
}

/** @returns {Record<string, number>} */
function getGameStats() {
  return {
    expectedGoals: 0,
    wonCorners: 0,
    duelWon: 0,
    totalDistance: 0, // metres
    // Fouls.
    fkFoulLost: 0,
    totalOffside: 0,
    penaltyConceded: 0,
    yellowCard: 0,
    redCard: 0,
  }
}

/**
 *
 * @param {*} filePath
 * @param {*} defaultValue
 * @returns {Promise<*>}
 */
async function readFileAsJSON(filePath, defaultValue) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'))
  } catch (err) {
    return defaultValue
  }
}
