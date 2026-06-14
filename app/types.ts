// Custom types.
export interface FullMatchInfo extends MatchInfo {
  color: string
  opponent: Team
  teamResult: string
  venue: string
}

// Types from JSON struct.
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
  awayTeam: Team
  competition: string
  clock: string
  kickoffTimezoneString: string
  homeTeam: Team
  season: string
  ground: string
  resultType: string
  matchId: string
  attendance?: number
}

export interface Team {
  score: number
  name: string
  id: string
  halfTimeScore: number
  shortName: string
  abbr: string
  redCards: number
}

export interface SeasonTableData {
  name: string
  abbr: string
  played: number
  points: number
  wins: number
  losses: number
  draws: number
  gf: number
  ga: number
  gd: number
}

export interface MatchOfficialTeamAssignmentData {
  Home: {
    Referee: number
    'Assistant Referee': number
    'Fourth official': number
    'Video Assistant Referee': number
    'Assistant VAR Official': number
  }
  Away: {
    Referee: number
    'Assistant Referee': number
    'Fourth official': number
    'Video Assistant Referee': number
    'Assistant VAR Official': number
  }
}

export interface MatchFullStatData {
  expectedGoals: number
  wonCorners: number
  duelWon: number
  totalDistance: number
  fkFoulLost: number
  totalOffside: number
  penaltyConceded: number
  yellowCard: number
  redCard: number
}

export interface MatchOfficialTeamAssignmentDataTableData {
  name: string
  referees: Record<string, MatchOfficialTeamAssignmentData>
}

export interface RawTeamStatRecapData {
  // Team name is the index.
  processed: number[]
  teams: Record<
    string,
    {
      officials: Record<string, MatchOfficialTeamAssignmentData>
      games: MatchFullStatData[]
    }
  >
}
