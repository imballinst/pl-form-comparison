import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import { toPercentage, truncateDecimals } from '@/lib/format'
import type { MatchFullStatData } from '@/types'
import { AVAILABLE_SEASONS, fetchMatchOfficialAssignments } from '@/utils/seasons-fetcher'
import { CheckIcon, ChevronDown } from 'lucide-react'
import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/compare.remaining-matches'

const SEASONS_PARAMETER = 'seasons'
const GAME_STATS = Object.keys(getGameStats())
const GAME_STATS_LABEL_RECORD: Record<keyof ReturnType<typeof getGameStats>, string> = {
  goals: 'goals scored',
  goalsConceded: 'goals conceded',
  expectedGoals: 'expected goals',
  wonCorners: 'corners won',
  duelWon: 'duels won',
  totalDistance: 'distance covered (metres)',
  // Fouls.
  fkFoulLost: 'fouls',
  totalOffside: 'offsides',
  penaltyConceded: 'penalties conceded',
  yellowCard: 'yellow cards',
  redCard: 'red cards',
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const seasons = new URL(request.url).searchParams.get(SEASONS_PARAMETER) ?? [CURRENT_SEASON]
  const result = await fetchMatchOfficialAssignments(seasons)

  return result
}

export default function MatchOfficialAssignments() {
  const { tableData, officialNames, matchStatRecord } = useLoaderData<typeof clientLoader>()
  const isMobile = useIsMobile()

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
                {officialNames.map((name) => (
                  <TableHead>{name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow>
                  <TableCell>{isMobile ? row.abbr : row.name}</TableCell>
                  {officialNames.map((name) => (
                    <TableCell
                      style={{
                        background: row.referees[name]?.background ?? 'black',
                      }}
                    >
                      {row.referees[name]?.score && (
                        <div className="flex justify-end">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button className="flex items-center gap-0.5 underline size-auto!" variant="link" size="sm">
                                {row.referees[name].score}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {name} officiating stats for {row.name}
                                </DialogTitle>
                              </DialogHeader>

                              <div>
                                {(() => {
                                  const officiatingAssignments = Object.entries(row.referees[name].Home).concat(
                                    Object.entries(row.referees[name].Away),
                                  ) as Array<[string, number[]]>

                                  const roles: Record<string, number> = {}
                                  const totalStats: Record<string, number> = {}
                                  const effectiveStats: Record<string, number> = {}

                                  for (const officiatingAssignment of officiatingAssignments) {
                                    const [role, matchIds] = officiatingAssignment

                                    for (const matchId of matchIds) {
                                      for (const statKey of GAME_STATS) {
                                        if (totalStats[statKey] === undefined) {
                                          totalStats[statKey] = 0
                                        }
                                        if (roles[role] === undefined) {
                                          roles[role] = 0
                                        }

                                        totalStats[statKey] += matchStatRecord[matchId][row.name][statKey as keyof MatchFullStatData]
                                      }
                                    }

                                    roles[role] += matchIds.length
                                  }

                                  for (const statKey in totalStats) {
                                    effectiveStats[statKey] = truncateDecimals(totalStats[statKey] / officiatingAssignments.length)
                                  }

                                  return (
                                    <div className="flex flex-col gap-y-4">
                                      <div>
                                        {name} is assigned to {row.name}'s matches in {row.referees[name].score} out of 38 matches (
                                        <strong>{toPercentage(truncateDecimals(row.referees[name].score / 38))}</strong>):{' '}
                                        {Object.entries(roles)
                                          .filter(([_, count]) => count > 0)
                                          .map(([role, count]) => `${count}x ${role}`)
                                          .join(', ')}
                                        .
                                      </div>

                                      <Table className="tabular-nums">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Statistic</TableHead>
                                            <TableHead className="text-right">Value</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {Object.entries(effectiveStats).map(([stat, value]) => (
                                            <TableRow>
                                              <TableCell>
                                                Average {GAME_STATS_LABEL_RECORD[stat as keyof typeof GAME_STATS_LABEL_RECORD]}
                                              </TableCell>
                                              <TableCell className="text-right">{value}</TableCell>
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
    yellowCard: 0,
    redCard: 0,
  }
}
