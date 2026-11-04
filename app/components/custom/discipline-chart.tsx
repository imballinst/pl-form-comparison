import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface DisciplineChartDatum {
  team: string
  /** Compact label shown on the x-axis, e.g. "ARS". */
  abbr: string
  fouls: number
  /** Fouls per card; undefined when the team received no cards of that kind, e.g. zero red cards. */
  foulsPerYellowCard?: number
  foulsPerRedCard?: number
  /** Page-wide sort value, baked in so both charts and the table share one team order. */
  sortValue?: number
}

interface DisciplineChartProps {
  title: string
  /** Left-axis name, e.g. "Fouls conceded" / "Fouls given". */
  foulsName: string
  data: DisciplineChartDatum[]
  isMobile: boolean
}

// The bars are the context series, so they are neutral and nearly hollow; the two ratio series carry
// the yellow/red card colors on top of them.
const BAR_COLOR = 'var(--muted-foreground)'
const YELLOW_COLOR = 'var(--chart-4)'
const RED_COLOR = 'var(--chart-1)'

const AXIS_TICK = { fontSize: 10, fill: 'var(--muted-foreground)' }

interface YAxisLabelProps {
  viewBox?: { x: number; y: number; width: number; height: number }
  value: string
  side: 'left' | 'right'
}

// Renders the axis name rotated 90° and centered vertically on the axis. Recharts injects the axis
// viewBox when cloning the label element. The rotation pivots on the (x, y) point and
// textAnchor centers the text over it, so any label length stays centered without measuring it.
function YAxisLabel({ viewBox, value, side }: YAxisLabelProps) {
  if (!viewBox) {
    return null
  }

  const x = side === 'left' ? viewBox.x + 10 : viewBox.x + viewBox.width - 10
  const y = viewBox.y + viewBox.height / 2
  const angle = side === 'left' ? -90 : 90

  return (
    <text
      x={x}
      y={y}
      fill="var(--muted-foreground)"
      fontSize={10}
      textAnchor="middle"
      dominantBaseline="central"
      transform={`rotate(${angle}, ${x}, ${y})`}
    >
      {value}
    </text>
  )
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ payload: DisciplineChartDatum }>
  foulsName: string
}

function ChartTooltip({ active, payload, foulsName }: ChartTooltipProps) {
  const datum = payload?.[0]?.payload

  if (!active || !datum) {
    return null
  }

  const ratioText = (value: number | undefined) => (value === undefined ? '-' : value.toFixed(2))

  return (
    <div className="rounded-md border bg-popover text-popover-foreground px-2 py-1.5 text-xs shadow-md">
      <div className="font-semibold">{datum.team}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="size-2 rounded-[2px]" style={{ backgroundColor: BAR_COLOR }} />
        {foulsName}: {datum.fouls}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: YELLOW_COLOR }} />
        Fouls per yellow card: {ratioText(datum.foulsPerYellowCard)}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: RED_COLOR }} />
        Fouls per red card: {ratioText(datum.foulsPerRedCard)}
      </div>
    </div>
  )
}

export function DisciplineChart({ title, foulsName, data, isMobile }: DisciplineChartProps) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground sm:p-4">
      <h3 className="text-sm font-semibold">{title}</h3>

      <ResponsiveContainer width="100%" height={isMobile ? 280 : 320} className="mt-2">
        <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
          {/* Abbreviations keep every label visible with 20+ teams; the tooltip shows the full team name. */}
          <XAxis
            dataKey="abbr"
            interval={0}
            height={isMobile ? 44 : 30}
            angle={isMobile ? -90 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            tick={AXIS_TICK}
            tickMargin={4}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            yAxisId="fouls"
            width={46}
            domain={[0, 'auto']}
            allowDecimals={false}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            label={<YAxisLabel value={foulsName} side="left" />}
          />
          <YAxis
            yAxisId="ratio"
            orientation="right"
            width={46}
            domain={[0, 'auto']}
            tick={AXIS_TICK}
            tickFormatter={(value: number) => value.toFixed(1)}
            tickLine={false}
            axisLine={false}
            label={<YAxisLabel value="Fouls per card" side="right" />}
          />
          <Tooltip cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }} content={<ChartTooltip foulsName={foulsName} />} />
          <Bar
            yAxisId="fouls"
            dataKey="fouls"
            name={foulsName}
            fill={BAR_COLOR}
            fillOpacity={0.06}
            stroke={BAR_COLOR}
            strokeWidth={1}
            maxBarSize={24}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="ratio"
            dataKey="foulsPerYellowCard"
            name="Fouls per yellow card"
            stroke={YELLOW_COLOR}
            strokeWidth={0} // dots only; the legend icon draws its own squiggle from the stroke color
            dot={{ r: 3, fill: YELLOW_COLOR, stroke: 'var(--foreground)', strokeWidth: 1 }}
            activeDot={{ r: 5, fill: YELLOW_COLOR, stroke: 'var(--foreground)', strokeWidth: 1 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="ratio"
            dataKey="foulsPerRedCard"
            name="Fouls per red card"
            stroke={RED_COLOR}
            strokeWidth={0} // dots only; the legend icon draws its own squiggle from the stroke color
            dot={{ r: 3, fill: RED_COLOR, stroke: 'var(--foreground)', strokeWidth: 1 }}
            activeDot={{ r: 5, fill: RED_COLOR, stroke: 'var(--foreground)', strokeWidth: 1 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
