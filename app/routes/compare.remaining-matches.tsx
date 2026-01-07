import { Button } from '@/components/ui/button'
import { HybridTooltip, HybridTooltipContent, HybridTooltipTrigger } from '@/components/ui/hybrid-tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import type { FullMatchInfo, MatchInfo, SeasonTableData, Team } from '@/types'
import { formatFdr, getDifficultyRating, getFdrColorClass, getTeamLeaguePosition } from '@/utils/difficulty-rating'
import { getAnchorKeyFromMatch, getAnchorKeyFromString, getEssentialMatchInfo, getSeasonShortText } from '@/utils/match'
import { fetchSeasons, fetchSeasonsTable } from '@/utils/seasons-fetcher'
import { getEquivalentTeamFromAnotherSeason } from '@/utils/team-replacement'
import clsx from 'clsx'
import { Info, X } from 'lucide-react'
import { useState } from 'react'
import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/compare.remaining-matches'

// { "2024": { "Arsenal vs Tottenham": FullMatchInfo } }.
type MatchAnchorRecord = Record<string, Record<string, FullMatchInfo>>

interface MatchesAcrossSeasons {
  // { "16": { "Arsenal": FullMatchInfo | null } }
  matchesByGameweekByTeamRecord: Record<string, Record<string, FullMatchInfo | null>>
  comparison: MatchAnchorRecord
  currentSeasonTable: SeasonTableData[]
}

interface TableData {
  gameweek: number
  teamMatchRecord: Record<
    string,
    {
      opponent: Team
      venue: string
      pastTwoSeasonsMatchInfo: [FullMatchInfo, FullMatchInfo]
      difficultyRating: number
    } | null
  >
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams
  const teamsString = params.getAll('teams') ?? []
  const teamsArray = teamsString.filter((team) => TEAMS_PER_SEASON[CURRENT_SEASON].includes(team))

  const matchesResponses = await fetchSeasons()
  const currentSeasonTable = await fetchSeasonsTable(CURRENT_SEASON)
  const matchesAcrossSeasons = getMatchesAcrossSeasons(teamsArray, matchesResponses, currentSeasonTable)

  return { teams: teamsArray, matchesAcrossSeasons }
}

export default function RemainingMatches() {
  const { teams, matchesAcrossSeasons } = useLoaderData<typeof clientLoader>()
  const [, setSearchParams] = useSearchParams()
  const [selectedTeam, setSelectedTeam] = useState('Arsenal')

  return (
    <>
      <title>Compare Remaining Matches | Premier League Form Comparison</title>

      <h1 className="text-3xl font-bold mb-4">Remaining Matches</h1>
      <p className="text-md text-gray-500 mb-8">
        Compare the remaining matches of the current Premier League teams and compare each fixture against previous seasons.
      </p>

      <div className="flex flex-col gap-y-4">
        <div className="flex gap-2 flex-col md:flex-row">
          <Select
            value={selectedTeam}
            onValueChange={(value) => {
              setSelectedTeam(value)
            }}
          >
            <SelectTrigger className="w-full md:w-[50%]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              {TEAMS_PER_SEASON[CURRENT_SEASON].map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => {
              if (teams.includes(selectedTeam)) {
                // TODO: add alert.
                return
              }

              setSearchParams((prev) => {
                const newSearchParams = new URLSearchParams(prev)
                newSearchParams.append('teams', selectedTeam)
                return newSearchParams
              })
            }}
          >
            Add to table
          </Button>
        </div>

        <div>
          {teams.length === 0 ? (
            <div>Select 1 or more teams to compare the remaining fixtures.</div>
          ) : (
            <RemainingMatchesTable teams={teams} matchesAcrossSeasons={matchesAcrossSeasons} />
          )}
        </div>
      </div>
    </>
  )
}

