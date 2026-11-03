import { Header } from '@/components/custom/header'
import { SEASONS_SEARCH_PARAMETER, SeasonsSelector } from '@/components/custom/seasons-selector'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import { truncateDecimals } from '@/lib/format'
import type { TeamDisciplineSeasonRow, TeamDisciplineStats } from '@/types'
import { formatSeason } from '@/utils/match'
import { fetchTeamDisciplineStats } from '@/utils/seasons-fetcher'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type CellContext, type ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'
import { useLoaderData } from 'react-router'
import type { Route } from './+types/insights.discipline'

interface DisciplineStat {
  accessor: keyof TeamDisciplineStats
  short: string
  long: string
  /** Render the value with a fixed number of decimals; ratios always show 2 for column alignment. */
  fixedDecimals?: number
}

const STATS: Array<DisciplineStat> = [
  // Conceded stats: what the team's own players did.
  { accessor: 'foulsConceded', short: 'FC', long: 'Fouls conceded' },
  { accessor: 'yellowCardsConceded', short: 'YC', long: 'Yellow cards conceded' },
  { accessor: 'foulsPerYellowCard', short: 'FPY', long: 'Fouls per yellow card conceded', fixedDecimals: 2 },
  { accessor: 'redCardsConceded', short: 'RC', long: 'Red cards conceded' },
  { accessor: 'foulsPerRedCard', short: 'FPR', long: 'Fouls per red card conceded', fixedDecimals: 2 },
  // Given stats: what the opponents did in the team's matches.
  { accessor: 'foulsGiven', short: 'FG', long: 'Fouls given' },
  { accessor: 'yellowCardsGiven', short: 'YG', long: 'Yellow cards given' },
  { accessor: 'foulsPerYellowCardGiven', short: 'FPYG', long: 'Fouls per yellow card given', fixedDecimals: 2 },
  { accessor: 'redCardsGiven', short: 'RG', long: 'Red cards given' },
  { accessor: 'foulsPerRedCardGiven', short: 'FPRG', long: 'Fouls per red card given', fixedDecimals: 2 },
]

function disciplineColumnId(season: string, accessor: keyof TeamDisciplineStats) {
  return `${season}:${accessor}`
}

