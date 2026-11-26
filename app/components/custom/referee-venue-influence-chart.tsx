import { CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
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

// Bubble palette: 10 evenly spaced hues x 5 evenly stepped lightnesses, generated shade-major so
// assigning colors to alphabetically sorted referees gives the first 10 ten distinct hues, the next
// 10 darker versions of the same hues, and so on. OKLCH with a constant chroma keeps every bubble
// equally colorful and its lightness scale keeps each shade row equally bright, on both themes.
const SHADE_LIGHTNESSES = [82, 72, 62, 52, 42]
const HUE_FAMILY_COUNT = 10
const CHROMA = 0.11

export const SCATTER_COLORS = SHADE_LIGHTNESSES.flatMap((lightness) =>
  Array.from({ length: HUE_FAMILY_COUNT }, (_, index) => `oklch(${lightness}% ${CHROMA} ${index * (360 / HUE_FAMILY_COUNT)})`),
)

// Bubble area in px^2 that recharts maps linearly to the matches count: radius grows from ~4.5px
// for the fewest matches to ~11.3px for the most.
const BUBBLE_AREA_RANGE: readonly [number, number] = [64, 400]
const LABELLED_REFEREE_COUNT = 10

interface ScatterPointLabelProps {
  value?: string
  x?: number
  y?: number
  topNames: ReadonlySet<string>
  highlightedReferee: string | null
}

// Recharts clones this element per dot with the computed x and y of the "top" position; rendering
// null for everyone outside the busiest referees keeps the chart readable. The highlighted referee
// always gets their name, and the other labels fade while someone is highlighted.
function ScatterPointLabel({ value, x, y, topNames, highlightedReferee }: ScatterPointLabelProps) {
  if (value === undefined || x === undefined || y === undefined) {
    return null
  }

  if (!topNames.has(value) && value !== highlightedReferee) {
    return null
  }

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={10}
      fill="var(--foreground)"
      opacity={highlightedReferee !== null && value !== highlightedReferee ? 0.3 : 1}
    >
      {value}
    </text>
  )
}

interface BubbleShapeProps {
  cx?: number
  cy?: number
  size?: number
  payload?: RefereeVenueInfluenceDatum
  colorByName: Record<string, string>
  highlightedReferee: string | null
}

// Recharts clones this element per dot with the computed position and the ZAxis-derived bubble area;
// the radius follows recharts' own convention of treating the size as the circle's area. With a
// highlighted referee, the matching bubble enlarges and every other one fades.
function BubbleShape({ cx, cy, size, payload, colorByName, highlightedReferee }: BubbleShapeProps) {
  if (cx === undefined || cy === undefined || size === undefined) {
    return null
  }

  const isHighlighted = highlightedReferee !== null && payload?.name === highlightedReferee

  return (
    <circle
      cx={cx}
      cy={cy}
      r={Math.sqrt(size / Math.PI) * (isHighlighted ? 1.25 : 1)}
      fill={colorByName[payload?.name ?? ''] ?? DOT_COLOR}
      fillOpacity={highlightedReferee !== null && !isHighlighted ? 0.12 : 0.85}
      stroke="var(--foreground)"
      strokeOpacity={highlightedReferee !== null && !isHighlighted ? 0.3 : 1}
      strokeWidth={1}
    />
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
  /** Referee to pinpoint: their bubble enlarges, keeps full opacity, and always shows their name. */
  highlightedReferee: string | null
}

export function RefereeVenueInfluenceChart({ title, data, plot, colorByName, highlightedReferee }: RefereeVenueInfluenceChartProps) {
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
          <Scatter
            data={data}
            isAnimationActive={false}
            shape={<BubbleShape colorByName={colorByName} highlightedReferee={highlightedReferee} />}
          >
            <LabelList
              dataKey="name"
              position="top"
              offset={14}
              content={<ScatterPointLabel topNames={topNames} highlightedReferee={highlightedReferee} />}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
