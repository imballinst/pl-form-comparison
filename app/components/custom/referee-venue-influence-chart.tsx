import { CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'

export interface RefereeVenueStats {
  foulsPerGame: number
  yellowCardsPerGame: number
  redCardsPerGame: number
  /** undefined when the teams on this side received no yellow cards. */
  foulsPerYellowCard?: number
  /** undefined when the teams on this side received no red cards. */
  foulsPerRedCard?: number
}

export interface RefereeVenueInfluenceDatum {
  name: string
  /** Matches officiated as the on-field referee. */
  matches: number
  home: RefereeVenueStats
  away: RefereeVenueStats
  // Combined card totals across both sides, shown in the tooltip regardless of the selected plot.
  yellowCards: number
  foulsPerYellowCard?: number
  redCards: number
  foulsPerRedCard?: number
}

// One entry per selectable Plot metric: the datum key carrying the per-side value, plus the axis
// labels. Count metrics are per game so dots stay comparable across referees with different
// workloads; the fouls-per-card ratios are scale-free already.
export const PLOTS = [
  {
    value: 'fouls',
    label: 'Number of fouls',
    datumKey: 'foulsPerGame',
    homeAxisLabel: 'Fouls by home teams (per game)',
    awayAxisLabel: 'Fouls by away teams (per game)',
  },
  {
    value: 'yellow',
    label: 'Number of yellow cards',
    datumKey: 'yellowCardsPerGame',
    homeAxisLabel: 'Yellow cards by home teams (per game)',
    awayAxisLabel: 'Yellow cards by away teams (per game)',
  },
  {
    value: 'red',
    label: 'Number of red cards',
    datumKey: 'redCardsPerGame',
    homeAxisLabel: 'Red cards by home teams (per game)',
    awayAxisLabel: 'Red cards by away teams (per game)',
  },
  {
    value: 'fouls-per-yellow',
    label: 'Fouls per yellow card',
    datumKey: 'foulsPerYellowCard',
    homeAxisLabel: 'Fouls per yellow card, home teams',
    awayAxisLabel: 'Fouls per yellow card, away teams',
  },
  {
    value: 'fouls-per-red',
    label: 'Fouls per red card',
    datumKey: 'foulsPerRedCard',
    homeAxisLabel: 'Fouls per red card, home teams',
    awayAxisLabel: 'Fouls per red card, away teams',
  },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  datumKey: keyof RefereeVenueStats
  homeAxisLabel: string
  awayAxisLabel: string
}>

export type Plot = (typeof PLOTS)[number]['value']

const AXIS_TICK = { fontSize: 10, fill: 'var(--muted-foreground)' }
const DOT_COLOR = 'var(--chart-2)'

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ payload: RefereeVenueInfluenceDatum }>
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  const datum = payload?.[0]?.payload

  if (!active || !datum) {
    return null
  }

  const ratio = (value: number | undefined) => (value === undefined ? '-' : value.toFixed(2))

  return (
    <div className="rounded-md border bg-popover text-popover-foreground px-2 py-1.5 text-xs shadow-md">
      <div className="font-semibold">{datum.name}</div>
      <div className="mt-1">Fouls by home teams: {datum.home.foulsPerGame.toFixed(2)} per game</div>
      <div>Fouls by away teams: {datum.away.foulsPerGame.toFixed(2)} per game</div>
      <div>
        Yellow cards: {datum.yellowCards} ({ratio(datum.foulsPerYellowCard)} fouls per yellow)
      </div>
      <div>
        Red cards: {datum.redCards} ({ratio(datum.foulsPerRedCard)} fouls per red)
      </div>
      <div className="text-muted-foreground">{datum.matches} matches</div>
    </div>
  )
}

interface RefereeVenueInfluenceChartProps {
  title: string
  data: RefereeVenueInfluenceDatum[]
  plot: Plot
}

export function RefereeVenueInfluenceChart({ title, data, plot }: RefereeVenueInfluenceChartProps) {
  const { datumKey, homeAxisLabel, awayAxisLabel } = PLOTS.find(({ value }) => value === plot)!
  // Both axes share the same domain so the dashed diagonal is the exact "home = away" line; dots
  // above it mean the away teams commit more of the plotted metric under that referee, below it
  // the home teams do.
  const axisMax = Math.max(...data.flatMap((datum) => [datum.home[datumKey] ?? 0, datum.away[datumKey] ?? 0]), 0)
  const paddedAxisMax = Math.ceil(axisMax) + 1

  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground sm:p-4">
      <h3 className="text-sm font-semibold">{title}</h3>

      <ResponsiveContainer width="100%" height={340} className="mt-2">
        <ScatterChart margin={{ top: 20, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis
            type="number"
            dataKey={`home.${datumKey}`}
            domain={[0, paddedAxisMax]}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            label={{
              value: homeAxisLabel,
              position: 'insideBottom',
              offset: -4,
              fontSize: 10,
              fill: 'var(--muted-foreground)',
            }}
          />
          <YAxis
            type="number"
            dataKey={`away.${datumKey}`}
            width={40}
            domain={[0, paddedAxisMax]}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            label={{
              value: awayAxisLabel,
              angle: -90,
              position: 'insideLeft',
              fontSize: 10,
              fill: 'var(--muted-foreground)',
            }}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: paddedAxisMax, y: paddedAxisMax },
            ]}
            stroke="var(--muted-foreground)"
            strokeDasharray="6 4"
          />
          <Tooltip cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }} content={<ChartTooltip />} />
          <Scatter data={data} fill={DOT_COLOR} fillOpacity={0.85} stroke="var(--foreground)" strokeWidth={1} isAnimationActive={false}>
            <LabelList dataKey="name" position="top" offset={8} fontSize={10} fill="var(--foreground)" />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
