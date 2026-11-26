import {
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { YAxisLabel } from './y-axis-label'

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

// 50 bubble colors: 10 hue families x 5 shades, ordered shade-major so that assigning them to
// alphabetically sorted referees gives the first 10 ten distinct hues, the next 10 darker versions
// of the same hues, and so on. Mid-tones keep every bubble readable on both theme backgrounds.
export const SCATTER_COLORS = [
  '#f0988a',
  '#f5b06e',
  '#e5c355',
  '#a8d05c',
  '#64cc8a',
  '#54c4bb',
  '#79c1e8',
  '#859bea',
  '#a98ede',
  '#de82c0',
  '#e0705c',
  '#ec9142',
  '#d5ab2b',
  '#8dbc39',
  '#44b370',
  '#2eaba3',
  '#4fa8dc',
  '#5f76e0',
  '#8c68d0',
  '#cd5aa7',
  '#c94b36',
  '#dd7a26',
  '#bd9414',
  '#71a022',
  '#2d9a58',
  '#1d8f88',
  '#2f8bc2',
  '#4158c7',
  '#7149bc',
  '#b23d8a',
  '#a53220',
  '#b95f16',
  '#9e7a0c',
  '#598218',
  '#217c44',
  '#12706a',
  '#1f6ea0',
  '#2d3fa2',
  '#57359c',
  '#8f2b6d',
  '#7e2415',
  '#93490f',
  '#7f6107',
  '#44650f',
  '#166033',
  '#0b574f',
  '#14537c',
  '#202e7f',
  '#402479',
  '#6e1e54',
]

// Bubble area in px^2 that recharts maps linearly to the matches count: radius grows from ~4.5px
// for the fewest matches to ~11.3px for the most.
const BUBBLE_AREA_RANGE: readonly [number, number] = [64, 400]
const LABELLED_REFEREE_COUNT = 10

interface ScatterPointLabelProps {
  value?: string
  x?: number
  y?: number
  topNames: ReadonlySet<string>
}

// Recharts clones this element per dot with the computed x and y of the "top" position; rendering
// null for everyone outside the busiest referees keeps the chart readable.
function ScatterPointLabel({ value, x, y, topNames }: ScatterPointLabelProps) {
  if (value === undefined || x === undefined || y === undefined || !topNames.has(value)) {
    return null
  }

  return (
    <text x={x} y={y} textAnchor="middle" fontSize={10} fill="var(--foreground)">
      {value}
    </text>
  )
}

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
  /** Shared by every chart on the page so one referee keeps the same color in all of them. */
  colorByName: Record<string, string>
}

export function RefereeVenueInfluenceChart({ title, data, plot, colorByName }: RefereeVenueInfluenceChartProps) {
  const { datumKey, homeAxisLabel, awayAxisLabel } = PLOTS.find(({ value }) => value === plot)!
  // Both axes share the same domain so the dashed diagonal is the exact "home = away" line; dots
  // above it mean the away teams commit more of the plotted metric under that referee, below it
  // the home teams do.
  const axisMax = Math.max(...data.flatMap((datum) => [datum.home[datumKey] ?? 0, datum.away[datumKey] ?? 0]), 0)
  const paddedAxisMax = Math.ceil(axisMax) + 1
  const topNames = new Set(
    [...data]
      .sort((a, b) => b.matches - a.matches)
      .slice(0, LABELLED_REFEREE_COUNT)
      .map(({ name }) => name),
  )

  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground sm:p-4">
      <h3 className="text-sm font-semibold">{title}</h3>

      <ResponsiveContainer width="100%" height={420} className="mt-2">
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
            label={<YAxisLabel value={awayAxisLabel} side="left" />}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: paddedAxisMax, y: paddedAxisMax },
            ]}
            stroke="var(--muted-foreground)"
            strokeDasharray="6 4"
          />
          <ZAxis type="number" dataKey="matches" range={BUBBLE_AREA_RANGE} />
          <Tooltip cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }} content={<ChartTooltip />} />
          <Scatter data={data} fill={DOT_COLOR} fillOpacity={0.85} stroke="var(--foreground)" strokeWidth={1} isAnimationActive={false}>
            {data.map((datum) => (
              <Cell key={datum.name} fill={colorByName[datum.name] ?? DOT_COLOR} />
            ))}
            <LabelList dataKey="name" position="top" offset={14} content={<ScatterPointLabel topNames={topNames} />} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
