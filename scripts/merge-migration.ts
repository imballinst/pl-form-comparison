import fs from 'fs/promises'
import path from 'path'
import type { MatchFullStatData, SeasonFile, SeasonMatch, SeasonMatchStats } from '../app/types'
import type { FbrefScheduleEntry, MatchDetail, UnderstatRawData, UnderstatTeamHistory } from './types'
import { YEAR } from './utils'

const UNDERSTAT_TO_APP: Record<string, string> = {
  Tottenham: 'Tottenham Hotspur',
  'West Ham': 'West Ham United',
  Brighton: 'Brighton and Hove Albion',
  Leeds: 'Leeds United',
}

const FBREF_TO_APP: Record<string, string> = {
  'Manchester Utd': 'Manchester United',
  Newcastle: 'Newcastle United',
  Nottingham: 'Nottingham Forest',
  "Nott'ham Forest": 'Nottingham Forest',
  Wolves: 'Wolverhampton Wanderers',
  Tottenham: 'Tottenham Hotspur',
  'West Ham': 'West Ham United',
  Brighton: 'Brighton and Hove Albion',
  Leeds: 'Leeds United',
  'Sheffield Utd': 'Sheffield United',
  'Brighton & Hove Albion': 'Brighton and Hove Albion',
}

interface OfficialAssignment {
  Home: {
    Referee: string[]
    'Assistant Referee': string[]
    'Video Assistant Referee': string[]
    'Assistant VAR Official': string[]
  }
  Away: {
    Referee: string[]
    'Assistant Referee': string[]
    'Video Assistant Referee': string[]
    'Assistant VAR Official': string[]
  }
}

function normalizeUnderstatName(name: string): string {
  return UNDERSTAT_TO_APP[name] || name
}

function normalizeFbrefName(name: string): string {
  return FBREF_TO_APP[name] || name
}

function getMatchDateKey(datetime: string): string {
  return datetime.split(' ')[0]
}

function createEmptyOfficialAssignment(): OfficialAssignment {
  return {
    Home: { Referee: [], 'Assistant Referee': [], 'Video Assistant Referee': [], 'Assistant VAR Official': [] },
    Away: { Referee: [], 'Assistant Referee': [], 'Video Assistant Referee': [], 'Assistant VAR Official': [] },
  }
}

const OFFICIAL_ROLE_MAP: Record<string, keyof OfficialAssignment['Home']> = {
  Referee: 'Referee',
  AR1: 'Assistant Referee',
  AR2: 'Assistant Referee',
  VAR: 'Video Assistant Referee',
  'Assistant VAR': 'Assistant VAR Official',
}

function findTeamHistory(
  teams: Record<string, { id: string; title: string; history: UnderstatTeamHistory[] }>,
  teamId: string,
  datetime: string,
  side: string,
): UnderstatTeamHistory | null {
  const team = teams[teamId]
  if (!team || !team.history) return null
  const mDate = getMatchDateKey(datetime)
  const found = team.history.find((h) => {
    const hDate = getMatchDateKey(h.date || h.datetime || '')
    return hDate === mDate && h.h_a === side
  })
  return found || null
}

