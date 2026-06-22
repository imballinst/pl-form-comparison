import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import { toPercentage, truncateDecimals } from '@/lib/format'
import type { MatchFullStatData } from '@/types'
import { formatSeason } from '@/utils/match'
import { AVAILABLE_SEASONS, fetchMatchOfficialAssignments } from '@/utils/seasons-fetcher'
import { CheckIcon, ChevronDown, LoaderIcon } from 'lucide-react'
import { useState } from 'react'
import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/compare.remaining-matches'

const FILTERED_GAME_STAT = ['totalDistance', 'duelWon', 'expectedGoals'] as const

type GameStat = keyof ReturnType<typeof getGameStats>
type FilteredGameStat = Exclude<GameStat, (typeof FILTERED_GAME_STAT)[number]>

const SEASONS_PARAMETER = 'seasons'
const GAME_STATS = Object.keys(getGameStats()).filter((stat) => (!FILTERED_GAME_STAT as string[]).includes(stat))
const GAME_STATS_LABEL_RECORD: Record<FilteredGameStat, string> = {
  goals: 'Goals scored',
  goalsConceded: 'Goals conceded',
  wonCorners: 'Corners won',
  // Fouls.
  fkFoulLost: 'Fouls',
  totalOffside: 'Offsides',
  penaltyConceded: 'Penalties conceded',
  totalYelCard: 'Yellow cards',
  totalRedCard: 'Red cards',
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const seasons = new URL(request.url).searchParams.get(SEASONS_PARAMETER)
  const seasonsArray = seasons ? seasons.split(',') : [CURRENT_SEASON]

  const result = await fetchMatchOfficialAssignments(seasonsArray)
  return { ...result, seasons: seasonsArray }
}

