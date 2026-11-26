import { CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'

export interface RefereeVenueInfluenceDatum {
  name: string
  /** Average fouls committed by the home teams per match officiated. */
  homeFoulsPerGame: number
  /** Average fouls committed by the away teams per match officiated. */
  awayFoulsPerGame: number
  yellowCards: number
  /** undefined when the referee showed no yellow cards in the selected season. */
  foulsPerYellowCard?: number
  redCards: number
  /** undefined when the referee showed no red cards in the selected season. */
  foulsPerRedCard?: number
  matches: number
}

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
      <div className="mt-1">Fouls by home teams: {datum.homeFoulsPerGame.toFixed(2)} per game</div>
      <div>Fouls by away teams: {datum.awayFoulsPerGame.toFixed(2)} per game</div>
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
}

export function RefereeVenueInfluenceChart({ title, data }: RefereeVenueInfluenceChartProps) {
  // Both axes share the same domain so the dashed diagonal is the exact "home fouls = away fouls"
  // line; dots above it mean away teams foul more under that referee, below it the home teams do.
  const axisMax = Math.max(...data.flatMap((datum) => [datum.homeFoulsPerGame, datum.awayFoulsPerGame]), 0)
  const paddedAxisMax = Math.ceil(axisMax) + 1

  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground sm:p-4">
      <h3 className="text-sm font-semibold">{title}</h3>

      <ResponsiveContainer width="100%" height={340} className="mt-2">
        <ScatterChart margin={{ top: 20, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis
            type="number"
            dataKey="homeFoulsPerGame"
            domain={[0, paddedAxisMax]}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            label={{
              value: 'Fouls by home teams (per game)',
              position: 'insideBottom',
              offset: -4,
              fontSize: 10,
              fill: 'var(--muted-foreground)',
            }}
          />
          <YAxis
            type="number"
            dataKey="awayFoulsPerGame"
            width={40}
            domain={[0, paddedAxisMax]}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Fouls by away teams (per game)',
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
