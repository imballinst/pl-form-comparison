import { Header } from '@/components/custom/header'
import {
  PLOTS,
  RefereeVenueInfluenceChart,
  SCATTER_COLORS,
  type Plot,
  type RefereeVenueInfluenceDatum,
  type RefereeVenueStats,
} from '@/components/custom/referee-venue-influence-chart'
import { SeasonsSelector } from '@/components/custom/seasons-selector'
import { Button } from '@/components/ui/button'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { CURRENT_SEASON } from '@/constants'
import { truncateDecimals } from '@/lib/format'
import type { MatchFullStatData } from '@/types'
import { formatSeason } from '@/utils/match'
import { fetchMatchOfficialAssignments } from '@/utils/seasons-fetcher'
import { ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLoaderData, useSearchParams } from 'react-router'
import type { Route } from './+types/insights.referee-venue-influence'

const SEASONS_PARAMETER = 'seasons'
const PLOT_PARAMETER = 'plot'
const REFEREES_PARAMETER = 'referees'
const REFEREE_PRESET_PARAMETER = 'referee-preset'
const TOP_MATCHES_PRESET = 'top-matches'

interface VenueTotals {
  matches: number
  fouls: number
  yellowCards: number
  redCards: number
}

interface RefereeTotals {
  home: VenueTotals
  away: VenueTotals
}

function newRefereeTotals(): RefereeTotals {
  return {
    home: { matches: 0, fouls: 0, yellowCards: 0, redCards: 0 },
    away: { matches: 0, fouls: 0, yellowCards: 0, redCards: 0 },
  }
}

// Each match appears once per side: under the home team's Home entry and the away team's Away entry,
// so accumulating per side counts every officiated match exactly once. Fouls follow the Match
// Official Assignments derivation (fouls committed plus penalties conceded).
function accumulateVenueTotals(
  totals: VenueTotals,
  matchIds: number[],
  matchStatRecord: Record<string, Record<string, MatchFullStatData>>,
  team: string,
) {
  for (const matchId of matchIds) {
    const stats = matchStatRecord[matchId]?.[team]
    if (!stats) continue

    totals.matches += 1
    totals.fouls += stats.fkFoulLost + stats.penaltyConceded
    totals.yellowCards += stats.totalYelCard
    totals.redCards += stats.totalRedCard
  }
}

function getVenueStats(totals: VenueTotals): RefereeVenueStats {
  return {
    foulsPerGame: totals.matches ? truncateDecimals(totals.fouls / totals.matches) : 0,
    yellowCardsPerGame: totals.matches ? truncateDecimals(totals.yellowCards / totals.matches) : 0,
    redCardsPerGame: totals.matches ? truncateDecimals(totals.redCards / totals.matches) : 0,
    foulsPerYellowCard: totals.yellowCards ? truncateDecimals(totals.fouls / totals.yellowCards) : undefined,
    foulsPerRedCard: totals.redCards ? truncateDecimals(totals.fouls / totals.redCards) : undefined,
  }
}

function getRefereeVenueInfluenceDatum(name: string, totals: RefereeTotals): RefereeVenueInfluenceDatum {
  // Every officiated match appears once as the home team's Home entry, so the home side alone
  // counts the matches; summing both sides would double-count them.
  const matches = totals.home.matches
  const fouls = totals.home.fouls + totals.away.fouls
  const yellowCards = totals.home.yellowCards + totals.away.yellowCards
  const redCards = totals.home.redCards + totals.away.redCards

  return {
    name,
    matches,
    home: getVenueStats(totals.home),
    away: getVenueStats(totals.away),
    yellowCards,
    foulsPerYellowCard: yellowCards ? truncateDecimals(fouls / yellowCards) : undefined,
    redCards,
    foulsPerRedCard: redCards ? truncateDecimals(fouls / redCards) : undefined,
  }
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const searchParams = new URL(request.url).searchParams
  const { [SEASONS_PARAMETER]: seasons = CURRENT_SEASON } = Object.fromEntries(searchParams)
  const seasonsArray = seasons.split(',').filter(Boolean).sort()

  // Absent or unknown plot parameter means the default, keeping the parameterless URL pristine.
  const plotParam = searchParams.get(PLOT_PARAMETER)
  const plot: Plot = PLOTS.some(({ value }) => value === plotParam) ? (plotParam as Plot) : 'fouls'

  const { chartDataPerSeason, refereeNames, topMatchesRefereeNames, colorByName, paddedAxisMax } = await buildSelectionData(
    seasonsArray,
    plot,
  )

  // Selection persistence for shared links: a referee-preset parameter picks the top-matches preset, a
  // referees list picks those names (unknown ones are dropped); when both are present, the preset wins.
  const refereePresetParam = searchParams.get(REFEREE_PRESET_PARAMETER)
  const refereesParam = searchParams.get(REFEREES_PARAMETER)
  let initialPinnedReferees: string[] = []
  if (refereePresetParam === TOP_MATCHES_PRESET) {
    initialPinnedReferees = topMatchesRefereeNames
  } else if (refereesParam) {
    const requestedNames = new Set(refereesParam.split(',').filter(Boolean))
    initialPinnedReferees = refereeNames.filter((name) => requestedNames.has(name))
  }

  return {
    seasons: seasonsArray,
    chartDataPerSeason,
    plot,
    refereeNames,
    topMatchesRefereeNames,
    initialPinnedReferees,
    colorByName,
    paddedAxisMax,
  }
}

