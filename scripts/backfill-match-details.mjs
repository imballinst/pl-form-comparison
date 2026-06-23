// @ts-check
import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { setTimeout } from 'timers/promises'
import { readFileAsJSON, YEAR } from './utils.mjs'

const STATS_ENDPOINT = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v3/matches/{MATCH_ID}/stats`
const OFFICIALS_ENDPOINT = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v1/matches/{MATCH_ID}/officials`
const RAW_MATCHWEEKS_FILE_PATH = path.join(process.cwd(), `public/pl-form-comparison/${YEAR}.json`)
const RAW_MATCH_DETAILS_FILE_PATH = path.join(process.cwd(), `scripts/references/${YEAR}-stats.json`)

const allMatchweeks = await readFileAsJSON(RAW_MATCHWEEKS_FILE_PATH, {})
/** @type {*} */
const rawMatchDetails = {}

async function main() {
  for (const matchweek of allMatchweeks.matchweeks) {
    const matches = matchweek.data.data

    for (const match of matches) {
      if (match.period !== 'FullTime') continue

      const id = match.matchId
      await populateCurrentMatchStats(id, [
        {
          name: match.homeTeam.name,
          side: 'Home',
        },
        {
          name: match.awayTeam.name,
          side: 'Away',
        },
      ])

      await setTimeout(1000)
    }
  }
}

main().finally(async () => {
  await fs.writeFile(RAW_MATCH_DETAILS_FILE_PATH, JSON.stringify(rawMatchDetails), 'utf-8')
})

/**
 *
 * @param {string} id
 * @param {Array<{ name: string, side: string}>} teams
 */
async function populateCurrentMatchStats(id, teams) {
  /** @type {*} */
  let currentMatch = {}
  try {
    const debugText = `Match details between ${teams.map((team) => team.name).join(' and ')}`
    if (rawMatchDetails[id] && process.env.START_FRESH !== 'true') {
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
    rawMatchDetails[id] = currentMatch
  } catch (err) {
    console.error(err)
  }
}
