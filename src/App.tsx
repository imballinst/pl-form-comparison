import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import axios from 'axios'
import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { TEAMS_PER_SEASON } from './constants'
import { MatchInfo, SeasonMatchesResponse } from './types'
import { getEquivalentTeamFromAnotherSeason } from './utils/team-replacement'

interface FullMatchInfo extends MatchInfo {
  color: string
  opponent: string
  venue: string
}

// { "Arsenal vs Tottenham": FullMatchInfo }.
type MatchAnchorRecord = Record<string, FullMatchInfo>

interface MatchesState {
  matches: FullMatchInfo[]
  comparison: MatchAnchorRecord
}

export function App() {
  const [team, setTeam] = useState('Arsenal')
  const [anchorYear, setAnchorYear] = useState<string | undefined>('2025')
  const [comparedYear, setComparedYear] = useState<string | undefined>(undefined)
  const [seasonMatchesResponses, setSeasonMatchesResponses] = useState<Record<string, FullMatchInfo[]> | undefined>(undefined)
  const [anchorMatches, setAnchorMatches] = useState<MatchesState | undefined>(undefined)
  const hasFetched = useRef(false)

  useEffect(() => {
    async function fetchData() {
      if (hasFetched.current) return
      hasFetched.current = true

      const responses = await Promise.all([axios(`/2025.json`), axios(`/2024.json`), axios(`/2023.json`)])
      const [season2025Response, season2024Response, season2023Response] = responses.map((item) =>
        (item.data as SeasonMatchesResponse).matchweeks.flatMap((mw) => {
          const fullMatchInfos: FullMatchInfo[] = []
          for (const match of mw.data.data) {
            if (match.homeTeam.name !== team && match.awayTeam.name !== team) continue

            fullMatchInfos.push({ ...match, ...getEssentialMatchInfo(match, team) })
          }

          return fullMatchInfos
        }),
      )

      const matchesResponses: Record<string, FullMatchInfo[]> = {
        '2025': season2025Response,
        '2024': season2024Response,
        '2023': season2023Response,
      }

      setSeasonMatchesResponses(matchesResponses)
      setAnchorMatches(getAnchorMatchesForTeam(team, matchesResponses, anchorYear, comparedYear))
    }

    fetchData()
  }, [anchorYear, comparedYear, team])

  const yearOptions = getTeamYearComparisonOptions(team)
  console.info(team, anchorYear, comparedYear, anchorMatches)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto py-12">
        <h1 className="text-4xl font-bold mb-8">Premier League Form Comparison</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Compare the current season's Premier League team's form with the same fixtures from previous seasons, adjusting for promoted and
          relegated teams.
        </p>

        <div className="flex gap-x-2">
          <Select
            value={team}
            onValueChange={(value) => {
              setTeam(value)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              {TEAMS_PER_SEASON['2025'].map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {yearOptions.length > 2 && (
            <div className="flex gap-x-2">
              <Select
                value={anchorYear}
                onValueChange={(value) => {
                  setAnchorYear(value)
                  setAnchorMatches(getAnchorMatchesForTeam(team, seasonMatchesResponses, value, comparedYear))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={comparedYear}
                onValueChange={(value) => {
                  setComparedYear(value)
                  setAnchorMatches(getAnchorMatchesForTeam(team, seasonMatchesResponses, anchorYear, value))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {yearOptions.length < 2 ? (
          <div>
            Your selected team has not been in at least 2 Premier League seasons in the past {Object.keys(TEAMS_PER_SEASON).length} years.
          </div>
        ) : !anchorYear || !comparedYear || !anchorMatches ? (
          <div>Select two different seasons to compare the form.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GW</TableHead>
                <TableHead>Opponent</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>24/25</TableHead>
                <TableHead>25/26</TableHead>
                <TableHead>+/-</TableHead>
                <TableHead>Agg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anchorMatches.matches.map((match, idx) => {
                const { opponent, venue } = getEssentialMatchInfo(match, team)
                const comparedSeason = getMatchFromOtherSeason(
                  anchorMatches.comparison,
                  Number(anchorYear),
                  Number(comparedYear),
                  opponent,
                  team,
                  venue,
                )

                return (
                  <TableRow key={match.matchId}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{match.opponent}</TableCell>
                    <TableCell>{match.venue}</TableCell>
                    <TableCell className={comparedSeason?.color}>
                      <div>
                        <div>
                          {comparedSeason?.homeTeam.score} - {comparedSeason?.awayTeam.score}
                        </div>
                        <PreviousTeamThatGotRelegated match={comparedSeason} opponent={opponent} />
                      </div>
                    </TableCell>
                    <TableCell className={match.color}>
                      {match.homeTeam.score} - {match.awayTeam.score}
                    </TableCell>
                    <TableCell>TBD</TableCell>
                    <TableCell>TBD</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </main>
    </div>
  )
}

function PreviousTeamThatGotRelegated({ match, opponent }: { match: FullMatchInfo | undefined; opponent: string }) {
  if (!match || match.opponent === opponent) {
    return undefined
  }

  return (
    <div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="inline-block w-4 h-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>{match.opponent}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function getScoreColor(position: string, score: [number, number]) {
  if (score[0] === score[1]) {
    return 'bg-gray-400'
  }

  const isHome = position === 'home'
  const isWin = isHome ? score[0] > score[1] : score[1] > score[0]

  return isWin ? 'bg-green-400' : 'bg-red-400'
}

function getEssentialMatchInfo(match: MatchInfo, team: string) {
  const isHome = match.homeTeam.name === team
  const score = [match.homeTeam.score, match.awayTeam.score] satisfies [number, number]
  let opponent: string
  let color: string

  if (isHome) {
    opponent = match.awayTeam.name
    color = getScoreColor('home', score)
  } else {
    opponent = match.homeTeam.name
    color = getScoreColor('away', score)
  }

  return { opponent, color, venue: isHome ? 'home' : 'away' }
}

function getAnchorKeyFromMatch(match: MatchInfo) {
  return getAnchorKeyFromString(match.homeTeam.name, match.awayTeam.name)
}

function getAnchorKeyFromString(home: string, away: string) {
  return [home, away].join(' vs ')
}

function fillMatchAnchorRecord(record: MatchAnchorRecord, seasonMatches: MatchInfo[], team: string) {
  for (const match of seasonMatches) {
    if (match.homeTeam.name !== team && match.awayTeam.name !== team) continue

    const anchorKey = getAnchorKeyFromMatch(match)
    record[anchorKey] = {
      ...match,
      ...getEssentialMatchInfo(match, team),
    }
  }
}

function getMatchFromOtherSeason(
  record: MatchAnchorRecord,
  year: number,
  targetYear: number,
  opponent: string,
  team: string,
  venue: string,
) {
  const teamFromOtherSeason = getEquivalentTeamFromAnotherSeason(opponent, targetYear, year)
  let anchorKey: string

  if (venue === 'home') {
    anchorKey = getAnchorKeyFromString(team, teamFromOtherSeason)
  } else {
    anchorKey = getAnchorKeyFromString(teamFromOtherSeason, team)
  }

  if (!record[anchorKey]) {
    console.info(opponent, teamFromOtherSeason, getEquivalentTeamFromAnotherSeason(opponent, year, targetYear))
    return undefined
  }

  return record[anchorKey]
}

function getTeamYearComparisonOptions(team: string) {
  const options: string[] = []
  const seasons = Object.keys(TEAMS_PER_SEASON).sort((a, b) => Number(b) - Number(a))

  for (const year of seasons) {
    if (TEAMS_PER_SEASON[year].includes(team)) {
      options.push(year)
    }
  }

  return options
}

function getAnchorMatchesForTeam(
  team: string,
  matchesResponses: Record<string, FullMatchInfo[]> | undefined,
  anchorYear: string | undefined,
  comparedYear: string | undefined,
) {
  console.info(anchorYear, comparedYear, matchesResponses)
  if (!anchorYear || !comparedYear || !matchesResponses) {
    return undefined
  }

  const comparison: MatchAnchorRecord = {}
  fillMatchAnchorRecord(comparison, matchesResponses[comparedYear], team)

  return {
    matches: matchesResponses[anchorYear],
    comparison,
  }
}
