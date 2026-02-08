import type { MatchInfo, Team } from '@/types'
import dayjs from 'dayjs'

interface ScoreResultOptions {
  scoreColor?: 'bg' | 'border'
}

const SCORE_COLORS = {
  win: {
    bg: 'bg-green-400',
    border: 'border-2 border-green-400 text-green-600',
  },
  draw: {
    bg: 'bg-gray-400',
    border: 'border-2 border-gray-400 text-gray-600',
  },
  loss: {
    bg: 'bg-red-400',
    border: 'border-2 border-red-400 text-red-600',
  },
} as const

export function getScoreResult(position: string, score: [number, number], options?: ScoreResultOptions) {
  const colorMode = options?.scoreColor || 'bg'

  if (score[0] === score[1]) {
    return { color: SCORE_COLORS.draw[colorMode], teamResult: 'draw' }
  }

  const isHome = position === 'home'
  const isWin = isHome ? score[0] > score[1] : score[1] > score[0]

  if (isWin) {
    return {
      color: SCORE_COLORS.win[colorMode],
      teamResult: 'win',
    }
  }

  return {
    color: SCORE_COLORS.loss[colorMode],
    teamResult: 'loss',
  }
}

export function getEssentialMatchInfo(match: MatchInfo, team: string, opts?: ScoreResultOptions) {
  const isHome = match.homeTeam.name === team
  const score = [match.homeTeam.score, match.awayTeam.score] satisfies [number, number]
  let opponent: Team
  let venue: 'home' | 'away'

  if (isHome) {
    opponent = match.awayTeam
    venue = 'home'
  } else {
    opponent = match.homeTeam
    venue = 'away'
  }

  const scoreColorAndResult = getScoreResult(venue, score, opts)

  return { opponent, venue, ...scoreColorAndResult }
}

export function getAnchorKeyFromMatch(match: MatchInfo, identifier: string) {
  return getAnchorKeyFromString(match.homeTeam.name, match.awayTeam.name, identifier)
}

export function getAnchorKeyFromString(home: string, away: string, identifier: string) {
  return [home, away, identifier].join(' vs ')
}

export function getSeasonShortText(year: string) {
  return `${year.slice(2)}/${(Number(year) + 1).toString().slice(2)}`
}

export function isMatchFinished<T extends { period: string }>(match: T) {
  return match.period === 'FullTime'
}

export function getMatchLocalTime(match: MatchInfo) {
  const kickoffDate = dayjs(match.kickoff, 'YYYY-MM-DD HH:mm:ss').add(new Date().getTimezoneOffset() * -1, 'minute')

  const formattedDate = kickoffDate.format('MMM DD')
  const formattedTime = kickoffDate.format('HH:mm')

  return { date: formattedDate, time: formattedTime }
}
