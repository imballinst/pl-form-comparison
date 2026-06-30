import { CheckboxWithField } from '@/components/custom/form'
import { Header } from '@/components/custom/header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import { toPercentage, truncateDecimals } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AllSeasonMatchOfficialAssignmentTableData, MatchFullStatData, RefereeAdditionalInformation } from '@/types'
import { formatSeason } from '@/utils/match'
import { AVAILABLE_SEASONS, OFFICIAL_ROLES, fetchMatchOfficialAssignments } from '@/utils/seasons-fetcher'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type HeaderGroup,
  type Row,
  type Header as TanstackHeaderType,
  type Table as TanstackTableType,
} from '@tanstack/react-table'
import { Virtualizer, useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { ChevronDown, LoaderIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/compare.remaining-matches'

type GameStat = keyof ReturnType<typeof getGameStats>
type RefereeStat = Exclude<keyof RefereeAdditionalInformation, 'score'>

const SEASONS_PARAMETER = 'seasons'
const ROLES_PARAMETER = 'roles'
const DEFAULT_SELECTED_ROLES = (['Referee'] as Array<(typeof OFFICIAL_ROLES)[number]>).join(',')

const GAME_STATS = filterGameStatKeys(Object.keys(getGameStats()) as Array<GameStat>, [
  'totalDistance',
  'duelWon',
  'expectedGoals',
  'wonCorners',
])
const GAME_STATS_LABEL_RECORD: Record<(typeof GAME_STATS)[number], string> = {
  goals: 'Goals scored',
  goalsConceded: 'Goals conceded',
  // Fouls.
  fkFoulLost: 'Fouls',
  totalOffside: 'Offsides',
  penaltyConceded: 'Penalties conceded',
  totalYelCard: 'Yellow cards',
  totalRedCard: 'Red cards',
}
const REFEREE_STATS_LABEL_RECORD: Record<RefereeStat, { short: string; long: string }> = {
  wdl: {
    short: 'WR',
    long: 'Win rate',
  },
  foulsPerRedCard: {
    short: 'FPR',
    long: 'Fouls per red card',
  },
  foulsPerYellowCard: {
    short: 'FPY',
    long: 'Fouls per yellow card',
  },
}
const ROLES_LABEL_RECORD: Record<(typeof OFFICIAL_ROLES)[number], { short: string; long: string }> = {
  Referee: {
    short: 'Ref',
    long: 'Referee',
  },
  'Video Assistant Referee': {
    short: 'VAR',
    long: 'VAR',
  },
}
const ROLE_KEYS = Object.keys(ROLES_LABEL_RECORD)

export const handle = {
  pageHeightClassName: 'h-screen',
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { [SEASONS_PARAMETER]: seasons = CURRENT_SEASON, [ROLES_PARAMETER]: roles = DEFAULT_SELECTED_ROLES } = Object.fromEntries(
    new URL(request.url).searchParams,
  )
  const seasonsArray = seasons.split(',').sort()
  const rolesArray = roles.split(',').sort((a, b) => ROLE_KEYS.indexOf(a) - ROLE_KEYS.indexOf(b))

  const result = await fetchMatchOfficialAssignments(seasonsArray, rolesArray)

  return { ...result, seasons: seasonsArray, roles: rolesArray }
}

export default function MatchOfficialAssignments() {
  const { perSeasonRecord, allSeasons, seasons, roles } = useLoaderData<typeof clientLoader>()
  const isMobile = useIsMobile()
  const [selectedCell, setSelectedCell] = useState<[AllSeasonMatchOfficialAssignmentTableData, string] | null>(null)
  const openDialogBtnRef = useRef<HTMLButtonElement>(null)

  const columns = useMemo<ColumnDef<AllSeasonMatchOfficialAssignmentTableData>[]>(
    () => [
      {
        header: 'Team',
        accessorFn(row) {
          return row.name
        },
      },
      ...allSeasons.officialNames.map(
        (name) =>
          ({
            id: name,
            header: name,
            accessorFn: (row) => row,
            meta: {
              type: 'referee',
            },
            cell(row) {
              const rowValue = row.getValue<AllSeasonMatchOfficialAssignmentTableData>()
              const refereeData = rowValue.referees[name]

              return (
                !!refereeData?.totalScore && (
                  <div className="flex">
                    <div className="flex flex-col items-start gap-y-2">
                      <Button
                        className="flex gap-0.5 underline size-auto! p-0 text-xs"
                        variant="link"
                        size="sm"
                        data-ga-label="ga-official-assignments-view-referee-detail-button"
                        data-ga-value={`${name} - ${rowValue.name}`}
                        onClick={() => {
                          setSelectedCell([rowValue, name])
                          openDialogBtnRef.current?.click()
                        }}
                      >
                        {seasons.map((season) => refereeData.perSeasonRecord[season]?.score ?? 0).join(' → ')} games
                      </Button>

                      <div className="flex flex-col gap-y-2">
                        {seasons.map((season) => (
                          <div key={season}>
                            <div className="font-bold">{formatSeason(season)}</div>
                            <ol>
                              {Object.entries(refereeData.perSeasonRecord[season] ?? {})
                                .filter(([stat]) => REFEREE_STATS_LABEL_RECORD[stat as RefereeStat])
                                .map(([stat, value]) => (
                                  <li key={stat}>
                                    {REFEREE_STATS_LABEL_RECORD[stat as RefereeStat].short}:{' '}
                                    {value === -1 ? '-' : stat === 'wdl' ? getWinrate(refereeData.perSeasonRecord[season].wdl) : value}
                                  </li>
                                ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              )
            },
          }) satisfies ColumnDef<AllSeasonMatchOfficialAssignmentTableData>,
      ),
    ],
    [isMobile, seasons, allSeasons.officialNames],
  )
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const table = useReactTable({
    data: allSeasons.tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibleColumns = table.getVisibleLeafColumns()
  const columnVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableCellElement>({
    count: visibleColumns.length,
    estimateSize: (index) => visibleColumns[index].getSize(),
    getScrollElement: () => tableContainerRef.current,
    horizontal: true,
    overscan: 3,
  })

  const virtualColumns = columnVirtualizer.getVirtualItems()
  let virtualPaddingLeft: number | undefined
  let virtualPaddingRight: number | undefined

  if (columnVirtualizer && virtualColumns?.length) {
    virtualPaddingLeft = virtualColumns[0]?.start ?? 0
    virtualPaddingRight = columnVirtualizer.getTotalSize() - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
  }

  return (
    <>
      <title>Match Official Assignments | Premier League Form Comparison</title>

      <Header
        heading="Match Official Assignments"
        description={
          <>
            Compare the match official assignments between clubs and get insights on the stats. The greener a cell is, the more often they
            officiate the club in the selected seasons. Click on an underlined text in a table cell to view the stats of a team per
            official. <Legend />
          </>
        }
      />

      <div className="flex flex-col gap-y-4 flex-1 min-h-0">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SeasonsSelector seasons={seasons} />

          <RolesSelector roles={roles} />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <Table
            className="tabular-nums text-xs grid"
            containerProps={{
              ref: tableContainerRef,
              style: {
                overflow: 'auto',
                position: 'relative',
                height: '100%',
              },
            }}
          >
            <TableHeadComponent
              columnVirtualizer={columnVirtualizer}
              table={table}
              virtualPaddingLeft={virtualPaddingLeft}
              virtualPaddingRight={virtualPaddingRight}
            />
            <TableBodyComponent
              columnVirtualizer={columnVirtualizer}
              table={table}
              tableContainerRef={tableContainerRef}
              virtualPaddingLeft={virtualPaddingLeft}
              virtualPaddingRight={virtualPaddingRight}
            />
          </Table>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button hidden ref={openDialogBtnRef} />
        </DialogTrigger>

        <DialogContent className="flex flex-col gap-y-4 min-h-[525px]">
          {(() => {
            if (!selectedCell) {
              return (
                <div className="w-full flex justify-center items-center">
                  <LoaderIcon className="animate-spin" />
                </div>
              )
            }

            const [row, name] = selectedCell
            const totalNumberOfGamesAcrossSeasons = 38 * seasons.length

            const roles: Record<string, number> = {}
            const assignmentCountPerSeason: Record<string, number> = {}
            const totalStatsPerSeason: Record<string, Record<string, number>> = {}

            for (const season of seasons) {
              const refereeEntry = perSeasonRecord[season].teamsRecord[row.name]?.referees ?? {}
              const officiatingAssignments = (
                refereeEntry[name] ? Object.entries(refereeEntry[name].Home).concat(Object.entries(refereeEntry[name].Away)) : []
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

                    totalStats[statKey] += perSeasonRecord[season].matchStatRecord[matchId][row.name][statKey as keyof MatchFullStatData]
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
              <>
                <DialogHeader>
                  <DialogTitle>
                    {selectedCell?.[1]} officiating stats for {selectedCell?.[0].name}
                  </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-y-4">
                  <div>
                    {name} is assigned to {row.name}'s matches in {row.referees[name].totalScore} out of {totalNumberOfGamesAcrossSeasons}{' '}
                    matches (<strong>{toPercentage(row.referees[name].totalScore / totalNumberOfGamesAcrossSeasons)}</strong>
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
                        <TableHead>Stat (total)</TableHead>
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
                            {assignmentCountPerSeason[season] ?? '-'}
                          </TableCell>
                        ))}
                      </TableRow>

                      <TableRow>
                        <TableCell>Wins/draws/losses</TableCell>
                        {seasons.map((season) => (
                          <TableCell key={season} className="text-right">
                            {row.referees[name].perSeasonRecord[season]?.wdl.join('/') ?? '-'}
                          </TableCell>
                        ))}
                      </TableRow>

                      {Object.keys(GAME_STATS_LABEL_RECORD).map((stat) => (
                        <TableRow key={stat}>
                          <TableCell>{GAME_STATS_LABEL_RECORD[stat as keyof typeof GAME_STATS_LABEL_RECORD]}</TableCell>
                          {seasons.map((season) => (
                            <TableCell key={season} className="text-right">
                              {totalStatsPerSeason[season][stat] ?? '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </>
  )
}

interface TableBodyComponentProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>
  table: TanstackTableType<AllSeasonMatchOfficialAssignmentTableData>
  tableContainerRef: React.RefObject<HTMLDivElement | null>
  virtualPaddingLeft: number | undefined
  virtualPaddingRight: number | undefined
}

function TableBodyComponent({
  columnVirtualizer,
  table,
  tableContainerRef,
  virtualPaddingLeft,
  virtualPaddingRight,
}: TableBodyComponentProps) {
  const { rows } = table.getRowModel()

  //dynamic row height virtualization - alternatively you could use a simpler fixed row height strategy without the need for `measureElement`
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    estimateSize: () => 33, //estimate row height for accurate scrollbar dragging
    getScrollElement: () => tableContainerRef.current,
    //measure dynamic row height, except in firefox because it measures table border height incorrectly
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  })

  return (
    <TableBody
      style={{
        display: 'grid',
        height: `${rowVirtualizer.getTotalSize()}px`, //tells scrollbar how big the table is
        position: 'relative', //needed for absolute positioning of rows
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index] as Row<AllSeasonMatchOfficialAssignmentTableData>
        return (
          <TableBodyRow
            columnVirtualizer={columnVirtualizer}
            key={row.id}
            row={row}
            rowVirtualizer={rowVirtualizer}
            virtualPaddingLeft={virtualPaddingLeft}
            virtualPaddingRight={virtualPaddingRight}
            virtualRow={virtualRow}
          />
        )
      })}
    </TableBody>
  )
}

interface TableBodyRowProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>
  row: Row<AllSeasonMatchOfficialAssignmentTableData>
  rowVirtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>
  virtualPaddingLeft: number | undefined
  virtualPaddingRight: number | undefined
  virtualRow: VirtualItem
}

function TableBodyRow({ columnVirtualizer, row, rowVirtualizer, virtualPaddingLeft, virtualPaddingRight, virtualRow }: TableBodyRowProps) {
  const visibleCells = row.getVisibleCells()
  const virtualColumns = columnVirtualizer.getVirtualItems()

  return (
    <TableRow
      data-index={virtualRow.index} //needed for dynamic row height measurement
      ref={(node) => rowVirtualizer.measureElement(node)} //measure dynamic row height
      key={row.id}
      style={{
        display: 'flex',
        position: 'absolute',
        transform: `translateY(${virtualRow.start}px)`, //this should always be a `style` as it changes on scroll
        width: '100%',
      }}
    >
      {virtualPaddingLeft ? (
        //fake empty column to the left for virtualization scroll padding
        <td style={{ display: 'flex', width: virtualPaddingLeft }} />
      ) : null}

      {(() => {
        const cell = visibleCells[0]
        return (
          <TableHead
            key={cell.id}
            className="flex items-center whitespace-normal sticky left-0 bg-white! h-[unset]"
            style={{
              width: cell.column.getSize(),
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableHead>
        )
      })()}

      {virtualColumns.map((vc) => {
        const cell = visibleCells[vc.index + 1]
        const refereeKey = cell.column.columnDef.header?.toString() ?? ''
        const isRefereeColumn = cell.column.columnDef.meta?.type === 'referee'

        return (
          <TableCell
            key={cell.id}
            className="flex items-center whitespace-normal"
            style={{
              width: cell.column.getSize(),
              background: isRefereeColumn
                ? (cell.getValue<AllSeasonMatchOfficialAssignmentTableData>().referees[refereeKey]?.background ?? 'black')
                : undefined,
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      })}
      {virtualPaddingRight ? (
        //fake empty column to the right for virtualization scroll padding
        <td style={{ display: 'flex', width: virtualPaddingRight }} />
      ) : null}
    </TableRow>
  )
}

function SeasonsSelector({ seasons: seasonsArraySearchParams }: { seasons: string[] }) {
  const [, setSearchParams] = useSearchParams()

  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const { control, handleSubmit } = useForm({
    defaultValues: {
      seasons: seasonsArraySearchParams,
    },
  })

  function onSubmit(data: { seasons: string[] }) {
    setSearchParams((prev) => {
      const newSearchParams = new URLSearchParams(prev)
      const newSeasonsArray = data.seasons
      newSearchParams.set(SEASONS_PARAMETER, newSeasonsArray.sort().join(','))

      return newSearchParams
    })

    if (closeBtnRef.current) {
      closeBtnRef.current.dataset.gaValue = data.seasons.join(',')
      closeBtnRef.current.click()
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="flex justify-between" variant="outline" data-ga-label="ga-official-assignments-start-update-seasons-button">
          <div>Seasons: {seasonsArraySearchParams.join(', ')}</div>

          <ChevronDown />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex flex-col popover-available-width">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <FieldSet>
            <FieldLegend variant="label">Select seasons:</FieldLegend>
            <FieldGroup className="gap-3">
              {AVAILABLE_SEASONS.map((season) => (
                <CheckboxWithField
                  key={season}
                  value={season}
                  formatValue={(v) => formatSeason(v, 'long')}
                  name="seasons"
                  defaultChecked={seasonsArraySearchParams.includes(season)}
                  control={control}
                  getNextValue={(checked, v) => {
                    const nextValue = [...v]
                    if (checked) {
                      nextValue.push(season)
                    } else {
                      const idx = nextValue.indexOf(season)
                      nextValue.splice(idx, 1)
                    }

                    return nextValue
                  }}
                />
              ))}
            </FieldGroup>
          </FieldSet>

          <Button type="submit" className="mt-4">
            Update seasons
          </Button>
        </form>

        <PopoverClose asChild>
          <Button data-ga-label="ga-official-assignments-finish-update-seasons-button" ref={closeBtnRef} hidden>
            Close
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

function RolesSelector({ roles: rolesArraySearchParams }: { roles: string[] }) {
  const [, setSearchParams] = useSearchParams()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const isMobile = useIsMobile()
  const { control, handleSubmit } = useForm({
    defaultValues: {
      roles: rolesArraySearchParams,
    },
  })

  const labelLength = isMobile ? 'short' : 'long'

  function onSubmit(data: { roles: string[] }) {
    setSearchParams((prev) => {
      const newSearchParams = new URLSearchParams(prev)
      const newRolesArray = data.roles
      newSearchParams.set(ROLES_PARAMETER, newRolesArray.sort().join(','))

      return newSearchParams
    })

    if (closeBtnRef.current) {
      closeBtnRef.current.dataset.gaValue = data.roles.join(',')
      closeBtnRef.current.click()
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="flex justify-between" variant="outline" data-ga-label="ga-official-assignments-start-update-roles-button">
          <div>
            Roles:{' '}
            {rolesArraySearchParams.map((role) => ROLES_LABEL_RECORD[role as (typeof OFFICIAL_ROLES)[number]][labelLength]).join(', ')}
          </div>

          <ChevronDown />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex flex-col popover-available-width">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <FieldSet>
            <FieldLegend variant="label">Select roles:</FieldLegend>
            <FieldGroup className="gap-3">
              {OFFICIAL_ROLES.map((role) => (
                <CheckboxWithField
                  key={role}
                  value={role}
                  name="roles"
                  defaultChecked={rolesArraySearchParams.includes(role)}
                  control={control}
                  getNextValue={(checked, v) => {
                    const nextValue = [...v]
                    if (checked) {
                      nextValue.push(role)
                    } else {
                      const idx = nextValue.indexOf(role)
                      nextValue.splice(idx, 1)
                    }

                    return nextValue
                  }}
                />
              ))}
            </FieldGroup>
          </FieldSet>

          <Button type="submit" className="mt-4">
            Update roles
          </Button>
        </form>

        <PopoverClose asChild>
          <Button data-ga-label="ga-official-assignments-finish-update-roles-button" ref={closeBtnRef} hidden>
            Close
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

function Legend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          className="text-base p-0 text-[unset] underline decoration-dashed h-[unset]"
          data-ga-label="ga-official-assignments-show-legends-button"
        >
          Click here to display legends.
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-2 text-sm w-auto">
        <ul className="list-disc pl-4">
          {Object.values(REFEREE_STATS_LABEL_RECORD).map((v) => (
            <li key={v.short}>
              <span className="font-bold">{v.short}</span>: {v.long}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function getWinrate(wdl: [number, number, number]) {
  const total = wdl.reduce((sum, cur) => sum + cur, 0)
  if (total === 0) return '-'

  return toPercentage(truncateDecimals(wdl[0] / wdl.reduce((sum, cur) => sum + cur, 0)))
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

function filterGameStatKeys<T extends readonly GameStat[]>(original: GameStat[], excludedStats: T): Array<Exclude<GameStat, T[number]>> {
  return original.filter((stat): stat is Exclude<GameStat, T[number]> => !excludedStats.includes(stat))
}

interface TableHeadComponentProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>
  table: TanstackTableType<AllSeasonMatchOfficialAssignmentTableData>
  virtualPaddingLeft: number | undefined
  virtualPaddingRight: number | undefined
}

function TableHeadComponent({ columnVirtualizer, table, virtualPaddingLeft, virtualPaddingRight }: TableHeadComponentProps) {
  return (
    <TableHeader
      style={{
        display: 'grid',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <TableHeadComponentRow
          columnVirtualizer={columnVirtualizer}
          headerGroup={headerGroup}
          key={headerGroup.id}
          virtualPaddingLeft={virtualPaddingLeft}
          virtualPaddingRight={virtualPaddingRight}
        />
      ))}
    </TableHeader>
  )
}

interface TableHeadComponentRowProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>
  headerGroup: HeaderGroup<AllSeasonMatchOfficialAssignmentTableData>
  virtualPaddingLeft: number | undefined
  virtualPaddingRight: number | undefined
}

function TableHeadComponentRow({ columnVirtualizer, headerGroup, virtualPaddingLeft, virtualPaddingRight }: TableHeadComponentRowProps) {
  const virtualColumns = columnVirtualizer.getVirtualItems()
  return (
    <TableRow key={headerGroup.id} style={{ display: 'flex', width: '100%' }}>
      {virtualPaddingLeft ? (
        //fake empty column to the left for virtualization scroll padding
        <th style={{ display: 'flex', width: virtualPaddingLeft }} />
      ) : null}

      {(() => {
        const header = headerGroup.headers[0]
        return <TableHeadComponentCell key={header.id} header={header} className="sticky left-0" />
      })()}
      {virtualColumns.map((virtualColumn) => {
        const header = headerGroup.headers[virtualColumn.index + 1]
        return <TableHeadComponentCell key={header.id} header={header} />
      })}

      {virtualPaddingRight ? (
        //fake empty column to the right for virtualization scroll padding
        <th style={{ display: 'flex', width: virtualPaddingRight }} />
      ) : null}
    </TableRow>
  )
}

interface TableHeadComponentCellProps {
  header: TanstackHeaderType<AllSeasonMatchOfficialAssignmentTableData, unknown>
  className?: string
}

function TableHeadComponentCell({ header, className }: TableHeadComponentCellProps) {
  return (
    <TableHead
      key={header.id}
      className={cn('h-10 flex items-center', className)}
      style={{
        width: header.getSize(),
      }}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
    </TableHead>
  )
}
