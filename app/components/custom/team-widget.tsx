import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '@/constants'
import type { FullMatchInfo } from '@/types'
import { getEssentialMatchInfo, getMatchLocalTime } from '@/utils/match'
import clsx from 'clsx'
import { GripVertical, X } from 'lucide-react'

export interface TeamInfoData {
  past5Matches: FullMatchInfo[]
  nextMatch: FullMatchInfo | null
  leaguePosition: number
}

interface TeamWidgetProps {
  teamName: string
  onRemove: (id: string) => void
  onTeamSelect: (teamName: string) => void
  widgetId: string
  isDragging: boolean
  teamInfo?: TeamInfoData
}

export function TeamWidget({ teamName, onRemove, onTeamSelect, widgetId, isDragging, teamInfo }: TeamWidgetProps) {
  return (
    <div className={clsx('rounded-lg border p-4 flex flex-col gap-4 h-full bg-white', isDragging ? 'opacity-50' : '')} draggable>
      {/* Header with drag and close buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical size={18} className="text-gray-400 shrink-0 cursor-grab active:cursor-grabbing" />

          <Select onValueChange={onTeamSelect} value={teamName}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {TEAMS_PER_SEASON[CURRENT_SEASON].map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {teamInfo ? (
        <>
          <div className="flex gap-x-2 text-sm items-center justify-center">
            <div className="font-semibold">#{teamInfo.leaguePosition}</div>

            <div className="border-r border-slate-300 w-1 h-full">&nbsp;</div>

            <div className="flex gap-1">
              <span className="sr-only">Form</span>

              {teamInfo.past5Matches.map((match, idx) => {
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
          {teamInfo.nextMatch ? (
            <div className="flex gap-2 border-t pt-3 text-sm justify-center">
              <span className="font-semibold text-gray-700">Next</span>
              {(() => {
                const matchInfo = getEssentialMatchInfo(teamInfo.nextMatch, teamName)
                const { date, time } = getMatchLocalTime(teamInfo.nextMatch)

                return (
                  <>
                    <div className="font-semibold">
                      {matchInfo.opponent.shortName} {matchInfo.venue === 'home' ? '(H)' : '(A)'}
                    </div>
                    <div className="text-gray-600">
                      {date}, {time}
                    </div>
                  </>
                )
              })()}
            </div>
          ) : (
            <div className="text-sm text-gray-500 border-t pt-3 mt-auto">No upcoming matches</div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center text-center flex-col flex-1">
          <p className="text-sm text-gray-500 italic">No team selected yet</p>
        </div>
      )}
    </div>
  )
}