export default function MatchOfficialAssignments() {
  const { perSeasonRecord, allSeasons, seasons } = useLoaderData<typeof clientLoader>()
  const isMobile = useIsMobile()
  const [dialogKey, setDialogKey] = useState<string | null>(null)

  return (
    <>
      <title>Match Official Assignments | Premier League Form Comparison</title>

      <h1 className="text-3xl font-bold mb-4">Match Official Assignments</h1>
      <p className="text-md text-gray-500 mb-4">
        Compare the match official assignments between clubs. Get some insights on the match results on the officials, but do remember that
        correlation is not causation. Only referee, VAR, and assistant VAR roles are counted (assistant referee and fourth official are
        ignored).
      </p>

      <div className="flex flex-col gap-y-4">
        <div>
          <SeasonsSelector />
        </div>

        <div>
          <Table className="tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                {allSeasons.officialNames.map((name) => (
                  <TableHead key={name}>{name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSeasons.tableData.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{isMobile ? row.abbr : row.name}</TableCell>
                  {allSeasons.officialNames.map((name) => (
                    <TableCell
                      key={name}
                      style={{
                        background: row.referees[name]?.background ?? 'black',
                      }}
                    >
                      {!!row.referees[name]?.totalScore && (
                        <div className="flex justify-end">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button className="flex items-center gap-0.5 underline size-auto!" variant="link" size="sm">
                                {seasons.map((season) => row.referees[name].perSeasonRecord[season] ?? 0).join(' / ')}
                              </Button>
                            </DialogTrigger>
                            <DialogContent
                              onAnimationEnd={(e) => {
                                setDialogKey(`${row.name}-${name}`)
                              }}
                              className="min-h-[525px]"
                            >
                              <DialogHeader>
                                <DialogTitle>
                                  {name} officiating stats for {row.name}
                                </DialogTitle>
                              </DialogHeader>

                              <div>
                                {(() => {
                                  if (dialogKey !== `${row.name}-${name}`) {
                                    return (
                                      <div className="w-full flex justify-center items-center">
                                        <LoaderIcon className="animate-spin" />
                                      </div>
                                    )
                                  }

                                  const totalNumberOfGamesAcrossSeasons = 38 * seasons.length

                                  const roles: Record<string, number> = {}
                                  const assignmentCountPerSeason: Record<string, number> = {}
                                  const totalStatsPerSeason: Record<string, Record<string, number>> = {}

                                  for (const season of seasons) {
                                    const refereeEntry = perSeasonRecord[season].teamsRecord[row.name]?.referees ?? {}
                                    const officiatingAssignments = (
                                      refereeEntry[name]
                                        ? Object.entries(refereeEntry[name].Home).concat(Object.entries(refereeEntry[name].Away))
                                        : []
                                    ) as Array<[string, number[]]>

                                    let totalStats = totalStatsPerSeason[season]

                                    if (!totalStats) {
                                      totalStats = {}
                                      totalStatsPerSeason[season] = totalStats
                                    }

                                    for (const officiatingAssignment of officiatingAssignments) {
                                      const [role, matchIds] = officiatingAssignment

                                      for (const matchId of matchIds) {
                                        // Match ID not in this season, skip.
                                        if (!perSeasonRecord[season].matchStatRecord[matchId]) {
                                          continue
                                        }

                                        for (const statKey of GAME_STATS) {
                                          if (totalStats[statKey] === undefined) {
                                            totalStats[statKey] = 0
                                          }

                                          totalStats[statKey] +=
                                            perSeasonRecord[season].matchStatRecord[matchId][row.name][statKey as keyof MatchFullStatData]
                                        }
                                      }

                                      if (roles[role] === undefined) {
                                        roles[role] = 0
                                      }
                                      if (assignmentCountPerSeason[season] === undefined) {
                                        assignmentCountPerSeason[season] = 0
                                      }

                                      roles[role] += matchIds.length
                                      assignmentCountPerSeason[season] += matchIds.length
                                    }
                                  }

                                  return (
                                    <div className="flex flex-col gap-y-4">
                                      <div>
                                        {name} is assigned to {row.name}'s matches in {row.referees[name].totalScore} out of{' '}
                                        {totalNumberOfGamesAcrossSeasons} matches (
                                        <strong>
                                          {toPercentage(truncateDecimals(row.referees[name].totalScore / totalNumberOfGamesAcrossSeasons))}
                                        </strong>
                                        ):{' '}
                                        {Object.entries(roles)
                                          .filter(([_, count]) => count > 0)
                                          .map(([role, count]) => `${count}x ${role}`)
                                          .join(', ')}
                                        .
                                      </div>

                                      <Table className="tabular-nums">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Stat</TableHead>
                                            {seasons.map((season) => (
                                              <TableHead key={season} className="text-right">
                                                {formatSeason(season)}
                                              </TableHead>
                                            ))}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          <TableRow>
                                            <TableCell>Number of games</TableCell>
                                            {seasons.map((season) => (
                                              <TableCell key={season} className="text-right">
                                                {assignmentCountPerSeason[season]}
                                              </TableCell>
                                            ))}
                                          </TableRow>

                                          {Object.keys(GAME_STATS_LABEL_RECORD).map((stat) => (
                                            <TableRow key={stat}>
                                              <TableCell>{GAME_STATS_LABEL_RECORD[stat as keyof typeof GAME_STATS_LABEL_RECORD]}</TableCell>
                                              {seasons.map((season) => (
                                                <TableCell key={season} className="text-right">
                                                  {truncateDecimals(totalStatsPerSeason[season][stat])}
                                                </TableCell>
                                              ))}
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )
                                })()}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
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

function SeasonsSelector() {
  const [searchParams, setSearchParams] = useSearchParams()
  const seasons = searchParams.get(SEASONS_PARAMETER) ?? CURRENT_SEASON
  const seasonsArray = seasons.split(',')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex justify-between max-w-80" variant="outline">
          <div>Currently selected seasons: {seasonsArray.join(', ')}</div>

          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Select seasons (max 3)</DropdownMenuLabel>
        {AVAILABLE_SEASONS.map((season) => (
          <DropdownMenuItem
            disabled={seasonsArray.length === 1 && seasonsArray[0] === season}
            onClick={() =>
              setSearchParams((prev) => {
                const newSearchParams = new URLSearchParams(prev)
                const newSeasonsArray = [...seasonsArray]

                const seasonIdx = newSeasonsArray.indexOf(season)

                if (seasonIdx > -1) {
                  newSeasonsArray.splice(seasonIdx, 1)
                } else {
                  newSeasonsArray.push(season)
                }

                newSearchParams.set(SEASONS_PARAMETER, newSeasonsArray.sort().join(','))

                return newSearchParams
              })
            }
          >
            <div className="w-full flex justify-between">
              <div>{season}</div>
              <div style={{ display: !seasonsArray.includes(season) ? 'none' : undefined }}>
                <CheckIcon />
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Synchronize this with scripts/enhance-match-official-with-stats.mjs.
function getGameStats() {
  return {
    goals: 0,
    goalsConceded: 0,
    expectedGoals: 0,
    wonCorners: 0,
    duelWon: 0,
    totalDistance: 0, // metres
    // Fouls.
    fkFoulLost: 0,
    totalOffside: 0,
    penaltyConceded: 0,
    totalYelCard: 0,
    totalRedCard: 0,
  }
}
