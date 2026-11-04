import { DisciplineChart, type DisciplineChartDatum } from '@/components/custom/discipline-chart'
import { CheckboxWithField } from '@/components/custom/form'
import { Header } from '@/components/custom/header'
import { SEASONS_SEARCH_PARAMETER, SeasonsSelector } from '@/components/custom/seasons-selector'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import { truncateDecimals } from '@/lib/format'
import type { TeamDisciplineAggregateRow, TeamDisciplineStats } from '@/types'
import { fetchTeamDisciplineStats } from '@/utils/seasons-fetcher'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type CellContext, type ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowDownUp, ArrowUp, SlidersHorizontal } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useLoaderData, useSearchParams } from 'react-router'
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
  { key: 'conceded', title: 'Conceded (bigger ratio is better)', direction: 'conceded' },
  { key: 'given', title: 'Given (smaller ratio is better)', direction: 'given' },
] as const satisfies ReadonlyArray<{ key: string; title: string; direction: DisciplineDirection }>

type ChartKey = (typeof CHARTS)[number]['key']
type DisplayKey = ChartKey | 'table'

const DISPLAY_OPTIONS: Array<{ key: DisplayKey; label: string }> = [
  ...CHARTS.map(({ key, title }) => ({ key, label: title })),
  { key: 'table', label: 'Table (raw data)' },
]

// Metric checkboxes in the Display popover. Each metric toggles the corresponding series in both
// charts and the conceded+given columns of that metric in the table; the card-count columns
// (yellow/red cards) have no metric toggle and always appear.
const DISPLAY_METRICS: Array<{ key: SortMetric; label: string }> = [
  { key: 'fouls', label: 'Number of fouls' },
  { key: 'yellow', label: 'Fouls per yellow card' },
  { key: 'red', label: 'Fouls per red card' },
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

// Which Display-metric (if any) a stat column belongs to; columns not listed, e.g. the yellow/red card
// counts, always appear in the table.
const METRIC_BY_ACCESSOR: Partial<Record<keyof TeamDisciplineStats, SortMetric>> = {
  foulsConceded: 'fouls',
  foulsGiven: 'fouls',
  foulsPerYellowCard: 'yellow',
  foulsPerYellowCardGiven: 'yellow',
  foulsPerRedCard: 'red',
  foulsPerRedCardGiven: 'red',
}

// Page-wide team ordering, driven by the Sort popover: one metric, one side, one direction, shared by
// every chart and the table.
const SORT_METRICS = [
  { value: 'fouls', label: 'Number of fouls' },
  { value: 'yellow', label: 'Fouls per yellow card' },
  { value: 'red', label: 'Fouls per red card' },
] as const

const SORT_ORDERS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
] as const

type SortMetric = (typeof SORT_METRICS)[number]['value']

// Search parameters persisting the non-default Display/Sort states; absent parameters mean defaults.
export const DISPLAY_ILLUSTRATIONS_SEARCH_PARAMETER = 'illustrations'
export const DISPLAY_METRICS_SEARCH_PARAMETER = 'metrics'
export const CHART_GRID_SEARCH_PARAMETER = 'chart-grid'
export const SORT_BY_SEARCH_PARAMETER = 'sort-by'
export const SORT_ORDER_SEARCH_PARAMETER = 'sort-order'
type SortOrder = (typeof SORT_ORDERS)[number]['value']

// The table is ordered by the combined conceded+given totals of the chosen metric, re-derived from
// the sums so the ratios stay true "fouls per card". The charts order by their own side's
// column for the same metric and direction.
const COMBINED_BY_METRIC = {
  fouls: 'combinedFouls',
  yellow: 'combinedFoulsPerYellowCard',
  red: 'combinedFoulsPerRedCard',
} as const satisfies Record<SortMetric, string>

function sortAccessor(metric: SortMetric, side: DisciplineDirection): keyof TeamDisciplineStats {
  if (metric === 'fouls') {
    return FOULS_BY_DIRECTION[side]
  }

  return metric === 'yellow' ? RATIO_BY_DIRECTION[side].yellow : RATIO_BY_DIRECTION[side].red
}

