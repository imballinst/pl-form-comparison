import type { FullMatchInfo } from '@/types'
import { getMatchLocalTime, isMatchFinished } from '@/utils/match'
import clsx from 'clsx'

interface MatchCardProps {
  match: FullMatchInfo
}

export function MatchCard({ match }: MatchCardProps) {
  const { date, time } = getMatchLocalTime(match)

  const homeTeamTextClassName = clsx({
    'text-slate-400': match.homeTeam.score < match.awayTeam.score,
  })
  const awayTeamTextClassName = clsx({
    'text-slate-400': match.homeTeam.score > match.awayTeam.score,
  })

  return (
    <div className={clsx('border rounded-lg p-4 text-center flex font-semibold text-sm', match.color)}>
      <div className="flex-1 flex flex-col justify-center items-start gap-2">
        <div className={homeTeamTextClassName}>{match.homeTeam.shortName}</div>
        <div className={awayTeamTextClassName}>{match.awayTeam.shortName}</div>
      </div>
      {isMatchFinished(match) ? (
        <div className="flex flex-col justify-center gap-2">
          <div className={homeTeamTextClassName}>{match.homeTeam.score}</div>
          <div className={awayTeamTextClassName}>{match.awayTeam.score}</div>
        </div>
      ) : (
        <div className="flex flex-col justify-center gap-2">
          <div>{date}</div>
          <div>{time}</div>
        </div>
      )}
    </div>
  )
}
