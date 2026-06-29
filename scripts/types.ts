export interface FbrefScheduleEntry {
  matchweek: number
  date: string
  time?: string
  home: string
  away: string
  score: { home: number; away: number } | null
  attendance: number | null
  venue: string
  referee: string | null
  matchReportUrl: string | null
}

export interface MatchOfficial {
  name: string
  role: string
}

export interface MatchCards {
  homeYellow: number
  homeRed: number
  awayYellow: number
  awayRed: number
}

export interface MatchExtraStats {
  fouls: { home: number; away: number }
  corners: { home: number; away: number }
  offsides: { home: number; away: number }
}

export interface MatchDetail {
  officials: MatchOfficial[]
  cards: MatchCards
  extraStats: MatchExtraStats
}

export interface UnderstatDateEntry {
  id: string
  isResult: boolean
  datetime: string
  date?: string
  h: { id: string; title: string; short_title: string }
  a: { id: string; title: string; short_title: string }
  goals: { h: string; a: string } | null
  xG?: { h: string; a: string }
  forecast?: Record<string, string>
}

export interface UnderstatTeamHistory {
  h_a: string
  xG: number
  xGA: number
  npxG: number
  npxGA: number
  ppda: { att: number; def: number }
  ppda_allowed: { att: number; def: number }
  deep: number
  deep_allowed: number
  scored: number
  missed: number
  xpts: number
  result: string
  date: string
  datetime?: string
  wins: number
  draws: number
  loses: number
  pts: number
  npxGD: number
}

export interface UnderstatTeamData {
  id: string
  title: string
  history: UnderstatTeamHistory[]
}

export interface UnderstatRawData {
  dates: UnderstatDateEntry[]
  teams: Record<string, UnderstatTeamData>
}

export interface TeamNameMap {
  [key: string]: string
}
