import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '@/constants'
import type { FullMatchInfo, SeasonTableData } from '@/types'
import { getEssentialMatchInfo } from '@/utils/match'
import clsx from 'clsx'
import { GripVertical, Plus, X } from 'lucide-react'

interface TeamWidgetProps {
  teamName?: string
  tableData: SeasonTableData[]
  onRemove: (id: string) => void
  onTeamSelect: (teamName: string) => void
  widgetId: string
  isDragging?: boolean
  teamMatches?: { past5: FullMatchInfo[]; nextMatch: FullMatchInfo | null }
}

export function TeamWidget({ teamName, tableData, onRemove, onTeamSelect, widgetId, isDragging, teamMatches }: TeamWidgetProps) {
  if (!teamName) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Plus size={32} className="text-gray-400" />
        <div className="text-center">
          <h3 className="font-semibold text-gray-700 mb-2">Add Widget</h3>
          <p className="text-sm text-gray-500 mb-4">Select a team to track</p>
        </div>
        <Select onValueChange={onTeamSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {TEAMS_PER_SEASON[CURRENT_SEASON].map((team) => (
              <SelectItem key={team} value={team}>
                {team}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  const teamTableData = tableData.find((t) => t.name === teamName)
  const position = teamTableData ? tableData.indexOf(teamTableData) + 1 : '-'

  const past5 = teamMatches?.past5 || []
  const nextMatch = teamMatches?.nextMatch || null

  return (
    <div className={clsx('rounded-lg border p-4 flex flex-col gap-4 min-h-[300px] bg-white', isDragging ? 'opacity-50' : '')} draggable>
      {/* Header with drag and close buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical size={18} className="text-gray-400 shrink-0 cursor-grab active:cursor-grabbing" />
          <h2 className="font-bold text-lg truncate">{teamName}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onRemove(widgetId)
          }}
        >
          <X size={18} />
        </Button>
      </div>

      {/* Position */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Position:</span>
        <span className="font-bold">{position}</span>
      </div>

      {/* Past 5 matches form */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-gray-700">Form (Past 5)</span>
        <div className="flex gap-1">
          {past5.map((match, idx) => {
            const matchInfo = getEssentialMatchInfo(match, teamName)
            const result = matchInfo.teamResult
            const resultColor = result === 'win' ? 'bg-green-500' : result === 'loss' ? 'bg-red-500' : 'bg-gray-400'
            const resultText = result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D'

            return (
              <div key={idx} className={clsx('flex items-center justify-center w-6 h-6 rounded text-xs font-bold', resultColor)}>
                {resultText}
              </div>
            )
          })}
        </div>
      </div>

      {/* Next match */}
      {nextMatch ? (
        <div className="flex flex-col gap-2 border-t pt-3 mt-auto">
          <span className="text-sm font-semibold text-gray-700">Next Match</span>
          <div className="space-y-1 text-sm">
            {(() => {
              const matchInfo = getEssentialMatchInfo(nextMatch, teamName)
              const kickoffDate = new Date(nextMatch.kickoff)
              const formattedDate = kickoffDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
              const formattedTime = kickoffDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

              return (
                <>
                  <div className="font-semibold">vs {matchInfo.opponent.name}</div>
                  <div className="text-gray-600">
                    {formattedDate} {formattedTime}
                  </div>
                  <div className="text-gray-600">{matchInfo.venue === 'home' ? '🏠 Home' : '🚗 Away'}</div>
                </>
              )
            })()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 border-t pt-3 mt-auto">No upcoming matches</div>
      )}
    </div>
  )
}