function DisciplineLegend() {
  const legends = [
    ['FC / FG', 'fouls conceded / given'],
    ['YC / YG', 'yellow cards conceded / given'],
    ['RC / RG', 'red cards conceded / given'],
    ['FPY / FPYG', 'fouls per yellow card conceded / given, e.g. 102 fouls and 10 yellow cards ≈ 10.2'],
    ['FPR / FPRG', 'fouls per red card conceded / given'],
  ] as Array<[string, string]>

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          className="text-base p-0 text-[unset] underline decoration-dotted h-[unset]"
          data-ga-label="ga-team-discipline-show-legends-button"
        >
          Click here to display legends.
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-2 text-sm w-auto">
        <ul className="list-disc pl-4">
          {legends.map(([short, long]) => (
            <li key={short}>
              <span className="font-bold">{short}</span>: {long}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { [SEASONS_SEARCH_PARAMETER]: seasons = CURRENT_SEASON } = Object.fromEntries(new URL(request.url).searchParams)
  const seasonsArray = seasons.split(',').filter(Boolean).sort()

  const rows = await fetchTeamDisciplineStats(seasonsArray)

  // Pivot the per-team-per-season rows into one row per team, with the stats per season column group.
  const grouped: Record<string, TeamDisciplineSeasonRow> = {}
  for (const row of rows) {
    const { season, team, abbr, ...stats } = row
    const group = (grouped[team] ??= { team, abbr, seasonStats: {} })
    group.seasonStats[season] = {
      ...stats,
      foulsPerYellowCard: stats.yellowCardsConceded === 0 ? undefined : truncateDecimals(stats.foulsConceded / stats.yellowCardsConceded),
      foulsPerYellowCardGiven: stats.yellowCardsGiven === 0 ? undefined : truncateDecimals(stats.foulsGiven / stats.yellowCardsGiven),
      foulsPerRedCard: stats.redCardsConceded === 0 ? undefined : truncateDecimals(stats.foulsConceded / stats.redCardsConceded),
      foulsPerRedCardGiven: stats.redCardsGiven === 0 ? undefined : truncateDecimals(stats.foulsGiven / stats.redCardsGiven),
    }
  }

  return { seasons: seasonsArray, tableData: Object.values(grouped).sort((a, b) => a.team.localeCompare(b.team)) }
}

export default function TeamDiscipline() {
  const { seasons, tableData } = useLoaderData<typeof clientLoader>()
  const isMobile = useIsMobile()

  const columns = useMemo<ColumnDef<TeamDisciplineSeasonRow>[]>(
    () => [
      { accessorKey: 'team', header: 'Team name' },
      ...seasons.flatMap((season) =>
        STATS.map((stat) => ({
          id: disciplineColumnId(season, stat.accessor),
          // undefined is rendered as "-"; teams that did not play in this season.
          accessorFn: (row: TeamDisciplineSeasonRow) => row.seasonStats[season]?.[stat.accessor],
          // undefined values always sink to the bottom, regardless of sort direction.
          sortUndefined: 'last' as const,
          sortDescFirst: true,
          cell: (info: CellContext<TeamDisciplineSeasonRow, unknown>) => {
            const value = info.getValue<number>()

            if (value === undefined) {
              return '-'
            }

            return stat.fixedDecimals ? value.toFixed(stat.fixedDecimals) : value
          },
        })),
      ),
    ],
    [seasons],
  )
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [{ id: 'team', desc: false }],
    },
  })

  const teamColumn = table.getColumn('team')

  return (
    <>
      <title>Team Discipline | Premier League Form Comparison</title>

      <Header
        heading="Team Discipline"
        description={
          <>
            Compare fouls, yellow cards, and red cards between clubs in the selected seasons. <strong>Conceded</strong> are the stats by the
            team's own players; <strong>given</strong> are the ones by their opponents. Teams that did not play in the selected season are
            marked <strong>-</strong> and always sorted to the bottom. <DisciplineLegend />
          </>
        }
      />

      <div className="flex flex-col gap-y-4 flex-1 min-h-0">
        <SeasonsSelector seasons={seasons} gaLabelPrefix="ga-team-discipline" />

        <div className="overflow-auto">
          <Table className="tabular-nums text-xs">
            <TableHeader>
              {/* group lets the sticky "Team name" cell show the row's hover background. */}
              <TableRow className="group">
                <TableHead
                  className="sticky left-0 z-10 bg-background border-e border-foreground/20 cursor-pointer select-none group-hover:bg-transparent"
                  rowSpan={3}
                  onClick={teamColumn?.getToggleSortingHandler()}
                  title="Click to sort"
                >
                  <span className="inline-flex items-center gap-1">
                    Team name
                    {teamColumn?.getIsSorted() === 'asc' && <ArrowUp size={12} aria-hidden />}
                    {teamColumn?.getIsSorted() === 'desc' && <ArrowDown size={12} aria-hidden />}
                  </span>
                </TableHead>

                <TableHead colSpan={seasons.length * STATS.length} className="text-center border-b border-foreground/20">
                  Season
                </TableHead>
              </TableRow>

              <TableRow>
                {seasons.map((season) => (
                  <TableHead key={season} className="text-center border-e border-b border-foreground/20" colSpan={STATS.length}>
                    {formatSeason(season)}
                  </TableHead>
                ))}
              </TableRow>

              <TableRow>
                {seasons.map((season) =>
                  STATS.map((stat) => {
                    const column = table.getColumn(disciplineColumnId(season, stat.accessor))
                    const isSorted = column?.getIsSorted()

                    return (
                      <TableHead
                        key={disciplineColumnId(season, stat.accessor)}
                        className="text-right whitespace-nowrap border-e border-foreground/20 cursor-pointer select-none hover:bg-muted/50"
                        title={`${stat.long}. Click to sort`}
                        onClick={column?.getToggleSortingHandler()}
                      >
                        <span className="inline-flex items-center gap-1">
                          {isMobile ? stat.short : stat.long}
                          {isSorted === 'asc' && <ArrowUp size={12} aria-hidden />}
                          {isSorted === 'desc' && <ArrowDown size={12} aria-hidden />}
                        </span>
                      </TableHead>
                    )
                  }),
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {/* group-hover shows the row's hover background instead of stacking a second translucent tint. */}
                  <TableCell className="sticky left-0 z-10 bg-background group-hover:bg-transparent">
                    {row.getValue<string>('team')}
                  </TableCell>
                  {row
                    .getVisibleCells()
                    .slice(1)
                    .map((cell) => (
                      <TableCell key={cell.id} className="text-right">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
