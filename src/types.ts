export interface SeasonMatchesResponse {
  season: number
  competition: number
  matchweeks: Matchweek[]
}

export interface Matchweek {
  matchweek: number
  data: Data
}

export interface Data {
  pagination: Pagination
  data: MatchInfo[]
}

export interface Pagination {
  _limit: number
  _prev: any
  _next: any
}

export interface MatchInfo {
  kickoffTimezone: string
  competitionId: string
  period: string
  matchWeek: number
  kickoff: string
  awayTeam: AwayTeam
  competition: string
  clock: string
  kickoffTimezoneString: string
  homeTeam: HomeTeam
  season: string
  ground: string
  resultType: string
  matchId: string
  attendance?: number
}

export interface AwayTeam {
  score: number
  name: string
  id: string
  halfTimeScore: number
  shortName: string
  abbr: string
  redCards: number
}

export interface HomeTeam {
  score: number
  name: string
  id: string
  halfTimeScore: number
  shortName: string
  abbr: string
  redCards: number
}
