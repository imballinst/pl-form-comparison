import { MatchInfo } from '@/types'

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
  let opponent: string
  let venue: 'home' | 'away'

  if (isHome) {
    opponent = match.awayTeam.name
    venue = 'home'
  } else {
    opponent = match.homeTeam.name
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
