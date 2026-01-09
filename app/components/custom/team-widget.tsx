import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENT_SEASON, TEAMS_PER_SEASON } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import type { FullMatchInfo } from '@/types'
import { getEssentialMatchInfo, getMatchLocalTime } from '@/utils/match'
import clsx from 'clsx'
import { GripVertical, X } from 'lucide-react'

export interface TeamInfoData {
  past5Matches: FullMatchInfo[]
  nextMatch: FullMatchInfo | null
  nextOpponentPast5Matches: FullMatchInfo[]
  nextOpponentLeaguePosition: number
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
  const isExtraMobile = useIsMobile('sm')

  return (
    <div className={clsx('rounded-lg border p-4 flex flex-col gap-4 h-full bg-white', isDragging ? 'opacity-50' : '')} draggable>
      {/* Header with drag and close buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical size={18} className="text-gray-400 shrink-0 cursor-grab active:cursor-grabbing" aria-label="Drag widget" />

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
          <X size={18} aria-label="Remove widget" />
        </Button>
      </div>

      {teamInfo ? (
        <>
          <div className="flex gap-x-2 text-sm items-center justify-center">
            <LeaguePosition leaguePosition={teamInfo.leaguePosition} />

            <div>
              <span className="sr-only">Form</span>

              <PastFiveMatches past5Matches={teamInfo.past5Matches} teamName={teamName} />
            </div>
          </div>

          {/* Next match */}
          {teamInfo.nextMatch ? (
            <div className="flex flex-col gap-4 border-t pt-3 text-sm justify-center items-center">
              {(() => {
                const matchInfo = getEssentialMatchInfo(teamInfo.nextMatch, teamName)
                const { date, time } = getMatchLocalTime(teamInfo.nextMatch)

                return (
                  <div className="flex gap-x-2 font-semibold text-gray-700">
                    <div className="flex flex-1 gap-x-2 justify-center">
                      <div className="font-bold">Next</div>
                      <div>
                        {matchInfo.opponent.shortName} {matchInfo.venue === 'home' ? '(H)' : '(A)'}
                      </div>
                    </div>

                    <div className={clsx('font-normal text-gray-600', isExtraMobile && 'flex flex-1 grow basis-full justify-center')}>
                      {date}, {time}
                    </div>
                  </div>
                )
              })()}

              <div className="flex gap-2">
                <LeaguePosition leaguePosition={teamInfo.nextOpponentLeaguePosition} />

                <PastFiveMatches
                  past5Matches={teamInfo.nextOpponentPast5Matches}
                  teamName={
                    teamInfo.nextMatch.awayTeam.name === teamName ? teamInfo.nextMatch.homeTeam.name : teamInfo.nextMatch.awayTeam.name
                  }
                />
              </div>
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

function PastFiveMatches({ past5Matches, teamName }: { past5Matches: FullMatchInfo[]; teamName: string }) {
  return (
    <ol className="flex gap-1">
      {past5Matches.map((match, idx) => {
        const matchInfo = getEssentialMatchInfo(match, teamName)
        const result = matchInfo.teamResult
        const resultColor = result === 'win' ? 'bg-green-500' : result === 'loss' ? 'bg-red-500' : 'bg-gray-400'
        const resultText = result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D'

        return (
          <li key={idx} className={clsx('flex items-center justify-center w-6 h-6 rounded text-xs font-bold', resultColor)}>
            {resultText}
          </li>
        )
      })}
    </ol>
  )
}

function LeaguePosition({ leaguePosition }: { leaguePosition: number }) {
  const padded = `${leaguePosition}`.padStart(2, '0')

  return <div className="font-semibold font-mono">#{padded}</div>
}
