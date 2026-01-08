import type { FullMatchInfo } from '@/types'
import clsx from 'clsx'
import dayjs from 'dayjs'

interface MatchCardProps {
  match: FullMatchInfo
}

export function MatchCard({ match }: MatchCardProps) {
  const kickoffDate = dayjs(match.kickoff, 'YYYY-MM-DD HH:mm:ss').add(new Date().getTimezoneOffset() * -1, 'minute')

  const formattedDate = kickoffDate.format('MMM DD')
  const formattedTime = kickoffDate.format('HH:mm')

  const homeTeamTextClassName = clsx({
    'text-slate-400': match.homeTeam.score < match.awayTeam.score,
  })
  const awayTeamTextClassName = clsx({
    'text-slate-400': match.homeTeam.score > match.awayTeam.score,
  })

  return (
    <div className={clsx('border rounded-lg p-4 text-center flex font-semibold text-xs', match.color)}>
      <div className="flex-1 flex flex-col justify-center items-start gap-2">
        <div className={homeTeamTextClassName}>{match.homeTeam.shortName}</div>
        <div className={awayTeamTextClassName}>{match.awayTeam.shortName}</div>
      </div>
      {match.period === 'FullTime' ? (
        <div className="flex flex-col justify-center gap-2">
          <div className={homeTeamTextClassName}>{match.homeTeam.score}</div>
          <div className={awayTeamTextClassName}>{match.awayTeam.score}</div>
        </div>
      ) : (
        <div className="flex flex-col justify-center gap-2">
          <div>{formattedDate}</div>
          <div>{formattedTime}</div>
        </div>
      )}
    </div>
  )
}
