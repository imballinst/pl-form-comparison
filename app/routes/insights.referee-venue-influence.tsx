import { Header } from '@/components/custom/header'
import { RefereeVenueInfluenceChart, type RefereeVenueInfluenceDatum } from '@/components/custom/referee-venue-influence-chart'
import { SeasonsSelector } from '@/components/custom/seasons-selector'
import { CURRENT_SEASON } from '@/constants'
import { truncateDecimals } from '@/lib/format'
import type { MatchFullStatData } from '@/types'
import { formatSeason } from '@/utils/match'
import { fetchMatchOfficialAssignments } from '@/utils/seasons-fetcher'
import { useLoaderData } from 'react-router'
import type { Route } from './+types/insights.referee-venue-influence'

const SEASONS_PARAMETER = 'seasons'

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
    homeFoulsPerGame: totals.home.matches ? truncateDecimals(totals.home.fouls / totals.home.matches) : 0,
    awayFoulsPerGame: totals.away.matches ? truncateDecimals(totals.away.fouls / totals.away.matches) : 0,
    yellowCards,
    foulsPerYellowCard: yellowCards ? truncateDecimals(fouls / yellowCards) : undefined,
    redCards,
    foulsPerRedCard: redCards ? truncateDecimals(fouls / redCards) : undefined,
  }
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { [SEASONS_PARAMETER]: seasons = CURRENT_SEASON } = Object.fromEntries(new URL(request.url).searchParams)
  const seasonsArray = seasons.split(',').filter(Boolean).sort()

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

  return { seasons: seasonsArray, chartDataPerSeason }
}

export default function RefereeVenueInfluence() {
  const { seasons, chartDataPerSeason } = useLoaderData<typeof clientLoader>()

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
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {seasons.map((season) => (
            <RefereeVenueInfluenceChart key={season} title={formatSeason(season, 'long')} data={chartDataPerSeason[season] ?? []} />
          ))}
        </div>
      </div>
    </>
  )
}
