import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import axios from 'axios'
import clsx from 'clsx'
import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { TEAMS_PER_SEASON } from './constants'
import { MatchInfo, SeasonMatchesResponse } from './types'
import { getEquivalentTeamFromAnotherSeason } from './utils/team-replacement'

interface FullMatchInfo extends MatchInfo {
  color: string
  opponent: string
  teamResult: string
  venue: string
}

// { "Arsenal vs Tottenham": FullMatchInfo }.
type MatchAnchorRecord = Record<string, FullMatchInfo>

interface MatchesState {
  matches: FullMatchInfo[]
  comparison: MatchAnchorRecord
}

interface TableData {
  gameweek: number
  opponent: string
  period: string
  venue: string
  comparedSeasonMatchInfo: FullMatchInfo | undefined
  anchorSeasonMatchInfo: FullMatchInfo
  pointDiff: string
  aggPointDiff: string
}

const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? ''

export function App() {
  const [team, setTeam] = useState('Arsenal')
  const [anchorYear, setAnchorYear] = useState<string | undefined>('2025')
  const [comparedYear, setComparedYear] = useState<string | undefined>(undefined)
  const [seasonMatchesResponses, setSeasonMatchesResponses] = useState<Record<string, MatchInfo[]> | undefined>(undefined)
  const [anchorMatches, setAnchorMatches] = useState<MatchesState | undefined>(undefined)
  const hasFetched = useRef(false)

  useEffect(() => {
    async function fetchData() {
      if (hasFetched.current) return
      hasFetched.current = true

      const responses = await Promise.all([
        axios(`${BASE_PATH}/2025.json`),
        axios(`${BASE_PATH}/2024.json`),
        axios(`${BASE_PATH}/2023.json`),
      ])
      const [season2025Response, season2024Response, season2023Response] = responses.map((item) =>
        (item.data as SeasonMatchesResponse).matchweeks.flatMap((mw) => mw.data.data),
      )

      const matchesResponses: Record<string, MatchInfo[]> = {
        '2025': season2025Response,
        '2024': season2024Response,
        '2023': season2023Response,
      }

      setSeasonMatchesResponses(matchesResponses)
    }

    fetchData()
  }, [anchorYear, comparedYear, team])

  const yearOptions = getTeamYearComparisonOptions(team)

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="container mx-auto py-8 px-4 flex-1">
        <h1 className="text-4xl font-bold mb-4">Premier League Form Comparison</h1>
        <p className="text-md text-gray-500 mb-8">
          Compare the current season's Premier League team's form with the same fixtures from previous seasons, adjusting for promoted and
          relegated teams.
        </p>

        <div className="flex flex-col gap-y-4">
          <div className="flex gap-2 flex-col md:flex-row">
            <Select
              value={team}
              onValueChange={(value) => {
                setTeam(value)
                setAnchorMatches(getAnchorMatchesForTeam(value, seasonMatchesResponses, anchorYear, comparedYear))
              }}
            >
              <SelectTrigger className="w-full md:w-[50%]">
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
              <div className="flex gap-x-2 w-full md:w-[50%]">
                <Select
                  value={anchorYear}
                  onValueChange={(value) => {
                    setAnchorYear(value)
                    setAnchorMatches(getAnchorMatchesForTeam(team, seasonMatchesResponses, value, comparedYear))
                  }}
                >
                  <SelectTrigger className="w-[50%]">
                    <SelectValue placeholder="Anchor year" />
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
                  <SelectTrigger className="w-[50%]">
                    <SelectValue placeholder="Compared year" />
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

          <div>
            {yearOptions.length < 2 ? (
              <div>
                Your selected team has not been in at least 2 Premier League seasons in the past {Object.keys(TEAMS_PER_SEASON).length}{' '}
                years.
              </div>
            ) : !anchorYear || !comparedYear || !anchorMatches ? (
              <div className="italic text-center">Select two different seasons to compare the form.</div>
            ) : (
              <ComparisonTable anchorMatches={anchorMatches} anchorYear={anchorYear} comparedYear={comparedYear} team={team} />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-300 p-4 text-xs text-center">
        GitHub repository: <a href="https://github.com/imballinst/pl-form-comparison">imballinst/pl-form-comparison</a>. Original idea by{' '}
        <a href="https://x.com/DrRitzyy">DrRitzyy on Twitter</a>.
      </footer>
    </div>
  )
}

function ComparisonTable({
  comparedYear,
  anchorYear,
  team,
  anchorMatches,
}: {
  comparedYear: string
  anchorYear: string
  team: string
  anchorMatches: MatchesState
}) {
  const data: TableData[] = []
  let aggPointDiff = 0

  anchorMatches.matches.forEach((match, gameweek) => {
    const { opponent, venue } = getEssentialMatchInfo(match, team)
    const comparedSeason = getMatchFromOtherSeason(
      anchorMatches.comparison,
      Number(anchorYear),
      Number(comparedYear),
      opponent,
      team,
      venue,
    )
    let pointDiff = 0

    if (match.period === 'FullTime') {
      const pointResult = getNumberOfPointFromResult(match.teamResult)
      pointDiff = pointResult

      if (comparedSeason) {
        pointDiff = pointDiff - getNumberOfPointFromResult(comparedSeason.teamResult)
      }

      aggPointDiff += pointDiff
    }

    data.push({
      gameweek: gameweek + 1,
      opponent: match.opponent,
      period: match.period,
      venue: match.venue[0].toUpperCase() + match.venue.slice(1),
      comparedSeasonMatchInfo: comparedSeason,
      anchorSeasonMatchInfo: match,
      pointDiff: pointDiff > 0 ? `+${pointDiff}` : pointDiff.toString(),
      aggPointDiff: aggPointDiff > 0 ? `+${aggPointDiff}` : aggPointDiff.toString(),
    })
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>GW</TableHead>
          <TableHead>Opponent</TableHead>
          <TableHead>Venue</TableHead>
          <TableHead className="text-center min-w-[70px]">{getSeasonShortText(comparedYear)}</TableHead>
          <TableHead className="text-center min-w-[70px]">{getSeasonShortText(anchorYear)}</TableHead>
          <TableHead className="text-right">+/-</TableHead>
          <TableHead className="text-right">Agg</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, idx) => {
          return (
            <TableRow key={row.gameweek}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell>{row.opponent}</TableCell>
              <TableCell>{row.venue}</TableCell>
              <TableCell className={clsx(row.comparedSeasonMatchInfo?.color, 'text-center')}>
                <div className="inline-flex justify-center items-center relative">
                  {row.comparedSeasonMatchInfo?.homeTeam.score}-{row.comparedSeasonMatchInfo?.awayTeam.score}
                  <PreviousTeamThatGotRelegated match={row.comparedSeasonMatchInfo} opponent={row.opponent} />
                </div>
              </TableCell>

              {row.period === 'FullTime' ? (
                <>
                  <TableCell className={clsx(row.anchorSeasonMatchInfo.color, 'text-center')}>
                    {row.anchorSeasonMatchInfo.homeTeam.score}-{row.anchorSeasonMatchInfo.awayTeam.score}
                  </TableCell>
                  <TableCell className="text-right">{row.pointDiff}</TableCell>
                  <TableCell className="text-right">{row.aggPointDiff}</TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-center">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                </>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function PreviousTeamThatGotRelegated({ match, opponent }: { match: FullMatchInfo | undefined; opponent: string }) {
  if (!match || match.opponent === opponent) {
    return undefined
  }

  return (
    <div className="absolute -right-5 top-0.5 flex">
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="inline-block w-4 h-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>{match.opponent}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function getScoreResult(position: string, score: [number, number]) {
  if (score[0] === score[1]) {
    return { color: 'bg-gray-400', teamResult: 'draw' }
  }

  const isHome = position === 'home'
  const isWin = isHome ? score[0] > score[1] : score[1] > score[0]

  if (isWin) {
    return {
      color: 'bg-green-400',
      teamResult: 'win',
    }
  }

  return {
    color: 'bg-red-400',
    teamResult: 'loss',
  }
}

function getEssentialMatchInfo(match: MatchInfo, team: string) {
  const isHome = match.homeTeam.name === team
  const score = [match.homeTeam.score, match.awayTeam.score] satisfies [number, number]
  let opponent: string
  let venue: 'home' | 'away'

  if (isHome) {
    opponent = match.awayTeam.name
    venue = 'home'
  } else {
    opponent = match.homeTeam.name
    venue = 'away'
  }

  const scoreColorAndResult = getScoreResult(venue, score)

  return { opponent, venue, ...scoreColorAndResult }
}

function getAnchorKeyFromMatch(match: MatchInfo) {
  return getAnchorKeyFromString(match.homeTeam.name, match.awayTeam.name)
}

function getAnchorKeyFromString(home: string, away: string) {
  return [home, away].join(' vs ')
}

function fillMatchAnchorRecord(record: MatchAnchorRecord, seasonMatches: MatchInfo[], team: string) {
  for (const match of seasonMatches) {
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
  const teamFromOtherSeason = getEquivalentTeamFromAnotherSeason(opponent, year, targetYear)
  let anchorKey: string

  if (venue === 'home') {
    anchorKey = getAnchorKeyFromString(team, teamFromOtherSeason)
  } else {
    anchorKey = getAnchorKeyFromString(teamFromOtherSeason, team)
  }

  if (!record[anchorKey]) {
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
  matchesResponses: Record<string, MatchInfo[]> | undefined,
  anchorYear: string | undefined,
  comparedYear: string | undefined,
): MatchesState | undefined {
  if (!anchorYear || !comparedYear || !matchesResponses) {
    return undefined
  }

  const comparison: MatchAnchorRecord = {}
  fillMatchAnchorRecord(
    comparison,
    matchesResponses[comparedYear].filter((match) => match.homeTeam.name === team || match.awayTeam.name === team),
    team,
  )

  const matches: FullMatchInfo[] = []
  for (const match of matchesResponses[anchorYear]) {
    if (match.homeTeam.name !== team && match.awayTeam.name !== team) continue
    matches.push({
      ...match,
      ...getEssentialMatchInfo(match, team),
    })
  }

  return {
    matches,
    comparison,
  }
}

function getSeasonShortText(year: string) {
  return `${year.slice(2)}/${(Number(year) + 1).toString().slice(2)}`
}

function getNumberOfPointFromResult(result: string) {
  if (result === 'win') return 3
  if (result === 'draw') return 1
  return 0
}
