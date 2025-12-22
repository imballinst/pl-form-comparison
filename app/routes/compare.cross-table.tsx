import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '@/constants'
import type { MatchInfo } from '@/types'
import { getScoreResult } from '@/utils/match'
import { fetchSeasons } from '@/utils/seasons-fetcher'
import clsx from 'clsx'
import { useLoaderData } from 'react-router'

type AbbrMap = Record<string, string>

export async function clientLoader() {
  const seasons = await fetchSeasons()
  const matches = seasons[CURRENT_SEASON]

  const teams = [...TEAMS_PER_SEASON[CURRENT_SEASON]].sort((a, b) => a.localeCompare(b))
  const abbrMap: AbbrMap = {}

  for (const m of matches) {
    if (!abbrMap[m.homeTeam.name]) abbrMap[m.homeTeam.name] = m.homeTeam.abbr
    if (!abbrMap[m.awayTeam.name]) abbrMap[m.awayTeam.name] = m.awayTeam.abbr
  }

  return { teams, abbrMap, matches }
}

export default function CrossTableRoute() {
  const { teams, abbrMap, matches } = useLoaderData<typeof clientLoader>()

  const matchIndex = new Map<string, MatchInfo>()
  for (const m of matches as MatchInfo[]) {
    matchIndex.set(`${m.homeTeam.name}|||${m.awayTeam.name}`, m)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Home-Away Cross Table</h1>
      <p className="text-md text-gray-500 mb-4">Compare all home and away matches from every team in the current season.</p>

      <div className="overflow-auto">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow>
              {/* Top-left corner cell */}
              <TableHead className="sticky left-0 top-0 z-20 bg-background min-w-16 whitespace-nowrap">Home \ Away</TableHead>
              {teams.map((away) => (
                <TableHead key={away} className="sticky top-0 z-10 bg-background text-center font-mono min-w-[50px]">
                  {abbrMap[away] ?? away}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {teams.map((home) => (
              <TableRow key={home}>
                {/* Sticky left header cell */}
                <TableHead className="sticky left-0 z-10 bg-background font-mono text-center">{abbrMap[home] ?? home}</TableHead>

                {teams.map((away) => {
                  if (home === away) {
                    return (
                      <TableCell
                        key={`${home}-${away}`}
                        className="text-center font-mono min-w-[50px] h-[50px] p-0.5 bg-black text-transparent"
                      >
                        —
                      </TableCell>
                    )
                  }

                  const m = matchIndex.get(`${home}|||${away}`)

                  if (!m || m.period !== 'FullTime') {
                    return (
                      <TableCell key={`${home}-${away}`} className="text-center font-mono min-w-[50px] h-[50px] p-0.5">
                        -
                      </TableCell>
                    )
                  }

                  const color = getScoreResult('home', [m.homeTeam.score, m.awayTeam.score]).color
                  return (
                    <TableCell key={`${home}-${away}`} className={clsx(color, 'text-center font-mono min-w-[50px] h-[50px] p-0.5')}>
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
  )
}
