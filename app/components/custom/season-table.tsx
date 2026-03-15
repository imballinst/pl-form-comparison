import { useIsMobile } from '@/hooks/use-mobile'
import type { SeasonTableData } from '@/types'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

interface Props {
  data: SeasonTableData[]
  initialShownRows?: number
}

export function SeasonTable({ data, initialShownRows = 5 }: Props) {
  const isMobile = useIsMobile()
  const [isShowAll, setIsShowAll] = useState(false)
  let rows = data

  if (!isShowAll) {
    rows = data.slice(0, initialShownRows)
  }

  return (
    <Table className="tabular-nums">
      <TableHeader>
        <TableRow className="[&>th]:bg-white">
          <TableHead className="sticky left-0 min-w-8 w-8">#</TableHead>
          <TableHead className="sticky left-8">Club</TableHead>
          <TableHead className="text-right">P</TableHead>
          <TableHead className="text-right">W</TableHead>
          <TableHead className="text-right">D</TableHead>
          <TableHead className="text-right">L</TableHead>
          <TableHead className="text-right">GF</TableHead>
          <TableHead className="text-right">GA</TableHead>
          <TableHead className="text-right">GD</TableHead>
          <TableHead className="text-right">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((team, index) => (
          <TableRow key={team.name} className="[&>td]:bg-white">
            <TableCell className="sticky left-0 min-w-8 w-8">{index + 1}</TableCell>
            <TableCell className="sticky left-8">{isMobile ? team.abbr : team.name}</TableCell>
            <TableCell className="text-right">{team.played}</TableCell>
            <TableCell className="text-right">{team.wins}</TableCell>
            <TableCell className="text-right">{team.draws}</TableCell>
            <TableCell className="text-right">{team.losses}</TableCell>
            <TableCell className="text-right">{team.gf}</TableCell>
            <TableCell className="text-right">{team.ga}</TableCell>
            <TableCell className="text-right">{team.gd}</TableCell>
            <TableCell className="font-bold text-right">{team.points}</TableCell>
          </TableRow>
        ))}
        {data.length > initialShownRows && !isShowAll && (
          <TableRow>
            <TableCell colSpan={10} className="p-0">
              <Button
                variant="ghost"
                className="w-full font-semibold"
                onClick={() => setIsShowAll((prev) => !prev)}
                id="show-all-clubs-button"
              >
                Show all
              </Button>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
