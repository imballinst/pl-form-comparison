import { DisciplineChart, type DisciplineChartDatum } from '@/components/custom/discipline-chart'
import { Header } from '@/components/custom/header'
import { SEASONS_SEARCH_PARAMETER, SeasonsSelector } from '@/components/custom/seasons-selector'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import { truncateDecimals } from '@/lib/format'
import type { TeamDisciplineAggregateRow, TeamDisciplineStats } from '@/types'
import { fetchTeamDisciplineStats } from '@/utils/seasons-fetcher'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type CellContext, type ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowDownUp, ArrowUp, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
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

type DisciplineDirection = 'conceded' | 'given'

// One chart per direction: fouls as translucent bars on the left axis, and the fouls-per-yellow-card
// and fouls-per-red-card ratios as yellow/red lines sharing the right axis. Order matches the table:
// conceded stats first, then the given ones.
const CHARTS = [
  { key: 'conceded', title: 'Conceded', direction: 'conceded' },
  { key: 'given', title: 'Given', direction: 'given' },
] as const satisfies ReadonlyArray<{ key: string; title: string; direction: DisciplineDirection }>

type ChartKey = (typeof CHARTS)[number]['key']
type DisplayKey = ChartKey | 'table'

const DISPLAY_OPTIONS: Array<{ key: DisplayKey; label: string }> = [
  ...CHARTS.map(({ key, title }) => ({ key, label: title })),
  { key: 'table', label: 'Table (raw data)' },
]

const FOULS_BY_DIRECTION = {
  conceded: 'foulsConceded',
  given: 'foulsGiven',
} as const satisfies Record<DisciplineDirection, keyof TeamDisciplineStats>

const FOULS_NAME_BY_DIRECTION = {
  conceded: 'Fouls conceded',
  given: 'Fouls given',
} as const satisfies Record<DisciplineDirection, string>

const RATIO_BY_DIRECTION = {
  conceded: { yellow: 'foulsPerYellowCard', red: 'foulsPerRedCard' },
  given: { yellow: 'foulsPerYellowCardGiven', red: 'foulsPerRedCardGiven' },
} as const satisfies Record<DisciplineDirection, { yellow: keyof TeamDisciplineStats; red: keyof TeamDisciplineStats }>

// Page-wide team ordering, driven by the Sort popover: one metric, one side, one direction, shared by
// every chart and the table.
const SORT_METRICS = [
  { value: 'fouls', label: 'Number of fouls' },
  { value: 'yellow', label: 'Fouls per yellow card' },
  { value: 'red', label: 'Fouls per red card' },
] as const

const SORT_SIDES = [
  { value: 'conceded', label: 'Conceded' },
  { value: 'given', label: 'Given' },
] as const

const SORT_ORDERS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
] as const

type SortMetric = (typeof SORT_METRICS)[number]['value']
type SortSide = (typeof SORT_SIDES)[number]['value']
type SortOrder = (typeof SORT_ORDERS)[number]['value']

function sortAccessor(metric: SortMetric, side: SortSide): keyof TeamDisciplineStats {
  if (metric === 'fouls') {
    return FOULS_BY_DIRECTION[side]
  }

  return metric === 'yellow' ? RATIO_BY_DIRECTION[side].yellow : RATIO_BY_DIRECTION[side].red
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

  // Total the raw stats per team across the selected seasons: with a single season this is that
  // season's numbers, with multiple it is the sum. The ratios are re-derived from the sums, so they
  // stay true "fouls per card" values instead of averages of per-season ratios.
  const RAW_ACCESSORS = [
    'gamesPlayed',
    'foulsConceded',
    'foulsGiven',
    'yellowCardsConceded',
    'yellowCardsGiven',
    'redCardsConceded',
    'redCardsGiven',
  ] as const satisfies ReadonlyArray<keyof TeamDisciplineStats>

  const grouped: Record<string, TeamDisciplineAggregateRow> = {}
  for (const row of rows) {
    const { season, team, abbr, ...stats } = row
    const group = (grouped[team] ??= {
      team,
      abbr,
      stats: {
        gamesPlayed: 0,
        foulsConceded: 0,
        foulsGiven: 0,
        yellowCardsConceded: 0,
        yellowCardsGiven: 0,
        redCardsConceded: 0,
        redCardsGiven: 0,
      },
    })

    for (const accessor of RAW_ACCESSORS) {
      group.stats[accessor] += stats[accessor]
    }
  }

  const tableData = Object.values(grouped)
  for (const { stats } of tableData) {
    stats.foulsPerYellowCard =
      stats.yellowCardsConceded === 0 ? undefined : truncateDecimals(stats.foulsConceded / stats.yellowCardsConceded)
    stats.foulsPerYellowCardGiven = stats.yellowCardsGiven === 0 ? undefined : truncateDecimals(stats.foulsGiven / stats.yellowCardsGiven)
    stats.foulsPerRedCard = stats.redCardsConceded === 0 ? undefined : truncateDecimals(stats.foulsConceded / stats.redCardsConceded)
    stats.foulsPerRedCardGiven = stats.redCardsGiven === 0 ? undefined : truncateDecimals(stats.foulsGiven / stats.redCardsGiven)
  }

  return { seasons: seasonsArray, tableData: tableData.sort((a, b) => a.team.localeCompare(b.team)) }
}

