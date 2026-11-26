interface YAxisLabelProps {
  viewBox?: { x: number; y: number; width: number; height: number }
  value: string
  side: 'left' | 'right'
}

// Renders the axis name rotated 90° and centered vertically on the axis. Recharts injects the axis
// viewBox when cloning the label element. The rotation pivots on the (x, y) point and
// textAnchor centers the text over it, so any label length stays centered without measuring it.
export function YAxisLabel({ viewBox, value, side }: YAxisLabelProps) {
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
