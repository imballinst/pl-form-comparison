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

  return { seasons: seasonsArray, chartDataPerSeason, plot }
}

export default function RefereeVenueInfluence() {
  const { seasons, chartDataPerSeason, plot } = useLoaderData<typeof clientLoader>()
  const [hoveredReferee, setHoveredReferee] = useState<string | null>(null)
  const [pinnedReferee, setPinnedReferee] = useState<string | null>(null)
  const highlightedReferee = hoveredReferee ?? pinnedReferee

  // One mapping shared by every chart on the page: referees across all selected seasons sorted
  // alphabetically pick up palette colors in order, so a referee keeps the same bubble color
  // whether they appear in one season's chart or all of them.
  const colorByName: Record<string, string> = {}
  const refereeNames = [...new Set(seasons.flatMap((season) => (chartDataPerSeason[season] ?? []).map(({ name }) => name)))].sort()
  refereeNames.forEach((name, index) => {
    colorByName[name] = SCATTER_COLORS[index % SCATTER_COLORS.length]
  })

  return (
    <>
      <title>Referee Venue Influence | Premier League Form Comparison</title>

      <Header
        heading="Referee Venue Influence"
        description={
          <>
            You may wonder how easily influenced a referee is, how easily rattled they are by the home fans. After all, there is a thing
            called "home advantage". Whenever a home player falls, there is a sudden noise in the entire stadium, maybe unconsciously
            forcing the referee to blow their whistle.
          </>
        }
      />

      <div className="flex flex-col gap-y-4 flex-1 min-h-0">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SeasonsSelector seasons={seasons} gaLabelPrefix="ga-referee-venue-influence" />

          <PlotSelector plot={plot} />

          <RefereeLegend
            colorByName={colorByName}
            refereeNames={refereeNames}
            pinnedReferee={pinnedReferee}
            onHover={setHoveredReferee}
            onPin={(name) => setPinnedReferee((pinned) => (pinned === name ? null : name))}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {seasons.map((season) => (
            <RefereeVenueInfluenceChart
              key={season}
              title={formatSeason(season, 'long')}
              data={chartDataPerSeason[season] ?? []}
              plot={plot}
              colorByName={colorByName}
              highlightedReferee={highlightedReferee}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// Highlight picker: hovering a referee name pinpoints that referee's bubble in every chart; clicking
// pins the highlight so it survives closing the popover, and clicking the pinned name again clears
// it. Hover highlights clear when the pointer leaves the list.
function RefereeLegend({
  colorByName,
  refereeNames,
  pinnedReferee,
  onHover,
  onPin,
}: {
  colorByName: Record<string, string>
  refereeNames: string[]
  pinnedReferee: string | null
  onHover: (name: string | null) => void
  onPin: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const matches = refereeNames.filter((name) => name.toLowerCase().includes(query.toLowerCase()))

  return (
    <Popover onOpenChange={(open) => !open && onHover(null)}>
      <PopoverTrigger asChild>
        <Button className="flex justify-between w-full" variant="outline" data-ga-label="ga-referee-venue-influence-open-referees-button">
          <div className="flex min-w-0 items-center gap-2">
            {pinnedReferee && <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colorByName[pinnedReferee] }} />}
            <span className="truncate">Referee{pinnedReferee ? `: ${pinnedReferee}` : ''}</span>
          </div>

          <ChevronDown />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search referees"
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        <div className="mt-2 max-h-64 overflow-y-auto" onMouseLeave={() => onHover(null)}>
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              onMouseEnter={() => onHover(name)}
              onFocus={() => onHover(name)}
              onClick={() => onPin(name)}
              data-ga-label={`ga-referee-venue-influence-highlight-${name}`}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${pinnedReferee === name ? 'bg-accent' : ''}`}
            >
              <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: colorByName[name] }} />
              <span className="truncate">{name}</span>
            </button>
          ))}

          {matches.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No referee matches.</div>}
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
