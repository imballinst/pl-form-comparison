import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '@/constants'
import type { MatchInfo } from '@/types'
import { getScoreResult } from '@/utils/match'
import { fetchSeasons, fetchSeasonsTable } from '@/utils/seasons-fetcher'
import clsx from 'clsx'
import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/compare.cross-table'

type AbbrMap = Record<string, string>

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const [seasons, seasonsTable] = await Promise.all([fetchSeasons(), fetchSeasonsTable(CURRENT_SEASON)])
  const matches = seasons[CURRENT_SEASON]

  const searchParams = new URL(request.url).searchParams
  const orderBy = searchParams.get('orderBy') ?? ORDER_BY_OPTIONS[0].value

  const teams = orderBy === ORDER_BY_OPTIONS[0].value ? seasonsTable.map((team) => team.name) : TEAMS_PER_SEASON[CURRENT_SEASON]
  const abbrMap: AbbrMap = {}

  for (const m of matches) {
    if (!abbrMap[m.homeTeam.name]) abbrMap[m.homeTeam.name] = m.homeTeam.abbr
    if (!abbrMap[m.awayTeam.name]) abbrMap[m.awayTeam.name] = m.awayTeam.abbr
  }

  return { teams, abbrMap, orderBy, matches }
}

const ORDER_BY_OPTIONS = [
  {
    label: 'Order by league position',
    value: 'leaguePosition',
  },
  {
    label: 'Order by team name',
    value: 'teamName',
  },
]

export default function CrossTableRoute() {
  const { teams, abbrMap, orderBy, matches } = useLoaderData<typeof clientLoader>()
  const [, setSearchParams] = useSearchParams()

  const matchIndex = new Map<string, MatchInfo>()
  for (const m of matches as MatchInfo[]) {
    matchIndex.set(`${m.homeTeam.name}|||${m.awayTeam.name}`, m)
  }

  return (
    <>
      <title>Cross-table | Premier League Form Comparison</title>

      <h1 className="text-3xl font-bold mb-4">Home-Away Cross Table</h1>
      <p className="text-md text-gray-500 mb-4">
        Compare all home and away matches from every team in the current season. Column represents away team and row represents home team.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <Select
            defaultValue={orderBy}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                const newSearchParams = new URLSearchParams(prev)
                if (value === ORDER_BY_OPTIONS[0].value) {
                  newSearchParams.delete('orderBy')
                } else {
                  newSearchParams.set('orderBy', value)
                }

                return newSearchParams
              })
            }}
          >
            <SelectTrigger className="w-full md:w-[50%]">
              <SelectValue placeholder="Order by..." />
            </SelectTrigger>
            <SelectContent>
              {ORDER_BY_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow>
                {/* Top-left corner cell */}
                <TableHead className="sticky left-0 top-0 z-20 bg-background min-w-16 h-7" />
                {teams.map((away) => (
                  <TableHead key={away} className="sticky top-0 z-10 bg-background text-center font-mono min-w-[50px] h-7">
                    {abbrMap[away] ?? away}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {teams.map((home) => (
                <TableRow key={home}>
                  {/* Sticky left header cell */}
                  <TableHead className="sticky left-0 z-10 bg-background font-mono text-center h-7">{abbrMap[home] ?? home}</TableHead>

                  {teams.map((away) => {
                    if (home === away) {
                      return (
                        <TableCell
                          key={`${home}-${away}`}
                          className="text-center font-mono min-w-[50px] h-7 p-0.5 bg-black text-transparent"
                        >
                          —
                        </TableCell>
                      )
                    }

                    const m = matchIndex.get(`${home}|||${away}`)

                    if (!m || m.period !== 'FullTime') {
                      return (
                        <TableCell key={`${home}-${away}`} className="text-center font-mono min-w-[50px] h-7 p-0.5">
                          -
                        </TableCell>
                      )
                    }

                    const color = getScoreResult('home', [m.homeTeam.score, m.awayTeam.score]).color
                    return (
                      <TableCell key={`${home}-${away}`} className={clsx(color, 'text-center font-mono min-w-[50px] h-7 p-0.5')}>
                        {m.homeTeam.score}-{m.awayTeam.score}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
