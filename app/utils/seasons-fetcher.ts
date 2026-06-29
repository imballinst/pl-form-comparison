import { BASE_PATH } from '@/constants'
import { truncateDecimals } from '@/lib/format'
import dayjs from 'dayjs'
import type {
  AllSeasonMatchOfficialAssignmentTableData,
  MatchInfo,
  MatchOfficialAssignmentPerTeamData,
  MatchOfficialTeamAssignmentData,
  RawTeamStatRecapData,
  RefereeAdditionalInformation,
  SeasonFile,
  SeasonMatchesResponse,
  SeasonTableData,
} from '@/types'
import axios from 'axios'
import { getScoreResult } from './match'

export const OFFICIAL_ROLES = ['Referee', 'Video Assistant Referee'] as const
export const AVAILABLE_SEASONS = ['2023', '2024', '2025']

interface MatchOfficiatingSeasonInfo {
  teamsRecord: Record<string, MatchOfficialAssignmentPerTeamData>
  assignmentCountPerRefereeRecord: Record<string, RefereeAdditionalInformation>
  matchStatRecord: RawTeamStatRecapData['matchStatRecord']
}
interface AllSeasonInfo {
  officialNames: string[]
  tableData: Array<AllSeasonMatchOfficialAssignmentTableData>
}

let seasons: Record<string, MatchInfo[]> = {}
let seasonTable: Record<string, Array<SeasonTableData>> | undefined
// First index is by roles param, second index is by seasons param.
let matchOfficialAssignmentPerSeason: Record<string, Record<string, MatchOfficiatingSeasonInfo>> = {}

function isBST(dateStr: string): boolean {
  const d = dayjs(dateStr)
  const month = d.month()
  return month >= 2 && month <= 9
}

function normalizeSeasonMatch(match: SeasonFile['matches'][string][number], season: string): MatchInfo {
  return {
    kickoffTimezone: isBST(match.kickoff) ? 'BST' : 'GMT',
    competitionId: '8',
    period: match.period,
    matchWeek: match.matchweek,
    kickoff: match.kickoff,
    awayTeam: {
      score: match.awayTeam.score ?? 0,
      name: match.awayTeam.name,
      id: match.awayTeam.id,
      halfTimeScore: null as unknown as number,
      shortName: match.awayTeam.shortName,
      abbr: match.awayTeam.abbr,
      redCards: match.awayTeam.redCards,
    },
    competition: 'Premier League',
    clock: null as unknown as string,
    kickoffTimezoneString: 'Europe/London',
    homeTeam: {
      score: match.homeTeam.score ?? 0,
      name: match.homeTeam.name,
      id: match.homeTeam.id,
      halfTimeScore: null as unknown as number,
      shortName: match.homeTeam.shortName,
      abbr: match.homeTeam.abbr,
      redCards: match.homeTeam.redCards,
    },
    season,
    ground: match.ground as string,
    resultType: match.period === 'FullTime' ? 'NormalResult' : (null as unknown as string),
    matchId: match.matchId,
    attendance: match.attendance ?? undefined,
  }
}

export async function fetchSeasons(seasonsParam: string[] = AVAILABLE_SEASONS) {
  const missingSeasons = seasonsParam.filter((season) => seasons?.[season] === undefined)
  if (missingSeasons.length === 0) {
    return seasonsParam.reduce(
      (obj, cur) => {
        obj[cur] = seasons![cur]
        return obj
      },
      {} as Record<string, MatchInfo[]>,
    )
  }

  const existingSeasons = seasonsParam
    .filter((season) => seasons?.[season] !== undefined)
    .map((season) => [season, seasons[season]] as const)
  const responses = await Promise.all(missingSeasons.map((season) => axios(`${BASE_PATH}/${season}.json`)))
  const seasonResponses = responses
    .map((item) => {
      const data = item.data as Record<string, unknown>
      // New format: { season, matches: Record<string, SeasonMatch[]> }
      if (data.matches) {
        const file = data as unknown as SeasonFile
        return Object.values(file.matches)
          .flat()
          .map((m) => normalizeSeasonMatch(m, file.season.toString()))
          .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
      }
      // Legacy format: { season, competition, matchweeks: [{ matchweek, data: { data: MatchInfo[] } }] }
      const legacy = data as unknown as SeasonMatchesResponse
      return legacy.matchweeks.flatMap((mw) => mw.data.data).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    })
    .map((v, i) => [missingSeasons[i], v] as const)

  const matchesResponses: Record<string, MatchInfo[]> = existingSeasons.concat(seasonResponses).reduce(
    (obj, [season, matches]) => {
      obj[season] = matches
      return obj
    },
    {} as Record<string, MatchInfo[]>,
  )
  seasons = matchesResponses

  return matchesResponses
}

