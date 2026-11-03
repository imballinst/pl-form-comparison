export interface FbrefScheduleEntry {
  matchweek: number
  datetime: string
  home: string
  away: string
  /** Raw FBref score string, e.g. "2–1" (en dash), or empty/null when not played yet. */
  score: string | null
  attendance: number | null
  venue: string
  referee: string | null
  matchReportUrl: string | null
}

export interface MatchOfficial {
  name: string
  role: string
}

export interface MatchTeamStats {
  yellowCards: number
  redCards: number
  fouls: number
  corners: number
  offsides: number
}

export interface MatchDetail {
  officials: MatchOfficial[]
  home: MatchTeamStats
  away: MatchTeamStats
}

export interface UnderstatDateEntry {
  id: string
  isResult: boolean
  datetime: string
  date?: string
  h: { id: string; title: string; short_title: string }
  a: { id: string; title: string; short_title: string }
  /** Scheduled matches keep the key with null values. */
  goals: { h: string | null; a: string | null } | null
  xG?: { h: string | null; a: string | null }
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
  /** Player season aggregates from Understat; passed through untouched. */
  players?: Array<Record<string, string>>
}

export interface TeamNameMap {
  [key: string]: string
}
