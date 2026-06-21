import { BASE_PATH } from '@/constants'
import type {
  MatchInfo,
  MatchOfficialTeamAssignmentData,
  MatchOfficialTeamAssignmentDataTableData,
  RawTeamStatRecapData,
  SeasonMatchesResponse,
  SeasonTableData,
} from '@/types'
import axios from 'axios'

export const OFFICIAL_ROLES = ['Referee', 'Video Assistant Referee', 'Assistant VAR Official']
export const AVAILABLE_SEASONS = ['2023', '2024', '2025']

interface MatchOfficiatingSeasonInfo {
  teamsRecord: Record<string, MatchOfficialTeamAssignmentDataTableData>
  assignmentCountPerRefereeRecord: Record<string, number>
  matchStatRecord: RawTeamStatRecapData['matchStatRecord']
}
interface AllSeasonInfo {
  officialNames: string[]
  tableData: Array<MatchOfficialTeamAssignmentDataTableData>
}

let seasons: Record<string, MatchInfo[]> | undefined
let seasonTable: Record<string, Array<SeasonTableData>> | undefined
let matchOfficialAssignmentPerSeason: Record<string, MatchOfficiatingSeasonInfo> = {}

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

export async function fetchMatchOfficialAssignments(seasons: string[]): Promise<{
  perSeasonRecord: Record<string, MatchOfficiatingSeasonInfo>
  allSeasons: AllSeasonInfo
}> {
  const missingSeasons = seasons.filter((season) => matchOfficialAssignmentPerSeason[season] === undefined)
  if (missingSeasons.length === 0) {
    return {
      allSeasons: await populateAllSeasonsRecord(seasons),
      perSeasonRecord: matchOfficialAssignmentPerSeason,
    }
  }

  for (const season of missingSeasons) {
    const response = await axios(`${BASE_PATH}/${season}-stats.json`)
    const teamStatRecapData = response.data as RawTeamStatRecapData

    if (!matchOfficialAssignmentPerSeason[season]) {
      matchOfficialAssignmentPerSeason[season] = {
        assignmentCountPerRefereeRecord: {},
        matchStatRecord: {},
        teamsRecord: {},
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
    const assignmentCountAllSeasonPerRefereeRecord: Record<string, number> = {}

    for (const team in teamStatRecapData.teams) {
      const officialAssignments = teamStatRecapData.teams[team]
      const effectiveOfficialAssignments: MatchOfficialTeamAssignmentDataTableData['referees'] = {}
      const assignmentCountForTeamPerReferee: Record<string, number> = {}

      const officialNames = Object.keys(officialAssignments)
      for (const officialName of officialNames) {
        populateMatchOfficialInfo({
          officialName,
          rolePerRefereeRecord: officialAssignments,
          assignmentCountPerRefereeRecord: assignmentCountForTeamPerReferee,
        })

        effectiveOfficialAssignments[officialName] = {
          ...officialAssignments[officialName],
          background: '',
          score: assignmentCountForTeamPerReferee[officialName],
        }

        if (!assignmentCountAllSeasonPerRefereeRecord[officialName]) {
          assignmentCountAllSeasonPerRefereeRecord[officialName] = 0
        }

        assignmentCountAllSeasonPerRefereeRecord[officialName] += assignmentCountForTeamPerReferee[officialName]
      }

      matchOfficialAssignmentPerSeason[season].teamsRecord[team] = {
        name: team,
        abbr: teamRankByNameRecord[team].abbr,
        shortName: teamRankByNameRecord[team].shortName,
        referees: effectiveOfficialAssignments,
      }
    }

    matchOfficialAssignmentPerSeason[season].matchStatRecord = teamStatRecapData.matchStatRecord
    matchOfficialAssignmentPerSeason[season].assignmentCountPerRefereeRecord = assignmentCountAllSeasonPerRefereeRecord
  }

  return {
    allSeasons: await populateAllSeasonsRecord(seasons),
    perSeasonRecord: matchOfficialAssignmentPerSeason,
  }
}

// Helper functions.
const ALL_SEASONS_CACHE: Record<string, AllSeasonInfo> = {}

async function populateAllSeasonsRecord(seasons: string[]): Promise<AllSeasonInfo> {
  const seasonsString = seasons.join(',')
  if (ALL_SEASONS_CACHE[seasonsString]) return ALL_SEASONS_CACHE[seasonsString]

  const result: AllSeasonInfo = {
    officialNames: [],
    tableData: [],
  }
  const allSeasonAssignmentCountPerRefereeRecord: Record<string, number> = {}

  for (const season of seasons) {
    const { assignmentCountPerRefereeRecord, teamsRecord } = matchOfficialAssignmentPerSeason[season]

    for (const officialName in assignmentCountPerRefereeRecord) {
      if (!allSeasonAssignmentCountPerRefereeRecord[officialName]) {
        allSeasonAssignmentCountPerRefereeRecord[officialName] = 0
      }

      allSeasonAssignmentCountPerRefereeRecord[officialName] += assignmentCountPerRefereeRecord[officialName]
    }

    for (const teamName in teamsRecord) {
      const teamData = teamsRecord[teamName]

      for (const refereeName in teamData.referees) {
        populateMatchOfficialInfo({
          rolePerRefereeRecord: teamData.referees,
          officialName: refereeName,
          assignmentCountPerRefereeRecord,
        })
      }
    }
  }

  const sortedOfficialNames = Object.entries(allSeasonAssignmentCountPerRefereeRecord)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
  const lastSeason = `${seasons.at(-1)}`
  const tableData = await fetchSeasonTable(lastSeason)

  result.officialNames = sortedOfficialNames.map((item) => item[0])
  result.tableData = tableData.map((v) => ({
    name: v.name,
    abbr: v.abbr,
    referees: (() => {
      const effectiveOfficialAssignments: MatchOfficialTeamAssignmentDataTableData['referees'] = {}
      const scores = Object.values(matchOfficialAssignmentPerSeason[lastSeason].teamsRecord[v.name].referees).map((v) => v.score)
      const min = Math.min(...scores)
      const max = Math.max(...scores)
      const factor = 1 / (max - min)

      for (const [officialName] of sortedOfficialNames) {
        const current = matchOfficialAssignmentPerSeason[lastSeason].teamsRecord[v.name].referees[officialName]

        effectiveOfficialAssignments[officialName] = {
          ...current,
          score: 0,
          background: 'black',
        }

        if (current && current.score > 0) {
          effectiveOfficialAssignments[officialName].score = current.score
          effectiveOfficialAssignments[officialName].background = `rgba(0,255,0,${(current.score - min) * factor * 0.8})`
        }
      }

      return effectiveOfficialAssignments
    })(),
    shortName: v.shortName,
  }))

  ALL_SEASONS_CACHE[seasonsString] = result

  return result
}

function populateMatchOfficialInfo({
  officialName,
  rolePerRefereeRecord,
  assignmentCountPerRefereeRecord,
}: {
  rolePerRefereeRecord: Record<string, MatchOfficialTeamAssignmentData>
  officialName: string
  assignmentCountPerRefereeRecord: Record<string, number>
}) {
  // TODO: this has to be stored.
  const matchIdsPerRefereeRecord: Record<string, number[]> = {}

  if (!assignmentCountPerRefereeRecord[officialName]) {
    assignmentCountPerRefereeRecord[officialName] = 0
  }
  if (!matchIdsPerRefereeRecord[officialName]) {
    matchIdsPerRefereeRecord[officialName] = []
  }

  let officialScoreRecord = 0

  for (const side in rolePerRefereeRecord[officialName]) {
    const roleRecord = rolePerRefereeRecord[officialName][side as 'Home' | 'Away']
    for (const role in roleRecord) {
      if (!OFFICIAL_ROLES.includes(role)) continue

      const matchIds = roleRecord[role as keyof typeof roleRecord]

      for (const matchId of matchIds) {
        if (!matchIdsPerRefereeRecord[officialName].includes(matchId)) {
          officialScoreRecord += 1
          matchIdsPerRefereeRecord[officialName].push(matchId)
        }
      }
    }
  }

  assignmentCountPerRefereeRecord[officialName] += officialScoreRecord
}