async function main() {
  console.log(`\n=== Merging ${YEAR} season ===`)

  const understatRaw: UnderstatRawData = JSON.parse(await fs.readFile(`scripts/references/${YEAR}-understat-raw.json`, 'utf-8'))
  const fbrefSchedule: FbrefScheduleEntry[] = JSON.parse(await fs.readFile(`scripts/references/${YEAR}-fbref-schedule.json`, 'utf-8'))

  let fbrefMatchDetails: Record<string, MatchDetail> = {}
  try {
    fbrefMatchDetails = JSON.parse(await fs.readFile(`scripts/references/${YEAR}-fbref-match-details.json`, 'utf-8'))
  } catch {
    console.log('  No FBref match details found, proceeding without them')
  }

  const understatDates = understatRaw.dates || []
  const understatTeams = understatRaw.teams || {}

  const scheduleByDateAndTeams: Record<string, FbrefScheduleEntry> = {}
  for (const match of fbrefSchedule) {
    const homeNorm = normalizeFbrefName(match.home)
    const awayNorm = normalizeFbrefName(match.away)
    const key = `${match.datetime.split('T')[0]}_${homeNorm}_${awayNorm}`
    scheduleByDateAndTeams[key] = match
  }

  const matchesByMatchweek: Record<string, SeasonMatch[]> = {}
  const matchStatRecord: Record<string, Record<string, MatchFullStatData>> = {}
  const teamOfficialsRecord: Record<string, Record<string, OfficialAssignment>> = {}

  function ensureTeamOfficials(teamName: string, officialName: string, side: 'Home' | 'Away', matchId: string, role: string) {
    if (!teamOfficialsRecord[teamName]) {
      teamOfficialsRecord[teamName] = {}
    }
    if (!teamOfficialsRecord[teamName][officialName]) {
      teamOfficialsRecord[teamName][officialName] = createEmptyOfficialAssignment()
    }
    const mappedRole = OFFICIAL_ROLE_MAP[role] || (role as keyof OfficialAssignment['Home'])
    if (!teamOfficialsRecord[teamName][officialName][side][mappedRole].includes(matchId)) {
      teamOfficialsRecord[teamName][officialName][side][mappedRole].push(matchId)
    }
  }

  for (const dateEntry of understatDates) {
    const matchId = dateEntry.id
    const datetime = dateEntry.datetime || dateEntry.date || ''
    const dateKey = getMatchDateKey(datetime)
    const isResult = dateEntry.isResult

    const homeUnderstatName = dateEntry.h.title
    const awayUnderstatName = dateEntry.a.title

    const homeName = normalizeUnderstatName(homeUnderstatName)
    const awayName = normalizeUnderstatName(awayUnderstatName)

    const homeAbbr = dateEntry.h.short_title
    const awayAbbr = dateEntry.a.short_title

    const homeScoreRaw = dateEntry.goals ? dateEntry.goals.h : null
    const awayScoreRaw = dateEntry.goals ? dateEntry.goals.a : null
    const homeScore = homeScoreRaw !== null ? parseInt(homeScoreRaw, 10) : null
    const awayScore = awayScoreRaw !== null ? parseInt(awayScoreRaw, 10) : null

    const scheduleKey = `${dateKey}_${homeName}_${awayName}`
    const scheduleMatch = scheduleByDateAndTeams[scheduleKey] || null

    const matchweek = scheduleMatch ? scheduleMatch.matchweek : null

    let attendance: number | null = null
    let venue: string | null = null
    let referee: string | null = null
    if (scheduleMatch) {
      attendance = scheduleMatch.attendance
      venue = scheduleMatch.venue
      referee = scheduleMatch.referee
    }

    const homeTeam: SeasonMatch['homeTeam'] = {
      score: homeScore,
      name: homeName,
      id: dateEntry.h.id,
      shortName: homeName,
      abbr: homeAbbr,
      redCards: 0,
    }

    const awayTeam: SeasonMatch['awayTeam'] = {
      score: awayScore,
      name: awayName,
      id: dateEntry.a.id,
      shortName: awayName,
      abbr: awayAbbr,
      redCards: 0,
    }

    const matchDetailKey = `${dateKey}_${homeName}_${awayName}`
    const detail = fbrefMatchDetails[matchDetailKey]

    if (detail) {
      for (const official of detail.officials) {
        ensureTeamOfficials(homeName, official.name, 'Home', matchId, official.role)
        ensureTeamOfficials(awayName, official.name, 'Away', matchId, official.role)
      }

      if (detail.cards) {
        homeTeam.redCards = detail.cards.homeRed || 0
        awayTeam.redCards = detail.cards.awayRed || 0
      }
    }

    if (referee) {
      ensureTeamOfficials(homeName, referee, 'Home', matchId, 'Referee')
      ensureTeamOfficials(awayName, referee, 'Away', matchId, 'Referee')
    }

    const homeHistory = findTeamHistory(understatTeams, dateEntry.h.id, datetime, 'h')
    const awayHistory = findTeamHistory(understatTeams, dateEntry.a.id, datetime, 'a')

    let stats: SeasonMatchStats | null = null

    if (isResult) {
      const homeXg = homeHistory ? homeHistory.xG : 0
      const awayXg = awayHistory ? awayHistory.xG : 0

      stats = {
        referee,
        fbref: detail
          ? {
              cards: {
                homeYellow: detail.cards?.homeYellow || 0,
                homeRed: detail.cards?.homeRed || 0,
                awayYellow: detail.cards?.awayYellow || 0,
                awayRed: detail.cards?.awayRed || 0,
              },
              extraStats: {
                fouls: {
                  home: detail.extraStats?.fouls?.home || 0,
                  away: detail.extraStats?.fouls?.away || 0,
                },
                corners: {
                  home: detail.extraStats?.corners?.home || 0,
                  away: detail.extraStats?.corners?.away || 0,
                },
                offsides: {
                  home: detail.extraStats?.offsides?.home || 0,
                  away: detail.extraStats?.offsides?.away || 0,
                },
              },
            }
          : null,
        understat: { homeXg, awayXg },
      }

      const homeStats: MatchFullStatData = {
        goals: homeScore || 0,
        goalsConceded: awayScore || 0,
        expectedGoals: homeXg,
        wonCorners: stats.fbref?.extraStats.corners.home || 0,
        duelWon: 0,
        totalDistance: 0,
        fkFoulLost: stats.fbref?.extraStats.fouls.home || 0,
        totalOffside: stats.fbref?.extraStats.offsides.home || 0,
        penaltyConceded: 0,
        totalYelCard: stats.fbref?.cards.homeYellow || 0,
        totalRedCard: stats.fbref?.cards.homeRed || 0,
      }

      const awayStats: MatchFullStatData = {
        goals: awayScore || 0,
        goalsConceded: homeScore || 0,
        expectedGoals: awayXg,
        wonCorners: stats.fbref?.extraStats.corners.away || 0,
        duelWon: 0,
        totalDistance: 0,
        fkFoulLost: stats.fbref?.extraStats.fouls.away || 0,
        totalOffside: stats.fbref?.extraStats.offsides.away || 0,
        penaltyConceded: 0,
        totalYelCard: stats.fbref?.cards.awayYellow || 0,
        totalRedCard: stats.fbref?.cards.awayRed || 0,
      }

      matchStatRecord[matchId] = {
        [homeName]: homeStats,
        [awayName]: awayStats,
      }
    }

    const matchEntry: SeasonMatch = {
      matchId,
      matchweek: matchweek ?? 0,
      kickoff: datetime,
      period: isResult ? 'FullTime' : 'Scheduled',
      homeTeam,
      awayTeam,
      ground: venue,
      attendance,
      stats,
    }

    const mwKey = String(matchweek !== null && matchweek !== undefined ? matchweek : 0)
    if (!matchesByMatchweek[mwKey]) {
      matchesByMatchweek[mwKey] = []
    }
    matchesByMatchweek[mwKey].push(matchEntry)
  }

  // Sort matches within each matchweek by kickoff time.
  for (const mwKey in matchesByMatchweek) {
    matchesByMatchweek[mwKey].sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  }

  const outputDir = 'public/pl-form-comparison'
  const matchesOutput: SeasonFile = {
    season: YEAR,
    matches: matchesByMatchweek,
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(path.join(outputDir, `${YEAR}.json`), JSON.stringify(matchesOutput, null, 2))
  console.log(`  Saved ${YEAR}.json with ${Object.keys(matchesByMatchweek).length} matchweeks`)

  const statsOutput = {
    teams: teamOfficialsRecord,
    matchStatRecord,
  }
  await fs.writeFile(path.join(outputDir, `${YEAR}-stats.json`), JSON.stringify(statsOutput, null, 2))
  console.log(`  Saved ${YEAR}-stats.json`)
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
