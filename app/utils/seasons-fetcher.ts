import { BASE_PATH } from '@/constants'
import type {
  MatchInfo,
  MatchOfficialTeamAssignmentDataTableData,
  RawTeamStatRecapData,
  SeasonMatchesResponse,
  SeasonTableData,
} from '@/types'
import axios from 'axios'

let seasons: Record<string, MatchInfo[]> | undefined
let seasonTable: Record<string, Array<SeasonTableData>> | undefined
let matchOfficialsTable:
  | Record<
      string,
      {
        officialNames: string[]
        tableData: Array<MatchOfficialTeamAssignmentDataTableData>
      }
    >
  | undefined

export async function fetchSeasons() {
  if (seasons) {
    return Promise.resolve(seasons)
  }

  const responses = await Promise.all([axios(`${BASE_PATH}/2025.json`), axios(`${BASE_PATH}/2024.json`), axios(`${BASE_PATH}/2023.json`)])
  const [season2025Response, season2024Response, season2023Response] = responses.map((item) =>
    (item.data as SeasonMatchesResponse).matchweeks.flatMap((mw) => mw.data.data).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  )

  const matchesResponses: Record<string, MatchInfo[]> = {
    '2025': season2025Response,
    '2024': season2024Response,
    '2023': season2023Response,
  }
  seasons = matchesResponses

  return matchesResponses
}

export async function fetchSeasonTable(season: string) {
  if (seasonTable && seasonTable[season]) {
    return Promise.resolve(seasonTable[season])
  }

  const response = await axios(`${BASE_PATH}/${season}-table.json`)
  const seasonTableData = response.data as Array<SeasonTableData>

  if (!seasonTable) {
    seasonTable = {}
  }
  seasonTable[season] = seasonTableData

  return seasonTableData
}

export async function fetchMatchOfficialAssignments(season: string) {
  if (matchOfficialsTable && matchOfficialsTable[season]) {
    return Promise.resolve(matchOfficialsTable[season])
  }

  const response = await axios(`${BASE_PATH}/${season}-matches.json`)
  const teamStatRecapData = response.data as RawTeamStatRecapData

  if (!matchOfficialsTable) {
    matchOfficialsTable = {}
  }

  if (!matchOfficialsTable[season]) {
    matchOfficialsTable[season] = {
      officialNames: [],
      tableData: [],
    }
  }

  for (const team in teamStatRecapData.teams) {
    const officialAssignments = teamStatRecapData.teams[team].officials

    matchOfficialsTable[season].tableData.push({ name: team, referees: officialAssignments })

    // TODO: sort by occurrences.
    const officialNames = Object.keys(officialAssignments)
    for (const officialName of officialNames) {
      if (matchOfficialsTable[season].officialNames.includes(officialName)) continue
      matchOfficialsTable[season].officialNames.push(officialName)
    }
  }

  return matchOfficialsTable[season]
}
