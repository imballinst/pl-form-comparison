import type { MatchInfo, Team } from '@/types'
import dayjs from 'dayjs'

export function getScoreResult(position: string, score: [number, number]) {
  if (score[0] === score[1]) {
    return { color: 'bg-gray-400', teamResult: 'draw' }
  }

  const isHome = position === 'home'
  const isWin = isHome ? score[0] > score[1] : score[1] > score[0]

  if (isWin) {
    return {
      color: 'bg-green-400',
      teamResult: 'win',
    }
  }

  return {
    color: 'bg-red-400',
    teamResult: 'loss',
  }
}

export function getEssentialMatchInfo(match: MatchInfo, team: string) {
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

  const scoreColorAndResult = getScoreResult(venue, score)

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