export default function TeamDiscipline() {
  const { seasons, tableData } = useLoaderData<typeof clientLoader>()
  const isMobile = useIsMobile()

  // Sections hidden via the display popover; everything is visible by default.
  const [hiddenSections, setHiddenSections] = useState<ReadonlySet<DisplayKey>>(() => new Set<DisplayKey>())
  // Page-wide team ordering: both charts and the table are sorted by this single column.
  const [sortMetric, setSortMetric] = useState<SortMetric>('fouls')
  const [sortSide, setSortSide] = useState<SortSide>('conceded')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const sortColumn = sortAccessor(sortMetric, sortSide)

  const columns = useMemo<ColumnDef<TeamDisciplineAggregateRow>[]>(
    () => [
      { accessorKey: 'team', header: 'Team name' },
      ...STATS.map((stat) => ({
        id: stat.accessor,
        // undefined is rendered as "-" (e.g. no cards of that kind, so the ratio does not exist).
        accessorFn: (row: TeamDisciplineAggregateRow) => row.stats[stat.accessor],
        // undefined values always sink to the bottom, regardless of sort direction.
        sortUndefined: 'last' as const,
        cell: (info: CellContext<TeamDisciplineAggregateRow, unknown>) => {
          const value = info.getValue<number>()

          if (value === undefined) {
            return '-'
          }

          return stat.fixedDecimals ? value.toFixed(stat.fixedDecimals) : value
        },
      })),
    ],
    // STATS is a module-level constant.
    [],
  )
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // The page-wide Sort popover is the single source of truth for the table ordering; columns are not
    // independently sortable.
    state: { sorting: [{ id: sortColumn, desc: sortOrder === 'desc' }] },
  })

  const chartData = useMemo(() => {
    const data = new Map<ChartKey, DisciplineChartDatum[]>()
    for (const { key, direction } of CHARTS) {
      const foulsKey = FOULS_BY_DIRECTION[direction]
      const ratioKeys = RATIO_BY_DIRECTION[direction]

      data.set(
        key,
        tableData
          .map((row) => ({
            team: row.team,
            abbr: row.abbr,
            fouls: row.stats[foulsKey],
            foulsPerYellowCard: row.stats[ratioKeys.yellow],
            foulsPerRedCard: row.stats[ratioKeys.red],
            // The page-wide sort column; charts use it so both charts and the table share one order.
            sortValue: row.stats[sortColumn],
          }))
          .sort((a, b) => {
            // Undefined ratios (no cards of that kind) always sink to the bottom; ties break by name.
            if (a.sortValue === b.sortValue) {
              return a.team.localeCompare(b.team)
            }
            if (a.sortValue === undefined) {
              return 1
            }
            if (b.sortValue === undefined) {
              return -1
            }

            return sortOrder === 'desc' ? b.sortValue - a.sortValue : a.sortValue - b.sortValue
          }),
      )
    }

    return data
  }, [tableData, sortColumn, sortOrder])

  const visibleCharts = CHARTS.filter(({ key }) => !hiddenSections.has(key))

  function toggleSection(key: DisplayKey, visible: boolean) {
    setHiddenSections((prev) => {
      const next = new Set(prev)
      if (visible) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  return (
    <>
      <title>Team Discipline | Premier League Form Comparison</title>

      <Header
        heading="Team Discipline"
        description={
          <>
            Compare fouls, yellow cards, and red cards between clubs in the selected seasons. <strong>Conceded</strong> are the stats by the
            team's own players; <strong>given</strong> are the ones by their opponents. With multiple seasons selected, everything shows the
            totals across them, counting only the seasons that each team played in. Ratios are marked <strong>-</strong> when a team
            received no cards of that kind. The charts and the table share one page-wide team order, set by the Sort popover. Choose which
            charts and the table to display with the Display selector. <DisciplineLegend />
          </>
        }
      />

      <div className="flex flex-col gap-y-4 flex-1 min-h-0">
        <div className="flex flex-wrap items-center gap-2">
          <SeasonsSelector seasons={seasons} gaLabelPrefix="ga-team-discipline" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" data-ga-label="ga-team-discipline-show-display-button">
                <SlidersHorizontal aria-hidden />
                Display
              </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-auto p-3">
              <ul className="flex flex-col gap-2.5">
                {DISPLAY_OPTIONS.map(({ key, label }) => (
                  <li key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`display-${key}`}
                      checked={!hiddenSections.has(key)}
                      onCheckedChange={(checked) => toggleSection(key, checked === true)}
                      data-ga-label={`ga-team-discipline-toggle-display-${key}-checkbox`}
                    />
                    <Label htmlFor={`display-${key}`} className="font-normal">
                      {label}
                    </Label>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" data-ga-label="ga-team-discipline-show-sort-button">
                <ArrowDownUp aria-hidden />
                Sort
              </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-auto p-3">
              <div className="flex flex-col gap-3">
                <section>
                  <div className="text-sm font-medium">Sort by</div>
                  <RadioGroup value={sortMetric} onValueChange={(value) => setSortMetric(value as SortMetric)} className="mt-2 gap-2">
                    {SORT_METRICS.map(({ value, label }) => (
                      <div key={value} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={value}
                          id={`sort-metric-${value}`}
                          data-ga-label={`ga-team-discipline-sort-metric-${value}-radio`}
                        />
                        <Label htmlFor={`sort-metric-${value}`} className="font-normal">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </section>

                <section>
                  <div className="text-sm font-medium">Side</div>
                  <RadioGroup value={sortSide} onValueChange={(value) => setSortSide(value as SortSide)} className="mt-2 flex-row gap-4">
                    {SORT_SIDES.map(({ value, label }) => (
                      <div key={value} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={value}
                          id={`sort-side-${value}`}
                          data-ga-label={`ga-team-discipline-sort-side-${value}-radio`}
                        />
                        <Label htmlFor={`sort-side-${value}`} className="font-normal">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </section>

                <section>
                  <div className="text-sm font-medium">Order by</div>
                  <RadioGroup value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)} className="mt-2 flex-row gap-4">
                    {SORT_ORDERS.map(({ value, label }) => (
                      <div key={value} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={value}
                          id={`sort-order-${value}`}
                          data-ga-label={`ga-team-discipline-sort-order-${value}-radio`}
                        />
                        <Label htmlFor={`sort-order-${value}`} className="font-normal">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </section>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {visibleCharts.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleCharts.map(({ key, title, direction }) => (
              <DisciplineChart
                key={key}
                title={title}
                foulsName={FOULS_NAME_BY_DIRECTION[direction]}
                data={chartData.get(key) ?? []}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}

        {!hiddenSections.has('table') && (
          <div className="overflow-auto">
            <Table className="tabular-nums text-xs">
              <TableHeader>
                <TableRow className="group">
                  {/* group lets the sticky "Team name" cell show the row's hover background. */}
                  <TableHead className="sticky left-0 z-10 bg-background group-hover:bg-transparent">
                    <span className="inline-flex items-center gap-1">Team name</span>
                  </TableHead>

                  {STATS.map((stat) => {
                    const isSorted = stat.accessor === sortColumn

                    return (
                      <TableHead key={stat.accessor} className="text-right whitespace-nowrap" title={stat.long}>
                        <span className="inline-flex items-center gap-1">
                          {isMobile ? stat.short : stat.long}
                          {isSorted && (sortOrder === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                        </span>
                      </TableHead>
                    )
                  })}
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
        )}
      </div>
    </>
  )
}
