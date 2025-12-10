import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAnchorKeyFromMatch, getAnchorKeyFromString, getEssentialMatchInfo } from '@/utils/match'
import { fetchSeasons } from '@/utils/seasons-fetcher'
import clsx from 'clsx'
import { Info } from 'lucide-react'
import { LoaderFunctionArgs, useLoaderData, useSearchParams } from 'react-router'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '../constants'
import { FullMatchInfo, MatchInfo } from '../types'
import { getEquivalentTeamFromAnotherSeason } from '../utils/team-replacement'

// { "Arsenal vs Tottenham": FullMatchInfo }.
type MatchAnchorRecord = Record<string, FullMatchInfo>

interface MatchesAcrossSeasons {
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

export async function resultComparisonBySeasonLoader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams
  let team = params.get('team') ?? 'Arsenal'
  if (!TEAMS_PER_SEASON[CURRENT_SEASON].includes(team)) {
    team = 'Arsenal'
  }

  let anchorYear = params.get('anchorYear') ?? CURRENT_SEASON
  if (!TEAMS_PER_SEASON[anchorYear]) {
    anchorYear = CURRENT_SEASON
  }

  let comparedYear = params.get('comparedYear') ?? undefined
  if (comparedYear && !TEAMS_PER_SEASON[comparedYear]) {
    comparedYear = undefined
  }

  const matchesResponses = await fetchSeasons()
  const anchorMatches = getAnchorMatchesForTeam(team, matchesResponses, anchorYear, comparedYear)

  return { team, anchorYear, comparedYear, anchorMatches }
}

export function ResultComparisonBySeason() {
  const { team, anchorMatches, anchorYear, comparedYear } = useLoaderData<typeof resultComparisonBySeasonLoader>()
  const yearOptions = getTeamYearComparisonOptions(team)
  const [, setSearchParams] = useSearchParams()

  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Form Comparison</h1>
      <p className="text-md text-gray-500 mb-8">
        Compare the current season's Premier League team's form with the same fixtures from previous seasons, adjusting for promoted and
        relegated teams.
      </p>

      <div className="flex flex-col gap-y-4">
        <div className="flex gap-2 flex-col md:flex-row">
          <Select
            defaultValue={team}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                const newSearchParams = new URLSearchParams(prev)
                newSearchParams.set('team', value)
                return newSearchParams
              })
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

          {yearOptions.length > 2 && (
            <div className="flex gap-x-2 w-full md:w-[50%]">
              <Select
                defaultValue={anchorYear}
                onValueChange={(value) => {
                  setSearchParams((prev) => {
                    const newSearchParams = new URLSearchParams(prev)
                    newSearchParams.set('anchorYear', value)
                    return newSearchParams
                  })
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
                defaultValue={comparedYear}
                onValueChange={(value) => {
                  setSearchParams((prev) => {
                    const newSearchParams = new URLSearchParams(prev)
                    newSearchParams.set('comparedYear', value)
                    return newSearchParams
                  })
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
              Your selected team has not been in at least 2 Premier League seasons in the past {Object.keys(TEAMS_PER_SEASON).length} years.
            </div>
          ) : !anchorYear || !comparedYear || !anchorMatches ? (
            <div className="italic text-center">Select two different seasons to compare the form.</div>
          ) : (
            <ComparisonTable anchorMatches={anchorMatches} anchorYear={anchorYear} comparedYear={comparedYear} team={team} />
          )}
        </div>
      </div>
    </>
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
  anchorMatches: MatchesAcrossSeasons
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
              <TableCell className={clsx(row.comparedSeasonMatchInfo?.color, 'text-center font-mono')}>
                <div className="inline-flex justify-center items-center relative">
                  {row.comparedSeasonMatchInfo?.homeTeam.score}-{row.comparedSeasonMatchInfo?.awayTeam.score}
                  <PreviousTeamThatGotRelegated match={row.comparedSeasonMatchInfo} opponent={row.opponent} />
                </div>
              </TableCell>

              {row.period === 'FullTime' ? (
                <>
                  <TableCell className={clsx(row.anchorSeasonMatchInfo.color, 'text-center font-mono')}>
                    {row.anchorSeasonMatchInfo.homeTeam.score}-{row.anchorSeasonMatchInfo.awayTeam.score}
                  </TableCell>
                  <TableCell className="text-right font-mono">{row.pointDiff}</TableCell>
                  <TableCell className="text-right font-mono">{row.aggPointDiff}</TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-center font-mono">-</TableCell>
                  <TableCell className="text-right font-mono">-</TableCell>
                  <TableCell className="text-right font-mono">-</TableCell>
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

function fillMatchAnchorRecord(record: MatchAnchorRecord, seasonMatches: MatchInfo[], team: string) {
  for (const match of seasonMatches) {
    const anchorKey = getAnchorKeyFromMatch(match, team)
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
    anchorKey = getAnchorKeyFromString(team, teamFromOtherSeason, team)
  } else {
    anchorKey = getAnchorKeyFromString(teamFromOtherSeason, team, team)
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
  matchesResponses: Record<string, MatchInfo[]>,
  anchorYear: string,
  comparedYear: string | undefined,
): MatchesAcrossSeasons | undefined {
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
