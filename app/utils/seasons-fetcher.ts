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

  const seasonTable = await fetchSeasonTable(season)
  const teamRankByNameRecord = seasonTable.reduce(
    (obj, cur, index) => {
      obj[cur.name] = {
        ...cur,
        position: index + 1,
      }
      return obj
    },
    {} as Record<string, SeasonTableData & { position: number }>,
  )
  const matchOfficialScores: Record<string, number> = {}

  for (const team in teamStatRecapData.teams) {
    const officialAssignments = teamStatRecapData.teams[team].officials

    const officialNames = Object.keys(officialAssignments)
    const officialScorePerNameRecord: Record<string, number> = {}

    for (const officialName of officialNames) {
      if (!matchOfficialScores[officialName]) {
        matchOfficialScores[officialName] = 0
      }
      if (!officialScorePerNameRecord[officialName]) {
        officialScorePerNameRecord[officialName] = 0
      }

      let officialScoreRecord = 0

      for (const side in officialAssignments[officialName]) {
        const roleRecord = officialAssignments[officialName][side as 'Home' | 'Away']
        for (const role in roleRecord) {
          if (!['Referee', 'Video Assistant Referee', 'Assistant VAR Official'].includes(role)) continue

          officialScoreRecord += roleRecord[role as keyof typeof roleRecord]
        }
      }

      matchOfficialScores[officialName] += officialScoreRecord
      officialScorePerNameRecord[officialName] = officialScoreRecord
    }

    const effectiveOfficialAssignments: MatchOfficialTeamAssignmentDataTableData['referees'] = {}
    const min = Math.min(...Object.values(officialScorePerNameRecord))
    const max = Math.max(...Object.values(officialScorePerNameRecord))
    const factor = 1 / (max - min)

    for (const officialName of officialNames) {
      effectiveOfficialAssignments[officialName] = {
        ...officialAssignments[officialName],
        score: officialScorePerNameRecord[officialName],
        background: `rgba(0,255,0,${(officialScorePerNameRecord[officialName] - min) * factor * 0.8})`,
      }
    }

    matchOfficialsTable[season].tableData.push({
      name: team,
      abbr: teamRankByNameRecord[team].abbr,
      shortName: teamRankByNameRecord[team].shortName,
      referees: effectiveOfficialAssignments,
    })
  }

  const sortedOfficialNames = Object.entries(matchOfficialScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
  matchOfficialsTable[season].officialNames = sortedOfficialNames.map((item) => item[0])

  matchOfficialsTable[season].tableData.sort((a, b) => teamRankByNameRecord[a.name].position - teamRankByNameRecord[b.name].position)

  return matchOfficialsTable[season]
}
