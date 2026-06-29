import fs from 'fs/promises'
import path from 'path'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import type { MatchFullStatData } from '../app/types'
import type { FbrefScheduleEntry, MatchDetail, UnderstatRawData, UnderstatTeamHistory } from './types'

dayjs.extend(utc)
dayjs.extend(timezone)

const YEARS = [2023, 2024, 2025]

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

function isBST(dateStr: string): boolean {
  const d = dayjs(dateStr)
  const month = d.month()
  return month >= 2 && month <= 9
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
  '4th': 'Assistant Referee',
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
  for (const year of YEARS) {
    console.log(`\n=== Merging ${year} season ===`)

    const understatRaw: UnderstatRawData = JSON.parse(
      await fs.readFile(`scripts/references/${year}-understat-raw.json`, 'utf-8'),
    )
    const fbrefSchedule: FbrefScheduleEntry[] = JSON.parse(
      await fs.readFile(`scripts/references/${year}-fbref-schedule.json`, 'utf-8'),
    )

    let fbrefMatchDetails: Record<string, MatchDetail> = {}
    try {
      fbrefMatchDetails = JSON.parse(
        await fs.readFile(`scripts/references/${year}-fbref-match-details.json`, 'utf-8'),
      )
    } catch {
      console.log('  No FBref match details found, proceeding without them')
    }

    const understatDates = understatRaw.dates || []
    const understatTeams = understatRaw.teams || {}

    const scheduleByDateAndTeams: Record<string, FbrefScheduleEntry> = {}
    for (const match of fbrefSchedule) {
      const homeNorm = normalizeFbrefName(match.home)
      const awayNorm = normalizeFbrefName(match.away)
      const key = `${match.date}_${homeNorm}_${awayNorm}`
      scheduleByDateAndTeams[key] = match
    }

    interface MatchData {
      kickoffTimezone: string
      competitionId: string
      period: string
      matchWeek: number | null
      kickoff: string
      awayTeam: {
        score: number | null
        name: string
        id: string
        halfTimeScore: number | null
        shortName: string
        abbr: string
        redCards: number
      }
      competition: string
      clock: null
      kickoffTimezoneString: string
      homeTeam: {
        score: number | null
        name: string
        id: string
        halfTimeScore: number | null
        shortName: string
        abbr: string
        redCards: number
      }
      season: string
      ground: string | null
      resultType: string | null
      matchId: string
      attendance: number | null
    }

    const matchesByMatchweek: Record<number, MatchData[]> = {}
    const matchStatRecord: Record<string, Record<string, MatchFullStatData>> = {}
    const teamOfficialsRecord: Record<string, Record<string, OfficialAssignment>> = {}

    function ensureTeamOfficials(
      teamName: string,
      officialName: string,
      side: 'Home' | 'Away',
      matchId: string,
      role: string,
    ) {
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

      const homeTeam = {
        score: homeScore,
        name: homeName,
        id: dateEntry.h.id,
        halfTimeScore: null as number | null,
        shortName: homeName,
        abbr: homeAbbr,
        redCards: 0,
      }

      const awayTeam = {
        score: awayScore,
        name: awayName,
        id: dateEntry.a.id,
        halfTimeScore: null as number | null,
        shortName: awayName,
        abbr: awayAbbr,
        redCards: 0,
      }

      const matchData: MatchData = {
        kickoffTimezone: isBST(datetime) ? 'BST' : 'GMT',
        competitionId: '8',
        period: isResult ? 'FullTime' : 'Scheduled',
        matchWeek: matchweek,
        kickoff: datetime,
        awayTeam,
        competition: 'Premier League',
        clock: null,
        kickoffTimezoneString: 'Europe/London',
        homeTeam,
        season: String(year),
        ground: venue,
        resultType: isResult ? 'NormalResult' : null,
        matchId,
        attendance,
      }

      const matchweekKey = matchweek !== null && matchweek !== undefined ? matchweek : 0

      if (!matchesByMatchweek[matchweekKey]) {
        matchesByMatchweek[matchweekKey] = []
      }
      matchesByMatchweek[matchweekKey].push(matchData)

      if (referee) {
        ensureTeamOfficials(homeName, referee, 'Home', matchId, 'Referee')
        ensureTeamOfficials(awayName, referee, 'Away', matchId, 'Referee')
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

      const homeHistory = findTeamHistory(understatTeams, dateEntry.h.id, datetime, 'h')
      const awayHistory = findTeamHistory(understatTeams, dateEntry.a.id, datetime, 'a')

      if (isResult) {
        const homeStats: MatchFullStatData = {
          goals: homeScore || 0,
          goalsConceded: awayScore || 0,
          expectedGoals: homeHistory ? homeHistory.xG : 0,
          wonCorners: 0,
          duelWon: 0,
          totalDistance: 0,
          fkFoulLost: 0,
          totalOffside: 0,
          penaltyConceded: 0,
          totalYelCard: 0,
          totalRedCard: 0,
        }

        const awayStats: MatchFullStatData = {
          goals: awayScore || 0,
          goalsConceded: homeScore || 0,
          expectedGoals: awayHistory ? awayHistory.xG : 0,
          wonCorners: 0,
          duelWon: 0,
          totalDistance: 0,
          fkFoulLost: 0,
          totalOffside: 0,
          penaltyConceded: 0,
          totalYelCard: 0,
          totalRedCard: 0,
        }

        if (detail) {
          if (detail.extraStats) {
            if (detail.extraStats.corners) {
              homeStats.wonCorners = detail.extraStats.corners.home || 0
              awayStats.wonCorners = detail.extraStats.corners.away || 0
            }
            if (detail.extraStats.fouls) {
              homeStats.fkFoulLost = detail.extraStats.fouls.home || 0
              awayStats.fkFoulLost = detail.extraStats.fouls.away || 0
            }
            if (detail.extraStats.offsides) {
              homeStats.totalOffside = detail.extraStats.offsides.home || 0
              awayStats.totalOffside = detail.extraStats.offsides.away || 0
            }
          }
          if (detail.cards) {
            homeStats.totalYelCard = detail.cards.homeYellow || 0
            homeStats.totalRedCard = detail.cards.homeRed || 0
            awayStats.totalYelCard = detail.cards.awayYellow || 0
            awayStats.totalRedCard = detail.cards.awayRed || 0
          }
        }

        matchStatRecord[matchId] = {
          [homeName]: homeStats,
          [awayName]: awayStats,
        }
      }
    }

    const sortedMatchweeks = Object.entries(matchesByMatchweek)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([matchweek, matches]) => ({
        matchweek: parseInt(matchweek),
        data: {
          pagination: {
            _limit: 100,
            _prev: null,
            _next: null,
          },
          data: matches,
        },
      }))

    const outputDir = 'public/pl-form-comparison'
    const matchesOutput = {
      season: year,
      competition: 8,
      matchweeks: sortedMatchweeks,
    }

    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(
      path.join(outputDir, `${year}.json`),
      JSON.stringify(matchesOutput, null, 2),
    )
    console.log(`  Saved ${year}.json with ${sortedMatchweeks.length} matchweeks`)

    const statsOutput = {
      teams: teamOfficialsRecord,
      matchStatRecord,
    }
    await fs.writeFile(
      path.join(outputDir, `${year}-stats.json`),
      JSON.stringify(statsOutput, null, 2),
    )
    console.log(`  Saved ${year}-stats.json`)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