export async function fetchSeasonsAsRecord(seasonsParam: string[]) {
  const seasonMatches = await fetchSeasons(seasonsParam)

  return Object.entries(seasonMatches).reduce(
    (obj, [season, matches]) => {
      const matchesRecord = matches.reduce(
        (record, cur) => {
          record[cur.matchId] = cur
          return record
        },
        {} as Record<string, MatchInfo>,
      )
      obj[season] = matchesRecord

      return obj
    },
    {} as Record<string, Record<string, MatchInfo>>,
  )
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

export async function fetchMatchOfficialAssignments(
  seasonsParam: string[],
  rolesParam: string[],
): Promise<{
  perSeasonRecord: Record<string, MatchOfficiatingSeasonInfo>
  allSeasons: AllSeasonInfo
}> {
  const rolesKey = rolesParam.join(',')

  const missingSeasons = seasonsParam.filter((season) => matchOfficialAssignmentPerSeason[rolesKey]?.[season] === undefined)
  if (missingSeasons.length === 0) {
    return {
      allSeasons: await populateAllSeasonsRecord(seasonsParam, rolesParam),
      perSeasonRecord: matchOfficialAssignmentPerSeason[rolesKey],
    }
  }

  if (!matchOfficialAssignmentPerSeason[rolesKey]) {
    matchOfficialAssignmentPerSeason[rolesKey] = {}
  }

  for (const season of missingSeasons) {
    const response = await axios(`${BASE_PATH}/${season}-stats.json`)
    const teamStatRecapData = response.data as RawTeamStatRecapData

    if (!matchOfficialAssignmentPerSeason[rolesKey][season]) {
      matchOfficialAssignmentPerSeason[rolesKey][season] = {
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
    const assignmentCountAllSeasonPerRefereeRecord: Record<string, RefereeAdditionalInformation> = {}

    for (const team in teamStatRecapData.teams) {
      const officialAssignments = teamStatRecapData.teams[team]
      const effectiveOfficialAssignments: MatchOfficialAssignmentPerTeamData['referees'] = {}
      const assignmentCountForTeamPerReferee: Record<string, RefereeAdditionalInformation> = {}

      const officialNames = Object.keys(officialAssignments)
      for (const officialName of officialNames) {
        populateMatchOfficialInfo({
          officialName,
          rolePerRefereeRecord: officialAssignments,
          assignmentCountPerRefereeRecord: assignmentCountForTeamPerReferee,
          team,
          seasonMatchesStat: teamStatRecapData.matchStatRecord,
          roles: rolesParam,
        })

        effectiveOfficialAssignments[officialName] = {
          ...officialAssignments[officialName],
          ...assignmentCountForTeamPerReferee[officialName],
        }

        if (!assignmentCountAllSeasonPerRefereeRecord[officialName]) {
          assignmentCountAllSeasonPerRefereeRecord[officialName] = {
            wdl: [0, 0, 0],
            foulsPerRedCard: 0,
            foulsPerYellowCard: 0,
            score: 0,
          }
        }

        assignmentCountAllSeasonPerRefereeRecord[officialName].score += assignmentCountForTeamPerReferee[officialName].score
        assignmentCountAllSeasonPerRefereeRecord[officialName].wdl = assignmentCountForTeamPerReferee[officialName].wdl
      }

      matchOfficialAssignmentPerSeason[rolesKey][season].teamsRecord[team] = {
        name: team,
        abbr: teamRankByNameRecord[team].abbr,
        shortName: teamRankByNameRecord[team].shortName,
        referees: effectiveOfficialAssignments,
      }
    }

    matchOfficialAssignmentPerSeason[rolesKey][season].matchStatRecord = teamStatRecapData.matchStatRecord
    matchOfficialAssignmentPerSeason[rolesKey][season].assignmentCountPerRefereeRecord = assignmentCountAllSeasonPerRefereeRecord
  }

  return {
    allSeasons: await populateAllSeasonsRecord(seasonsParam, rolesParam),
    perSeasonRecord: matchOfficialAssignmentPerSeason[rolesKey],
  }
}

// Helper functions.

// First index is by roles param, second index is by seasons param.
const ALL_SEASONS_CACHE: Record<string, Record<string, AllSeasonInfo>> = {}

async function populateAllSeasonsRecord(seasonsParam: string[], rolesParam: string[]): Promise<AllSeasonInfo> {
  const rolesKey = rolesParam.join(',')
  const seasonsKey = seasonsParam.join(',')

  if (ALL_SEASONS_CACHE[rolesKey]?.[seasonsKey]) return ALL_SEASONS_CACHE[rolesKey][seasonsKey]

  const result: AllSeasonInfo = {
    officialNames: [],
    tableData: [],
  }
  const allSeasonAssignmentCountPerRefereeRecord: Record<string, number> = {}

  for (const season of seasonsParam) {
    const { assignmentCountPerRefereeRecord, matchStatRecord, teamsRecord } = matchOfficialAssignmentPerSeason[rolesKey][season]

    for (const officialName in assignmentCountPerRefereeRecord) {
      if (!allSeasonAssignmentCountPerRefereeRecord[officialName]) {
        allSeasonAssignmentCountPerRefereeRecord[officialName] = 0
      }

      allSeasonAssignmentCountPerRefereeRecord[officialName] += assignmentCountPerRefereeRecord[officialName].score
    }

    for (const teamName in teamsRecord) {
      const teamData = teamsRecord[teamName]

      for (const refereeName in teamData.referees) {
        populateMatchOfficialInfo({
          rolePerRefereeRecord: teamData.referees,
          officialName: refereeName,
          assignmentCountPerRefereeRecord,
          team: teamName,
          seasonMatchesStat: matchStatRecord,
          roles: rolesParam,
        })
      }
    }
  }

  const sortedOfficialNames = Object.entries(allSeasonAssignmentCountPerRefereeRecord)
    .filter((v) => v[1] > 0)
    .sort((a, b) => b[1] - a[1])
  const lastSeason = `${seasonsParam.at(-1)}`
  const tableData = await fetchSeasonTable(lastSeason)

  result.officialNames = sortedOfficialNames.map((item) => item[0])
  result.tableData = tableData.map((v) => ({
    name: v.name,
    abbr: v.abbr,
    referees: (() => {
      const effectiveOfficialAssignments: AllSeasonMatchOfficialAssignmentTableData['referees'] = {}
      let minPerOfficial = 999
      let maxPerOfficial = -999

      for (const [officialName] of sortedOfficialNames) {
        let total = 0

        for (const season of seasonsParam) {
          if (!effectiveOfficialAssignments[officialName]) {
            effectiveOfficialAssignments[officialName] = {
              totalScore: 0,
              background: 'black',
              perSeasonRecord: {},
            }
          }

          const current = matchOfficialAssignmentPerSeason[rolesKey][season].teamsRecord[v.name]?.referees[officialName]
          if (!current) continue

          if (!effectiveOfficialAssignments[officialName].perSeasonRecord[season]) {
            effectiveOfficialAssignments[officialName].perSeasonRecord[season] = {
              wdl: [0, 0, 0],
              foulsPerRedCard: 0,
              foulsPerYellowCard: 0,
              score: 0,
            }
          }

          effectiveOfficialAssignments[officialName].perSeasonRecord[season].score = current.score
          effectiveOfficialAssignments[officialName].perSeasonRecord[season].foulsPerRedCard = current.foulsPerRedCard
          effectiveOfficialAssignments[officialName].perSeasonRecord[season].foulsPerYellowCard = current.foulsPerYellowCard
          effectiveOfficialAssignments[officialName].perSeasonRecord[season].wdl = current.wdl
          total += current.score
        }

        if (total < minPerOfficial) {
          minPerOfficial = total
        }
        if (total > maxPerOfficial) {
          maxPerOfficial = total
        }

        effectiveOfficialAssignments[officialName].totalScore = total
      }

      for (const [officialName] of sortedOfficialNames) {
        const factor = 1 / (maxPerOfficial - minPerOfficial)
        const totalScore = effectiveOfficialAssignments[officialName].totalScore

        if (totalScore > 0) {
          effectiveOfficialAssignments[officialName].background = `rgba(0,255,0,${(totalScore - minPerOfficial) * factor * 0.8})`
        }
      }

      return effectiveOfficialAssignments
    })(),
    shortName: v.shortName,
  }))

  if (!ALL_SEASONS_CACHE[rolesKey]) {
    ALL_SEASONS_CACHE[rolesKey] = {}
  }
  ALL_SEASONS_CACHE[rolesKey][seasonsKey] = result

  return result
}

function populateMatchOfficialInfo({
  seasonMatchesStat,
  team,
  officialName,
  rolePerRefereeRecord,
  assignmentCountPerRefereeRecord,
  roles,
}: {
  seasonMatchesStat: RawTeamStatRecapData['matchStatRecord']
  rolePerRefereeRecord: Record<string, MatchOfficialTeamAssignmentData>
  team: string
  officialName: string
  assignmentCountPerRefereeRecord: Record<string, RefereeAdditionalInformation>
  roles: string[]
}) {
  if (!assignmentCountPerRefereeRecord[officialName]) {
    assignmentCountPerRefereeRecord[officialName] = {
      wdl: [0, 0, 0],
      foulsPerRedCard: 0,
      foulsPerYellowCard: 0,
      score: 0,
    }
  }

  let officialScoreRecord = 0
  let totalFouls = 0
  let totalRedCards = 0
  let totalYellowCards = 0
  let totalResults = {
    win: 0,
    draw: 0,
    loss: 0,
  }

  for (const side in rolePerRefereeRecord[officialName]) {
    const roleRecord = rolePerRefereeRecord[officialName][side as 'Home' | 'Away']
    for (const role in roleRecord) {
      if (!roles.includes(role)) continue

      const matchIds = roleRecord[role as keyof typeof roleRecord]

      for (const matchId of matchIds) {
        const { fkFoulLost, penaltyConceded, totalYelCard, totalRedCard, goals, goalsConceded } = seasonMatchesStat[matchId][team]
        const { teamResult } = getScoreResult('home', [goals, goalsConceded])

        totalFouls += fkFoulLost + penaltyConceded
        totalYellowCards += totalYelCard
        totalRedCards += totalRedCard
        officialScoreRecord += 1

        totalResults[teamResult]++
      }
    }
  }

  assignmentCountPerRefereeRecord[officialName].score = officialScoreRecord
  assignmentCountPerRefereeRecord[officialName].foulsPerRedCard = totalRedCards ? truncateDecimals(totalFouls / totalRedCards) : -1
  assignmentCountPerRefereeRecord[officialName].foulsPerYellowCard = totalYellowCards ? truncateDecimals(totalFouls / totalYellowCards) : -1
  assignmentCountPerRefereeRecord[officialName].wdl = [totalResults.win, totalResults.draw, totalResults.loss]
}
