import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import type { FullMatchInfo, SeasonTableData, Team } from '@/types'
import { fetchMatchOfficialAssignments } from '@/utils/seasons-fetcher'
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
  key: string
  gameweek: string
  isRescheduled: boolean
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

  const currentSeasonOfficialAssignments = await fetchMatchOfficialAssignments(CURRENT_SEASON)

  return { teams: teamsArray, currentSeasonOfficialAssignments }
}

export default function MatchOfficialAssignments() {
  const { teams, currentSeasonOfficialAssignments } = useLoaderData<typeof clientLoader>()
  const [, setSearchParams] = useSearchParams()
  const [selectedTeam, setSelectedTeam] = useState('Arsenal')
  const isMobile = useIsMobile()

  return (
    <>
      <title>Match Official Assignments | Premier League Form Comparison</title>

      <h1 className="text-3xl font-bold mb-4">Match Official Assignments</h1>
      <p className="text-md text-gray-500 mb-4">
        Compare the match official assignments between clubs. Get some insights on the match results on the officials, but do remember that
        correlation is not causation. Only referees, VAR, and assistant VAR roles are counted.
      </p>

      <div className="flex flex-col gap-y-4">
        <div className="flex gap-2 flex-col md:flex-row">
          <Select
            value={selectedTeam}
            onValueChange={(value) => {
              setSelectedTeam(value)
            }}
          >
            <SelectTrigger className="w-full md:w-[50%]" id="select-team-button">
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
            id="add-team-button"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                {currentSeasonOfficialAssignments.officialNames.map((name) => (
                  <TableHead>{name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentSeasonOfficialAssignments.tableData.map((row) => (
                <TableRow>
                  <TableCell>{isMobile ? row.abbr : row.name}</TableCell>
                  {currentSeasonOfficialAssignments.officialNames.map((name) => (
                    <TableCell
                      style={{
                        background: row.referees[name]?.background ?? 'black',
                      }}
                    >
                      {row.referees[name]?.score ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