function DisciplineLegend() {
  const explanations = [
    "<strong>Conceded</strong>: the stats by the team's own players; <strong>given</strong>: the ones by their opponents.",
    'With multiple seasons selected, everything shows the totals across them, counting only the seasons that each team played in.',
    'Ratios are marked <strong>-</strong> when a team received no cards of that kind.',
    "The Display popover's <strong>Metrics</strong> section hides the matching columns from the table and the matching series from the charts.",
    "Each chart is sorted by its own side's stats using the Sort popover's metric and order; the table is ordered by the combined conceded+given totals.",
  ]

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
          Click here for explanations and legends.
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-2 text-sm w-auto max-w-[420px]">
        <ul className="list-disc pl-4 flex flex-col gap-y-1">
          {explanations.map((explanation) => (
            <li key={explanation} dangerouslySetInnerHTML={{ __html: explanation }} />
          ))}

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
  const searchParams = new URL(request.url).searchParams
  const { [SEASONS_SEARCH_PARAMETER]: seasons = CURRENT_SEASON } = Object.fromEntries(searchParams)
  const seasonsArray = seasons.split(',').filter(Boolean).sort()

  // Non-default Display/Sort states: absent parameters mean the defaults (everything visible,
  // 2-column grid, fouls descending).
  const hiddenIllustrations = (searchParams.get(DISPLAY_ILLUSTRATIONS_SEARCH_PARAMETER) ?? '')
    .split(',')
    .filter((value): value is DisplayKey => DISPLAY_OPTIONS.some(({ key }) => key === value))
  const hiddenMetrics = (searchParams.get(DISPLAY_METRICS_SEARCH_PARAMETER) ?? '')
    .split(',')
    .filter((value): value is SortMetric => SORT_METRICS.some(({ value: metric }) => metric === value))
  const chartGrid: ChartGrid = searchParams.get(CHART_GRID_SEARCH_PARAMETER) === '1' ? '1' : '2'
  const sortByParam = searchParams.get(SORT_BY_SEARCH_PARAMETER) ?? ''
  const sortBy: SortMetric = SORT_METRICS.some(({ value }) => value === sortByParam) ? (sortByParam as SortMetric) : 'fouls'
  const sortOrder: SortOrder = searchParams.get(SORT_ORDER_SEARCH_PARAMETER) === 'asc' ? 'asc' : 'desc'

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

  return {
    seasons: seasonsArray,
    tableData: tableData.sort((a, b) => a.team.localeCompare(b.team)),
    hiddenIllustrations,
    hiddenMetrics,
    chartGrid,
    sortBy,
    sortOrder,
  }
}