function RemainingMatchesTable({ teams, matchesAcrossSeasons }: { matchesAcrossSeasons: MatchesAcrossSeasons; teams: string[] }) {
  const [, setSearchParams] = useSearchParams()
  const isMobile = useIsMobile()
  // Each array element represents a gameweek, in each item is a record for each team's match.
  const data: Array<TableData> = []
  const gameWeeks = Object.keys(matchesAcrossSeasons.matchesByGameweekByTeamRecord)

  for (let i = 0; i < gameWeeks.length; i++) {
    const gameweek = gameWeeks[i]
    const matchesByTeamRecord = matchesAcrossSeasons.matchesByGameweekByTeamRecord[gameweek]
    const teams = Object.keys(matchesByTeamRecord)

    let existingData = data[i]
    if (!existingData) {
      existingData = {
        gameweek: Number(gameweek),
        teamMatchRecord: {},
      }
      data.push(existingData)
    }

    for (const team of teams) {
      const teamMatch = matchesByTeamRecord[team]
      if (teamMatch === null) {
        existingData.teamMatchRecord[team] = null
        continue
      }

      const teamInPreviousSeason = getEquivalentTeamFromAnotherSeason(
        teamMatch.opponent.name,
        Number(CURRENT_SEASON),
        Number(CURRENT_SEASON) - 1,
      )
      const teamInTwoSeasonsAgo = getEquivalentTeamFromAnotherSeason(
        teamMatch.opponent.name,
        Number(CURRENT_SEASON),
        Number(CURRENT_SEASON) - 2,
      )

      // Calculate FDR based on opponent's current league position
      const opponentPosition = getTeamLeaguePosition(teamMatch.opponent.name, matchesAcrossSeasons.currentSeasonTable)
      const difficultyRating = opponentPosition !== undefined ? getDifficultyRating(opponentPosition, teamMatch.venue) : 3 // Default to mid-tier if not found

      existingData.teamMatchRecord[team] = {
        opponent: teamMatch.opponent,
        venue: teamMatch.venue,
        pastTwoSeasonsMatchInfo: [
          getMatchFromOtherSeason(
            matchesAcrossSeasons.comparison[Number(CURRENT_SEASON) - 1],
            Number(CURRENT_SEASON),
            Number(CURRENT_SEASON) - 1,
            teamInPreviousSeason,
            team,
            teamMatch.venue,
          ),
          getMatchFromOtherSeason(
            matchesAcrossSeasons.comparison[Number(CURRENT_SEASON) - 2],
            Number(CURRENT_SEASON),
            Number(CURRENT_SEASON) - 2,
            teamInTwoSeasonsAgo,
            team,
            teamMatch.venue,
          ),
        ],
        difficultyRating,
      }
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>GW</TableHead>
          {teams.map((team) => (
            <TableHead key={team} className="text-center">
              <div className="flex gap-x-2 justify-center items-center">
                <div>{team}</div>

                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full w-5 h-5"
                  aria-label="Remove column"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const newSearchParams = new URLSearchParams(prev)
                      const teamsParam = newSearchParams.getAll('teams') ?? []
                      teamsParam.splice(teamsParam.indexOf(team), 1)
                      newSearchParams.delete('teams')

                      for (const team of teamsParam) {
                        newSearchParams.append('teams', team)
                      }

                      return newSearchParams
                    })
                  }}
                >
                  <X className="w-3! h-3!" />
                </Button>
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          return (
            <TableRow key={row.gameweek}>
              <TableCell>{row.gameweek}</TableCell>
              {teams.map((team, idx) => {
                const teamMatchInfo = row.teamMatchRecord[team]
                if (!teamMatchInfo) {
                  return (
                    <TableCell key={idx} className="text-center">
                      -
                    </TableCell>
                  )
                }

                const [lastSeasonMatch, twoSeasonsAgoMatch] = teamMatchInfo.pastTwoSeasonsMatchInfo

                return (
                  <TableCell key={idx} className="text-center">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-x-2 justify-center items-center">
                        <div>
                          {isMobile ? teamMatchInfo.opponent.shortName : teamMatchInfo.opponent.name}{' '}
                          <span className="font-bold">({teamMatchInfo.venue === 'home' ? 'H' : 'A'})</span>
                        </div>
                        <div className={clsx('px-2 py-1 rounded text-xs font-semibold', getFdrColorClass(teamMatchInfo.difficultyRating))}>
                          FDR {formatFdr(teamMatchInfo.difficultyRating)}
                        </div>
                      </div>
                      <div className="flex justify-center items-center">
                        <ul className="flex gap-x-2">
                          <li>
                            <ScoreTag
                              match={lastSeasonMatch}
                              currentSeasonOpponent={teamMatchInfo.opponent.name}
                              currentColumnTeam={team}
                            />
                          </li>
                          <li>
                            <ScoreTag
                              match={twoSeasonsAgoMatch}
                              currentSeasonOpponent={teamMatchInfo.opponent.name}
                              currentColumnTeam={team}
                            />
                          </li>
                        </ul>
                      </div>
                    </div>
                  </TableCell>
                )
              })}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function ScoreTag({
  match,
  currentSeasonOpponent,
  currentColumnTeam,
}: {
  match: FullMatchInfo
  currentSeasonOpponent: string
  currentColumnTeam: string
}) {
  return (
    <div className={clsx(match.color, 'p-1 py-0.5 rounded text-sm flex items-center justify-center gap-x-1')}>
      <div>
        {match.homeTeam.score}-{match.awayTeam.score} ({getSeasonShortText(match.season)})
      </div>
      {currentSeasonOpponent !== match.opponent.name && currentColumnTeam !== match.opponent.name ? (
        <HybridTooltip>
          <HybridTooltipTrigger asChild>
            <Info className="inline-block w-4 h-4" aria-label={`(equivalent team: ${match.opponent})`} />
          </HybridTooltipTrigger>
          <HybridTooltipContent>{match.opponent.name}</HybridTooltipContent>
        </HybridTooltip>
      ) : null}
    </div>
  )
}

function fillRemainingMatchAnchorRecord(record: MatchAnchorRecord, seasonMatches: MatchInfo[], team: string, year: string) {
  let seasonRecord = record[year]
  if (!seasonRecord) {
    record[year] = {}
    seasonRecord = record[year]
  }

  for (const match of seasonMatches) {
    const anchorKey = getAnchorKeyFromMatch(match, team)
    seasonRecord[anchorKey] = {
      ...match,
      ...getEssentialMatchInfo(match, team),
    }
  }
}

function getMatchFromOtherSeason(
  record: Record<string, FullMatchInfo>,
  year: number,
  targetYear: number,
  opponent: string,
  team: string,
  venue: string,
) {
  const teamFromOtherSeason = getEquivalentTeamFromAnotherSeason(opponent, year, targetYear)
  let anchorKey: string

  if (venue === 'home') {
    anchorKey = getAnchorKeyFromString(team, teamFromOtherSeason, team)
  } else {
    anchorKey = getAnchorKeyFromString(teamFromOtherSeason, team, team)
  }

  return record[anchorKey]
}

function getMatchesAcrossSeasons(
  teams: string[],
  matchesResponses: Record<string, MatchInfo[]>,
  currentSeasonTable: SeasonTableData[],
): MatchesAcrossSeasons {
  const matchesByGameweekByTeamRecord: MatchesAcrossSeasons['matchesByGameweekByTeamRecord'] = {}
  const comparison: MatchAnchorRecord = {}
  let previousMatchweek = -1

  for (const match of matchesResponses[CURRENT_SEASON]) {
    const { homeTeam, awayTeam, matchWeek } = match

    if (!teams.includes(homeTeam.name) && !teams.includes(awayTeam.name)) continue
    if (!matchesByGameweekByTeamRecord[matchWeek]) {
      matchesByGameweekByTeamRecord[matchWeek] = {}
    }

    const iteratedTeams = [homeTeam.name, awayTeam.name].filter((team) => teams.includes(team))
    for (const team of iteratedTeams) {
      if (match.period === 'FullTime') {
        matchesByGameweekByTeamRecord[match.matchWeek][team] = null
        continue
      }

      matchesByGameweekByTeamRecord[match.matchWeek][team] = {
        ...match,
        ...getEssentialMatchInfo(match, team),
      }
    }

    if (previousMatchweek !== -1 && previousMatchweek !== matchWeek) {
      const isAllNull = Object.values(matchesByGameweekByTeamRecord[previousMatchweek]).every((match) => match === null)
      if (isAllNull) {
        delete matchesByGameweekByTeamRecord[previousMatchweek]
      }
    }

    previousMatchweek = matchWeek
  }

  for (const team of teams) {
    const previousYears = Object.keys(matchesResponses).filter((year) => year !== CURRENT_SEASON)
    for (const previousYear of previousYears) {
      fillRemainingMatchAnchorRecord(
        comparison,
        matchesResponses[previousYear].filter((match) => match.homeTeam.name === team || match.awayTeam.name === team),
        team,
        previousYear,
      )
    }
  }

  return {
    matchesByGameweekByTeamRecord,
    comparison,
    currentSeasonTable,
  }
}
