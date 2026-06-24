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
import type { MatchFullStatData, RefereeAdditionalInformation } from '@/types'
import { formatSeason } from '@/utils/match'
import { AVAILABLE_SEASONS, OFFICIAL_ROLES, fetchMatchOfficialAssignments } from '@/utils/seasons-fetcher'
import { ChevronDown, LoaderIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/compare.remaining-matches'

type GameStat = keyof ReturnType<typeof getGameStats>
type RefereeStat = Exclude<keyof RefereeAdditionalInformation, 'score'>

const SEASONS_PARAMETER = 'seasons'
const ROLES_PARAMETER = 'roles'
const DEFAULT_SELECTED_ROLES = OFFICIAL_ROLES.join(',')

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
  'Assistant VAR Official': {
    short: 'AVAR',
    long: 'Assistant VAR',
  },
  'Video Assistant Referee': {
    short: 'VAR',
    long: 'VAR',
  },
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { [SEASONS_PARAMETER]: seasons = CURRENT_SEASON, [ROLES_PARAMETER]: roles = DEFAULT_SELECTED_ROLES } = Object.fromEntries(
    new URL(request.url).searchParams,
  )
  const seasonsArray = seasons.split(',').sort()
  const rolesArray = roles.split(',').sort()

  console.info('start', new Date().toISOString())
  const result = await fetchMatchOfficialAssignments(seasonsArray, rolesArray)
  console.info('end', new Date().toISOString())

  return { ...result, seasons: seasonsArray, roles: rolesArray }
}

export default function MatchOfficialAssignments() {
  const { perSeasonRecord, allSeasons, seasons, roles } = useLoaderData<typeof clientLoader>()
  const isMobile = useIsMobile()
  const [dialogKey, setDialogKey] = useState<string | null>(null)

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

      <div className="flex flex-col gap-y-4">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SeasonsSelector seasons={seasons} />

          <RolesSelector roles={roles} />
        </div>

        <div>
          <Table className="tabular-nums text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0">Team</TableHead>
                {allSeasons.officialNames.map((name) => (
                  <TableHead key={name}>{name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSeasons.tableData.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="sticky left-0 bg-white">{isMobile ? row.abbr : row.name}</TableCell>
                  {allSeasons.officialNames.map((name) => (
                    <TableCell
                      key={name}
                      style={{
                        background: row.referees[name]?.background ?? 'black',
                      }}
                    >
                      {!!row.referees[name]?.totalScore && (
                        <div className="flex">
                          <Dialog>
                            <div className="flex flex-col items-start gap-y-2">
                              <DialogTrigger asChild>
                                <Button
                                  className="flex gap-0.5 underline size-auto! p-0 text-xs"
                                  variant="link"
                                  size="sm"
                                  data-ga-label="ga-official-assignments-view-referee-detail-button"
                                  data-ga-value={`${name} - ${row.name}`}
                                >
                                  {seasons.map((season) => row.referees[name].perSeasonRecord[season]?.score ?? 0).join(' → ')} games
                                </Button>
                              </DialogTrigger>

                              <div className="flex flex-col gap-y-2">
                                {seasons.map((season) => (
                                  <div key={season}>
                                    <div className="font-bold">{formatSeason(season)}</div>
                                    <ol>
                                      {Object.entries(row.referees[name].perSeasonRecord[season] ?? {})
                                        .filter(([stat]) => REFEREE_STATS_LABEL_RECORD[stat as RefereeStat])
                                        .map(([stat, value]) => (
                                          <li key={stat}>
                                            {REFEREE_STATS_LABEL_RECORD[stat as RefereeStat].short}:{' '}
                                            {value === -1
                                              ? '-'
                                              : stat === 'wdl'
                                                ? getWinrate(row.referees[name].perSeasonRecord[season].wdl)
                                                : value}
                                          </li>
                                        ))}
                                    </ol>
                                  </div>
                                ))}
                              </div>
                            </div>

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
                                        <strong>{toPercentage(row.referees[name].totalScore / totalNumberOfGamesAcrossSeasons)}</strong>
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
                                                {assignmentCountPerSeason[season]}
                                              </TableCell>
                                            ))}
                                          </TableRow>

                                          <TableRow>
                                            <TableCell>Wins/draws/losses</TableCell>
                                            {seasons.map((season) => (
                                              <TableCell key={season} className="text-right">
                                                {row.referees[name].perSeasonRecord[season].wdl.join('/')}
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