export default function TeamDiscipline() {
  const { seasons, tableData, hiddenIllustrations, hiddenMetrics, chartGrid, sortBy, sortOrder } = useLoaderData<typeof clientLoader>()
  const isMobile = useIsMobile()

  const hiddenSections = useMemo(() => new Set<DisplayKey>(hiddenIllustrations), [hiddenIllustrations])
  // Metrics hidden via the display popover's Metrics section; filters the table columns and the chart
  // series. The chart layout follows the Chart grid setting. The ordering comes from the Sort
  // popover: each chart uses its own side's column for the metric and direction, and the table uses
  // the combined conceded+given column.

  const hiddenMetricsSet = useMemo(() => new Set<SortMetric>(hiddenMetrics), [hiddenMetrics])

  const columns = useMemo<ColumnDef<TeamDisciplineAggregateRow>[]>(
    () => [
      { accessorKey: 'team', header: 'Team name' },
      ...STATS.filter((stat) => {
        const metric = METRIC_BY_ACCESSOR[stat.accessor]

        return metric === undefined || !hiddenMetricsSet.has(metric)
      }).map((stat) => ({
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
    // STATS and METRIC_BY_ACCESSOR are module-level constants.
    [hiddenMetricsSet],
  )
  // Internal ordering columns for the combined conceded+given metric; kept invisible so only the
  // Sort popover drives the table order.
  const COMBINED_COLUMNS: Array<ColumnDef<TeamDisciplineAggregateRow>> = [
    {
      id: 'combinedFouls',
      accessorFn: (row) => row.stats.foulsConceded + row.stats.foulsGiven,
      sortUndefined: 'last' as const,
    },
    {
      id: 'combinedFoulsPerYellowCard',
      accessorFn: (row) => {
        const cards = row.stats.yellowCardsConceded + row.stats.yellowCardsGiven

        return cards === 0 ? undefined : truncateDecimals((row.stats.foulsConceded + row.stats.foulsGiven) / cards)
      },
      sortUndefined: 'last' as const,
    },
    {
      id: 'combinedFoulsPerRedCard',
      accessorFn: (row) => {
        const cards = row.stats.redCardsConceded + row.stats.redCardsGiven

        return cards === 0 ? undefined : truncateDecimals((row.stats.foulsConceded + row.stats.foulsGiven) / cards)
      },
      sortUndefined: 'last' as const,
    },
  ]

  // Stable identity: passing a fresh sorting object every render made TanStack churn endlessly when
  // re-rendered alongside the charts (the whole tab froze).
  const sorting = useMemo(() => [{ id: COMBINED_BY_METRIC[sortBy], desc: sortOrder === 'desc' }], [sortBy, sortOrder])

  const table = useReactTable({
    data: tableData,
    columns: [...columns, ...COMBINED_COLUMNS],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Hide the internal combined ordering columns from the rendered cells.
    initialState: {
      columnVisibility: { combinedFouls: false, combinedFoulsPerYellowCard: false, combinedFoulsPerRedCard: false },
    },
    // The page-wide Sort popover is the single source of truth for the table ordering; columns are not
    // independently sortable.
    state: { sorting },
  })

  const chartData = useMemo(() => {
    const data = new Map<ChartKey, DisciplineChartDatum[]>()
    for (const { key, direction } of CHARTS) {
      const foulsKey = FOULS_BY_DIRECTION[direction]
      const ratioKeys = RATIO_BY_DIRECTION[direction]
      // Each chart sorts by its own side's column, so the Given chart is sorted by Given stats.
      const chartSortColumn = sortAccessor(sortBy, direction)

      data.set(
        key,
        tableData
          .map((row) => ({
            team: row.team,
            abbr: row.abbr,
            fouls: row.stats[foulsKey],
            foulsPerYellowCard: row.stats[ratioKeys.yellow],
            foulsPerRedCard: row.stats[ratioKeys.red],
            sortValue: row.stats[chartSortColumn],
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
  }, [tableData, sortBy, sortOrder])

  const visibleCharts = CHARTS.filter(({ key }) => !hiddenSections.has(key))

  return (
    <>
      <title>Team Discipline | Premier League Form Comparison</title>

      <Header
        heading="Team Discipline"
        description={
          <>
            Compare fouls, yellow cards, and red cards between clubs in the selected seasons. Choose which charts and the table to display
            with the Display selector. <DisciplineLegend />
          </>
        }
      />

      <div className="flex flex-col gap-y-4 flex-1 min-h-0">
        <div className="flex flex-wrap items-center gap-2">
          <SeasonsSelector seasons={seasons} gaLabelPrefix="ga-team-discipline" />

          <DisplaySelector hiddenSections={hiddenSections} hiddenMetrics={hiddenMetricsSet} chartGrid={chartGrid} />

          <SortSelector metric={sortBy} order={sortOrder} />
        </div>

        {visibleCharts.length > 0 && (
          <div className={chartGrid === '2' ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
            {visibleCharts.map(({ key, title, direction }) => (
              <DisciplineChart
                key={key}
                title={title}
                foulsName={FOULS_NAME_BY_DIRECTION[direction]}
                data={chartData.get(key) ?? []}
                isMobile={isMobile}
                isFullTeamName={!isMobile && chartGrid === '1'}
                isFoulsShown={!hiddenMetricsSet.has('fouls')}
                isFoulsPerYellowCardShown={!hiddenMetricsSet.has('yellow')}
                isFoulsPerRedCardShown={!hiddenMetricsSet.has('red')}
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

                  {STATS.filter((stat) => {
                    const metric = METRIC_BY_ACCESSOR[stat.accessor]

                    return metric === undefined || !hiddenMetricsSet.has(metric)
                  }).map((stat) => {
                    // The combined ordering column is invisible; mark every column of the sorted
                    // metric pair instead.
                    const isSorted = METRIC_BY_ACCESSOR[stat.accessor] === sortBy

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

interface SortSelectorProps {
  metric: SortMetric
  order: SortOrder
}

/**
 * Submit-to-apply sort popover, following the roles selector pattern in insights.official-assignments.
 * The radios preview inside the form; only submitting persists the values into the URL's search
 * parameters, which the loader parses back.
 */
function SortSelector({ metric, order }: SortSelectorProps) {
  const [, setSearchParams] = useSearchParams()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const { watch, setValue, handleSubmit, reset } = useForm<{ metric: SortMetric; order: SortOrder }>({
    defaultValues: { metric, order },
  })

  function onSubmit(data: { metric: SortMetric; order: SortOrder }) {
    // Persist only the non-default states, so the parameterless URL stays the pristine view.
    setSearchParams((prev) => {
      const newSearchParams = new URLSearchParams(prev)

      if (data.metric !== 'fouls') {
        newSearchParams.set(SORT_BY_SEARCH_PARAMETER, data.metric)
      } else {
        newSearchParams.delete(SORT_BY_SEARCH_PARAMETER)
      }

      if (data.order !== 'desc') {
        newSearchParams.set(SORT_ORDER_SEARCH_PARAMETER, data.order)
      } else {
        newSearchParams.delete(SORT_ORDER_SEARCH_PARAMETER)
      }

      return newSearchParams
    })

    if (closeBtnRef.current) {
      closeBtnRef.current.dataset.gaValue = `${data.metric}-${data.order}`
      closeBtnRef.current.click()
    }
  }

  return (
    <Popover onOpenChange={(open) => open && reset({ metric, order })}>
      <PopoverTrigger asChild>
        <Button variant="outline" data-ga-label="ga-team-discipline-start-update-sort-button">
          <ArrowDownUp aria-hidden />
          Sort
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <section>
            <div className="text-sm font-medium">Sort by</div>
            <RadioGroup value={watch('metric')} onValueChange={(value) => setValue('metric', value as SortMetric)} className="mt-2 gap-2">
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
            <div className="text-sm font-medium">Order by</div>
            <RadioGroup
              value={watch('order')}
              onValueChange={(value) => setValue('order', value as SortOrder)}
              className="mt-2 flex-row gap-4"
            >
              {SORT_ORDERS.map(({ value, label }) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`sort-order-${value}`} data-ga-label={`ga-team-discipline-sort-order-${value}-radio`} />
                  <Label htmlFor={`sort-order-${value}`} className="font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </section>

          <Button type="submit" className="mt-2">
            Update sort
          </Button>
        </form>

        <PopoverClose asChild>
          <Button data-ga-label="ga-team-discipline-finish-update-sort-button" ref={closeBtnRef} hidden>
            Close
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

type ChartGrid = '2' | '1'

const CHART_GRIDS = [
  { value: '1', label: '1 column' },
  { value: '2', label: '2 columns' },
] as const satisfies ReadonlyArray<{ value: ChartGrid; label: string }>

interface DisplaySelectorProps {
  hiddenSections: ReadonlySet<DisplayKey>
  hiddenMetrics: ReadonlySet<SortMetric>
  chartGrid: ChartGrid
}

/**
 * Submit-to-apply display popover, following the roles selector pattern in
 * insights.official-assignments. The checkboxes preview inside the form (they hold the *visible*
 * items); only submitting applies the values into the URL's search parameters, which the loader
 * parses back. Illustrations toggle whole sections; Metrics toggle the matching table columns and
 * chart series; Chart grid picks the charts' column layout (full team names on the x-axis when a
 * single column yields wide charts).
 */
function DisplaySelector({ hiddenSections, hiddenMetrics, chartGrid }: DisplaySelectorProps) {
  const [, setSearchParams] = useSearchParams()
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const currentVisibleSections = DISPLAY_OPTIONS.map(({ key }) => key).filter((key) => !hiddenSections.has(key))
  const currentVisibleMetrics = DISPLAY_METRICS.map(({ key }) => key).filter((key) => !hiddenMetrics.has(key))
  const { control, handleSubmit, reset, watch, setValue } = useForm<{
    illustrations: string[]
    metrics: string[]
    chartGrid: ChartGrid
  }>({
    defaultValues: { illustrations: currentVisibleSections, metrics: currentVisibleMetrics, chartGrid },
  })

  function onSubmit(data: { illustrations: string[]; metrics: string[]; chartGrid: ChartGrid }) {
    // Persist only the non-default states, so the parameterless URL stays the pristine view.
    setSearchParams((prev) => {
      const newSearchParams = new URLSearchParams(prev)
      const hiddenSectionKeys = DISPLAY_OPTIONS.map(({ key }) => key).filter((key) => !data.illustrations.includes(key))
      const hiddenMetricKeys = DISPLAY_METRICS.map(({ key }) => key).filter((key) => !data.metrics.includes(key))

      if (hiddenSectionKeys.length > 0) {
        newSearchParams.set(DISPLAY_ILLUSTRATIONS_SEARCH_PARAMETER, hiddenSectionKeys.join(','))
      } else {
        newSearchParams.delete(DISPLAY_ILLUSTRATIONS_SEARCH_PARAMETER)
      }

      if (hiddenMetricKeys.length > 0) {
        newSearchParams.set(DISPLAY_METRICS_SEARCH_PARAMETER, hiddenMetricKeys.join(','))
      } else {
        newSearchParams.delete(DISPLAY_METRICS_SEARCH_PARAMETER)
      }

      if (data.chartGrid === '2') {
        newSearchParams.delete(CHART_GRID_SEARCH_PARAMETER)
      } else {
        newSearchParams.set(CHART_GRID_SEARCH_PARAMETER, data.chartGrid)
      }

      return newSearchParams
    })

    if (closeBtnRef.current) {
      closeBtnRef.current.dataset.gaValue = `${data.illustrations.join(',')}|${data.metrics.join(',')}|${data.chartGrid}`
      closeBtnRef.current.click()
    }
  }

  return (
    <Popover onOpenChange={(open) => open && reset({ illustrations: currentVisibleSections, metrics: currentVisibleMetrics, chartGrid })}>
      <PopoverTrigger asChild>
        <Button variant="outline" data-ga-label="ga-team-discipline-start-update-display-button">
          <SlidersHorizontal aria-hidden />
          Display
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <section>
            <div className="text-sm font-medium">Illustrations</div>
            <div className="mt-2 flex flex-col gap-2.5">
              {DISPLAY_OPTIONS.map(({ key, label }) => (
                <CheckboxWithField
                  key={key}
                  value={key}
                  name="illustrations"
                  control={control}
                  defaultChecked={currentVisibleSections.includes(key)}
                  getNextValue={(checked, v) => {
                    const nextValue = [...v]
                    if (checked) {
                      nextValue.push(key)
                    } else {
                      nextValue.splice(nextValue.indexOf(key), 1)
                    }

                    return nextValue
                  }}
                  formatValue={() => label}
                  data-ga-label={`ga-team-discipline-toggle-display-${key}-checkbox`}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="text-sm font-medium">Metrics</div>
            <div className="mt-2 flex flex-col gap-2.5">
              {DISPLAY_METRICS.map(({ key, label }) => (
                <CheckboxWithField
                  key={key}
                  value={key}
                  name="metrics"
                  control={control}
                  defaultChecked={currentVisibleMetrics.includes(key)}
                  getNextValue={(checked, v) => {
                    const nextValue = [...v]
                    if (checked) {
                      nextValue.push(key)
                    } else {
                      nextValue.splice(nextValue.indexOf(key), 1)
                    }

                    return nextValue
                  }}
                  formatValue={() => label}
                  data-ga-label={`ga-team-discipline-toggle-metric-${key}-checkbox`}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="text-sm font-medium">Chart grid</div>
            <RadioGroup
              value={watch('chartGrid')}
              onValueChange={(value) => setValue('chartGrid', value as ChartGrid)}
              className="mt-2 flex-row gap-4"
            >
              {CHART_GRIDS.map(({ value, label }) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`chart-grid-${value}`} data-ga-label={`ga-team-discipline-chart-grid-${value}-radio`} />
                  <Label htmlFor={`chart-grid-${value}`} className="font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </section>

          <Button type="submit" className="mt-2">
            Update display
          </Button>
        </form>

        <PopoverClose asChild>
          <Button data-ga-label="ga-team-discipline-finish-update-display-button" ref={closeBtnRef} hidden>
            Close
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}
