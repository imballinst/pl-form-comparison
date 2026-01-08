import type { FullMatchInfo } from '@/types'
import { getSeasonShortText } from '@/utils/match'
import clsx from 'clsx'

interface MatchCardProps {
  match: FullMatchInfo
}

export function MatchCard({ match }: MatchCardProps) {
  const kickoffDate = new Date(match.kickoff)
  const formattedDate = kickoffDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  const formattedTime = kickoffDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const seasonText = getSeasonShortText(match.season)

  return (
    <div className={clsx('rounded-lg p-4 text-white text-center flex flex-col justify-between min-h-[200px]', match.color)}>
      <div className="text-xs font-semibold text-gray-700 mb-2">{seasonText}</div>

      <div className="flex-1 flex flex-col justify-center gap-2">
        <div className="text-lg font-bold">{match.homeTeam.name}</div>
        <div className="text-2xl font-bold">
          {match.homeTeam.score} - {match.awayTeam.score}
        </div>
        <div className="text-lg font-bold">{match.awayTeam.name}</div>
      </div>

      <div className="text-xs mt-2 space-y-1">
        <div>Gameweek {match.matchWeek}</div>
        <div>
          {formattedDate} {formattedTime}
        </div>
        {match.ground && <div>{match.ground}</div>}
      </div>
    </div>
  )
}
