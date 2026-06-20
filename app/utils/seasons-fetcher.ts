import { BASE_PATH } from '@/constants'
import type {
  MatchInfo,
  MatchOfficialTeamAssignmentDataTableData,
  RawTeamStatRecapData,
  SeasonMatchesResponse,
  SeasonTableData,
} from '@/types'
import axios from 'axios'

export const OFFICIAL_ROLES = ['Referee', 'Video Assistant Referee', 'Assistant VAR Official']
export const AVAILABLE_SEASONS = ['2023', '2024', '2025']

let seasons: Record<string, MatchInfo[]> | undefined
let seasonTable: Record<string, Array<SeasonTableData>> | undefined
let matchOfficialAssignmentPerSeason: Record<
  string,
  {
    tableData: Array<MatchOfficialTeamAssignmentDataTableData>
    officialNames: string[]
    matchStatRecord: RawTeamStatRecapData['matchStatRecord']
  }
> = {}

export async function fetchSeasons() {
  if (seasons) {
    return Promise.resolve(seasons)
  }

  const responses = await Promise.all(AVAILABLE_SEASONS.map((season) => axios(`${BASE_PATH}/${season}.json`)))
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

export async function fetchMatchOfficialAssignments(seasons: string[]): Promise<typeof matchOfficialAssignmentPerSeason> {
  const missingSeasons = seasons.filter((season) => matchOfficialAssignmentPerSeason[season] === undefined)
  if (missingSeasons.length === 0) {
    return Promise.resolve(matchOfficialAssignmentPerSeason)
  }

  for (const season of missingSeasons) {
    const response = await axios(`${BASE_PATH}/${season}-stats.json`)
    const teamStatRecapData = response.data as RawTeamStatRecapData

    if (!matchOfficialAssignmentPerSeason[season]) {
      matchOfficialAssignmentPerSeason[season] = {
        officialNames: [],
        matchStatRecord: {},
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
      const officialAssignments = teamStatRecapData.teams[team]

      const officialNames = Object.keys(officialAssignments)
      const officialScorePerNameRecord: Record<string, number[]> = {}

      for (const officialName of officialNames) {
        if (!matchOfficialScores[officialName]) {
          matchOfficialScores[officialName] = 0
        }
        if (!officialScorePerNameRecord[officialName]) {
          officialScorePerNameRecord[officialName] = []
        }

        let officialScoreRecord = 0

        for (const side in officialAssignments[officialName]) {
          const roleRecord = officialAssignments[officialName][side as 'Home' | 'Away']
          for (const role in roleRecord) {
            if (!OFFICIAL_ROLES.includes(role)) continue

            const matchIds = roleRecord[role as keyof typeof roleRecord]
            officialScoreRecord += matchIds.length

            for (const matchId of matchIds) {
              if (!officialScorePerNameRecord[officialName].includes(matchId)) {
                officialScorePerNameRecord[officialName].push(matchId)
              }
            }
          }
        }

        matchOfficialScores[officialName] += officialScoreRecord
      }

      const effectiveOfficialAssignments: MatchOfficialTeamAssignmentDataTableData['referees'] = {}
      const min = Math.min(...Object.values(officialScorePerNameRecord).map((item) => item.length))
      const max = Math.max(...Object.values(officialScorePerNameRecord).map((item) => item.length))
      const factor = 1 / (max - min)

      for (const officialName of officialNames) {
        const numberOfTimesOfficiating = officialScorePerNameRecord[officialName].length

        effectiveOfficialAssignments[officialName] = {
          ...officialAssignments[officialName],
          score: numberOfTimesOfficiating,
          background: `rgba(0,255,0,${(numberOfTimesOfficiating - min) * factor * 0.8})`,
        }
      }

      matchOfficialAssignmentPerSeason[season].tableData.push({
        name: team,
        abbr: teamRankByNameRecord[team].abbr,
        shortName: teamRankByNameRecord[team].shortName,
        referees: effectiveOfficialAssignments,
      })
    }

    const sortedOfficialNames = Object.entries(matchOfficialScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)

    matchOfficialAssignmentPerSeason[season].matchStatRecord = teamStatRecapData.matchStatRecord
    matchOfficialAssignmentPerSeason[season].officialNames = sortedOfficialNames.map((item) => item[0])
    matchOfficialAssignmentPerSeason[season].tableData.sort(
      (a, b) => teamRankByNameRecord[a.name].position - teamRankByNameRecord[b.name].position,
    )
  }

  return matchOfficialAssignmentPerSeason
}