export default function RefereeVenueInfluence() {
  const { seasons, chartDataPerSeason, plot, refereeNames, topMatchesRefereeNames, initialPinnedReferees, colorByName, paddedAxisMax } =
    useLoaderData<typeof clientLoader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [hoveredReferee, setHoveredReferee] = useState<string | null>(null)
  const [pinnedReferees, setPinnedReferees] = useState<ReadonlySet<string>>(() => new Set(initialPinnedReferees))

  // Every selection change rewrites the selection parameters for shareable links: the preset parameter
  // while a preset is active, the sorted name list otherwise, both deleted when the selection is empty.
  function persistSelection(pinned: ReadonlySet<string>, preset: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(REFEREE_PRESET_PARAMETER)
        next.delete(REFEREES_PARAMETER)

        if (preset) {
          next.set(REFEREE_PRESET_PARAMETER, preset)
        } else if (pinned.size > 0) {
          next.set(REFEREES_PARAMETER, [...pinned].sort().join(','))
        }

        return next
      },
      { replace: true },
    )
  }

  // Hovering adds a transient highlight on top of the pinned ones; the Set dedupes when both cover
  // the same referee.
  const highlightedReferees = new Set(pinnedReferees)
  if (hoveredReferee) {
    highlightedReferees.add(hoveredReferee)
  }

  return (
    <>
      <title>Referee Venue Influence | Premier League Form Comparison</title>

      <Header
        heading="Referee Venue Influence"
        description={
          <>
            You may wonder how easily influenced a referee is, how easily rattled they are by the home fans. After all, there is a thing
            called "home advantage". Whenever a home player falls, there is a sudden roar in the entire stadium, maybe unconsciously forcing
            the referee to blow their whistle.
          </>
        }
      />

      <div className="flex flex-col gap-y-4 flex-1 min-h-0">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SeasonsSelector seasons={seasons} gaLabelPrefix="ga-referee-venue-influence" />

          <PlotSelector plot={plot} />

          <RefereeSelector
            colorByName={colorByName}
            refereeNames={refereeNames}
            isTopMatchesPreset={searchParams.get(REFEREE_PRESET_PARAMETER) === TOP_MATCHES_PRESET}
            pinnedReferees={pinnedReferees}
            onHover={setHoveredReferee}
            onTogglePin={(name) => {
              const next = new Set(pinnedReferees)
              if (next.has(name)) {
                next.delete(name)
              } else {
                next.add(name)
              }
              setPinnedReferees(next)
              // Toggling names always persists the explicit list, even when it happens to match a preset.
              persistSelection(next, null)
            }}
            onApplyPreset={() => {
              const next = new Set(topMatchesRefereeNames)
              setPinnedReferees(next)
              persistSelection(next, TOP_MATCHES_PRESET)
            }}
            onClearPins={() => {
              const next = new Set<string>()
              setPinnedReferees(next)
              persistSelection(next, null)
            }}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {seasons.map((season) => (
            <RefereeVenueInfluenceChart
              key={season}
              title={formatSeason(season, 'long')}
              data={chartDataPerSeason[season] ?? []}
              plot={plot}
              paddedAxisMax={paddedAxisMax}
              colorByName={colorByName}
              highlightedReferees={highlightedReferees}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// Highlight picker: hovering a referee pinpoints their bubble in every chart, clicking pins the
// highlight, and presets replace the whole selection in one click.
function RefereeSelector({
  colorByName,
  refereeNames,
  isTopMatchesPreset,
  pinnedReferees,
  onHover,
  onTogglePin,
  onApplyPreset,
  onClearPins,
}: {
  colorByName: Record<string, string>
  refereeNames: string[]
  isTopMatchesPreset: boolean
  pinnedReferees: ReadonlySet<string>
  onHover: (name: string | null) => void
  onTogglePin: (name: string) => void
  onApplyPreset: () => void
  onClearPins: () => void
}) {
  const [query, setQuery] = useState('')
  const matches = refereeNames.filter((name) => name.toLowerCase().includes(query.toLowerCase()))
  const firstPinned = [...pinnedReferees][0]
  const label =
    pinnedReferees.size === 0
      ? 'Referee: All'
      : pinnedReferees.size === 1
        ? `Referee: ${firstPinned}`
        : `Referees: ${pinnedReferees.size} selected`

  return (
    <Popover onOpenChange={(open) => !open && onHover(null)}>
      <PopoverTrigger asChild>
        <Button className="flex justify-between w-full" variant="outline" data-ga-label="ga-referee-venue-influence-open-referees-button">
          <div className="flex min-w-0 items-center gap-2">
            {firstPinned && <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colorByName[firstPinned] }} />}
            <span className="truncate">{label}</span>
          </div>

          <ChevronDown />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-3">
        <div className="flex flex-col gap-3">
          <FieldSet className="gap-1">
            <FieldLegend variant="label">By preset</FieldLegend>

            <div className="flex flex-col">
              <button
                type="button"
                onClick={onClearPins}
                data-ga-label="ga-referee-venue-influence-preset-no-preset"
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${pinnedReferees.size === 0 ? 'bg-accent' : ''}`}
              >
                No preset
              </button>
              <button
                type="button"
                onClick={onApplyPreset}
                data-ga-label="ga-referee-venue-influence-preset-top-10-matches"
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${isTopMatchesPreset ? 'bg-accent' : ''}`}
              >
                Top 10 number of matches
              </button>
            </div>
          </FieldSet>

          <FieldSet className="gap-2">
            <FieldLegend variant="label">By names</FieldLegend>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search referees"
              className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            <div className="max-h-64 overflow-y-auto" onMouseLeave={() => onHover(null)}>
              {matches.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseEnter={() => onHover(name)}
                  onFocus={() => onHover(name)}
                  onClick={() => onTogglePin(name)}
                  data-ga-label={`ga-referee-venue-influence-highlight-${name}`}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    pinnedReferees.has(name) ? 'bg-accent' : ''
                  }`}
                >
                  <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: colorByName[name] }} />
                  <span className="truncate">{name}</span>
                </button>
              ))}

              {matches.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No referee matches.</div>}
            </div>
          </FieldSet>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Submit-to-apply plot popover, following the sort selector pattern in insights.discipline. The
// radios preview inside the form; only submitting persists the value into the URL's search
// parameters, which the loader parses back. The plot applies to every chart on the page; the
// hover tooltip keeps showing the same fouls and card stats regardless of the selection.
function PlotSelector({ plot }: { plot: Plot }) {
  const [, setSearchParams] = useSearchParams()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const { watch, setValue, handleSubmit, reset } = useForm<{ plot: Plot }>({
    defaultValues: { plot },
  })
  const label = PLOTS.find(({ value }) => value === plot)!.label

  function onSubmit(data: { plot: Plot }) {
    setSearchParams((prev) => {
      const newSearchParams = new URLSearchParams(prev)

      if (data.plot !== 'fouls') {
        newSearchParams.set(PLOT_PARAMETER, data.plot)
      } else {
        newSearchParams.delete(PLOT_PARAMETER)
      }

      return newSearchParams
    })

    if (closeBtnRef.current) {
      closeBtnRef.current.dataset.gaValue = data.plot
      closeBtnRef.current.click()
    }
  }

  return (
    <Popover onOpenChange={(open) => open && reset({ plot })}>
      <PopoverTrigger asChild>
        <Button
          className="flex justify-between w-full"
          variant="outline"
          data-ga-label="ga-referee-venue-influence-start-update-plot-button"
        >
          <div>Plot: {label}</div>

          <ChevronDown />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <section>
            <div className="text-sm font-medium">Select plot:</div>
            <RadioGroup value={watch('plot')} onValueChange={(value) => setValue('plot', value as Plot)} className="mt-2">
              {PLOTS.map(({ value, label: optionLabel }) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`plot-${value}`} data-ga-label={`ga-referee-venue-influence-plot-${value}-radio`} />
                  <Label htmlFor={`plot-${value}`} className="font-normal">
                    {optionLabel}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </section>

          <Button type="submit" className="mt-2">
            Update plot
          </Button>
        </form>

        <PopoverClose asChild>
          <Button data-ga-label="ga-referee-venue-influence-finish-update-plot-button" ref={closeBtnRef} hidden>
            Close
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

// Chart inputs derived from the seasons and plot only. Every pin click re-runs the loader, so the
// results are cached per selection the same way the season data underneath them is cached.
interface SelectionData {
  chartDataPerSeason: Record<string, RefereeVenueInfluenceDatum[]>
  refereeNames: string[]
  topMatchesRefereeNames: string[]
  colorByName: Record<string, string>
  paddedAxisMax: number
}

const selectionDataCache: Record<string, SelectionData> = {}

async function buildSelectionData(seasonsArray: string[], plot: Plot): Promise<SelectionData> {
  const selectionKey = `${seasonsArray.join(',')}|${plot}`
  const cachedSelectionData = selectionDataCache[selectionKey]
  if (cachedSelectionData) {
    return cachedSelectionData
  }

  // Referees only: the on-field role, not the VAR one.
  const { perSeasonRecord } = await fetchMatchOfficialAssignments(seasonsArray, ['Referee'])

  const chartDataPerSeason: Record<string, RefereeVenueInfluenceDatum[]> = {}
  for (const season of seasonsArray) {
    const { teamsRecord, matchStatRecord } = perSeasonRecord[season]
    const totalsPerReferee: Record<string, RefereeTotals> = {}

    for (const team in teamsRecord) {
      for (const [refereeName, assignment] of Object.entries(teamsRecord[team].referees)) {
        const totals = (totalsPerReferee[refereeName] ??= newRefereeTotals())
        accumulateVenueTotals(totals.home, assignment.Home['Referee'], matchStatRecord, team)
        accumulateVenueTotals(totals.away, assignment.Away['Referee'], matchStatRecord, team)
      }
    }

    chartDataPerSeason[season] = Object.entries(totalsPerReferee)
      .filter(([, totals]) => totals.home.matches + totals.away.matches > 0)
      .map(([name, totals]) => getRefereeVenueInfluenceDatum(name, totals))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const refereeNames = [...new Set(seasonsArray.flatMap((season) => chartDataPerSeason[season].map(({ name }) => name)))].sort()
  // One mapping shared by every chart on the page: referees across all selected seasons sorted
  // alphabetically pick up palette colors in order, so a referee keeps the same bubble color
  // whether they appear in one season's chart or all of them.
  const colorByName: Record<string, string> = {}
  refereeNames.forEach((name, index) => {
    colorByName[name] = SCATTER_COLORS[index % SCATTER_COLORS.length]
  })

  // "Top 10 number of matches" preset candidates: referees ranked by matches officiated across all
  // selected seasons, ties broken alphabetically.
  const matchesPerReferee: Record<string, number> = {}
  for (const season of seasonsArray) {
    for (const { name, matches } of chartDataPerSeason[season]) {
      matchesPerReferee[name] = (matchesPerReferee[name] ?? 0) + matches
    }
  }
  const topMatchesRefereeNames = Object.entries(matchesPerReferee)
    .sort(([nameA, matchesA], [nameB, matchesB]) => matchesB - matchesA || nameA.localeCompare(nameB))
    .slice(0, 10)
    .map(([name]) => name)

  // Every chart on the page shares one axis max computed across all selected seasons, so the same
  // plot value spans the same distance everywhere and the seasons are visually comparable.
  const { datumKey } = PLOTS.find(({ value }) => value === plot)!
  const axisMax = Math.max(
    ...seasonsArray.flatMap((season) =>
      chartDataPerSeason[season].flatMap((datum) => [datum.home[datumKey] ?? 0, datum.away[datumKey] ?? 0]),
    ),
    0,
  )

  const selectionData: SelectionData = {
    chartDataPerSeason,
    refereeNames,
    topMatchesRefereeNames,
    colorByName,
    paddedAxisMax: Math.ceil(axisMax) + 1,
  }
  selectionDataCache[selectionKey] = selectionData
  return selectionData
}
