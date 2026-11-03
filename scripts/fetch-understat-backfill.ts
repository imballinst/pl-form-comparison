import fs from 'fs/promises'
import type { FbrefScheduleEntry, UnderstatDateEntry, UnderstatRawData } from './types'
import { FBREF_TO_APP, UNDERSTAT_TO_APP, YEAR } from './utils'

const RAW_PATH = `scripts/references/${YEAR}-understat-raw.json`

// Set `UNDERSTAT_BACKFILL_SINCE=YYYY-MM-DD` to merge on/after that date
// (inclusive). When unset, the default is "strictly after the last result
// Understat already recorded", i.e. resume from where Understat stopped.
//
// Only scheduled/unplayed entries from the cutoff onward are replaced; results
// already in the raw file (with real Understat xG) are never touched. When
// Understat is available again, `stat:update:understat` rewrites the raw file
// wholesale, discarding all backfilled entries.
//
// Match ids: Understat already assigned ids to every fixture (results and
// future matches alike), so backfilled entries *adopt* the raw id for the same
// fixture pair. Only fixtures Understat never saw (added after the outage)
// get synthetic ids — numeric continuation above the last id in the file.
// Pair-based adoption keeps ids stable across backfill runs: a fixture keeps
// its id when it moves dates or gets played.
const SINCE_ENV = 'UNDERSTAT_BACKFILL_SINCE'
// Team short titles from Understat are 2-4 uppercase letters; legacy slug-id
// backfilled entries used the same format, so this only filters junk values
// (e.g. full team names) from picking up as reference values.
const SHORT_TITLES_OK = /^[A-Z]{2,4}$/

// Understat-abbr equivalents (correct `short_title` values, taken from the
// values Understat last committed). Extend this map when a promoted team is
// missing; the fallback is the first 3 capital letters with a console warning.
const APP_TO_ABBR: Record<string, string> = {
  Arsenal: 'ARS',
  'Aston Villa': 'AVL',
  Bournemouth: 'BOU',
  Brentford: 'BRE',
  'Brighton and Hove Albion': 'BRI',
  Chelsea: 'CHE',
  'Coventry City': 'COV',
  'Crystal Palace': 'CRY',
  Everton: 'EVE',
  Fulham: 'FLH',
  'Hull City': 'HUL',
  'Ipswich Town': 'IPS',
  'Leeds United': 'LED',
  Liverpool: 'LIV',
  'Manchester City': 'MCI',
  'Manchester United': 'MUN',
  'Newcastle United': 'NEW',
  'Nottingham Forest': 'NOT',
  Sunderland: 'SUN',
  'Tottenham Hotspur': 'TOT',
}

function normalizeUnderstatName(name: string): string {
  return UNDERSTAT_TO_APP[name] || name
}

function normalizeFbrefName(name: string): string {
  return FBREF_TO_APP[name] || name
}

const SCORE_DELIMITER = '–'

function parseScore(scoreStr: string | null): { home: string; away: string } | null {
  if (!scoreStr || scoreStr === SCORE_DELIMITER) return null
  const parts = scoreStr.split(SCORE_DELIMITER)
  if (parts.length !== 2) return null
  const [home, away] = parts
  if (home === '' || away === '') return null
  if (Number.isNaN(Number.parseInt(home, 10)) || Number.isNaN(Number.parseInt(away, 10))) return null
  return { home, away }
}

function getDay(datetime: string): string {
  return datetime.split(' ')[0]
}

// The schedule's ISO datetime matches the committed (Understat-format)
// kickoffs verbatim when `T`/`Z` are dropped — `resolve_datetime` already
// appends an ambiguous offset, so no re-conversion here, just reshaping
// ("2027-01-30T15:00:00Z" -> "2027-01-30 15:00:00").
function toUnderstatDatetime(iso: string): string {
  return iso.replace('T', ' ').split('.')[0].replace('Z', '')
}

function getAbbr(name: string): string {
  const abbr = APP_TO_ABBR[name]
  if (abbr) return abbr
  console.warn(`No abbr mapping for "${name}", falling back to first 3 letters`)
  return name.slice(0, 3).toUpperCase()
}

function pairKeyOfNormalized(homeName: string, awayName: string): string {
  return `${homeName}_${awayName}`
}

// Per-team Understat metadata (numeric Understat id, its exact title, and its
// short_title), harvested from the raw file's untouched `teams` map (id/title)
// and date entries (short_title) so that backfilled entries keep the
// Understat-native shape and produce minimal diffs. Teams never seen fall
// back to app-name identity + abbr table.
interface UnderstatTeamMeta { id: string; title: string; short_title: string }

function collectUnderstatTeamMeta(raw: UnderstatRawData | null): Map<string, UnderstatTeamMeta> {
  const byApp = new Map<string, UnderstatTeamMeta>()
  const shortTitleByApp = new Map<string, string>()
  for (const entry of (raw?.dates ?? [])) {
    for (const team of [entry.h, entry.a]) {
      const appName = normalizeUnderstatName(team.title)
      if (!shortTitleByApp.has(appName) && SHORT_TITLES_OK.test(team.short_title)) {
        shortTitleByApp.set(appName, team.short_title)
      }
    }
  }
  for (const team of Object.values(raw?.teams ?? {})) {
    const appName = normalizeUnderstatName(team.title)
    if (!byApp.has(appName) && /^\d+$/.test(team.id)) {
      byApp.set(appName, { id: team.id, title: team.title, short_title: shortTitleByApp.get(appName) ?? getAbbr(appName) })
    }
  }
  return byApp
}

function toBackfillEntry(
  entry: FbrefScheduleEntry,
  teamMetaByApp: Map<string, UnderstatTeamMeta>,
): UnderstatDateEntry {
  const homeName = normalizeFbrefName(entry.home)
  const awayName = normalizeFbrefName(entry.away)
  const score = parseScore(entry.score)

  const metaOf = (appName: string): UnderstatTeamMeta => teamMetaByApp.get(appName) ?? {
    id: appName,
    title: appName,
    // Key order matters for diffs; keep the same order in all branches.
    short_title: getAbbr(appName),
  }
  const metaHome = metaOf(homeName)
  const metaAway = metaOf(awayName)

  // Mirrors Understat's own shapes: scheduled matches carry `goals`/`xG`
  // {h: null, a: null}; results carry real `goals` and `forecast`-free `xG`
  // is left off (no xG source without Understat).
  return {
    id: '',
    isResult: score !== null,
    h: { id: metaHome.id, title: metaHome.title, short_title: metaHome.short_title },
    a: { id: metaAway.id, title: metaAway.title, short_title: metaAway.short_title },
    goals: score ? { h: score.home, a: score.away } : { h: null, a: null },
    ...(score ? {} : { xG: { h: null, a: null } }),
    datetime: toUnderstatDatetime(entry.datetime),
  }
}

// Keyed on normalized (app) team names for dates entries; candidates use
// Understat-native titles, which `normalizeUnderstatName` maps to the same
// app names.
function entryPairKey(d: UnderstatDateEntry): string {
  return pairKeyOfNormalized(normalizeUnderstatName(d.h.title), normalizeUnderstatName(d.a.title))
}

async function main() {
  let raw: UnderstatRawData | null = null
  try {
    raw = JSON.parse(await fs.readFile(RAW_PATH, 'utf-8'))
  } catch {
    console.warn(`No existing ${RAW_PATH}, backfilling the whole season from FBref`)
  }
  const existingDates = raw?.dates ?? []
  const teamMetaByApp = collectUnderstatTeamMeta(raw)

  const fbrefSchedule: FbrefScheduleEntry[] = JSON.parse(
    await fs.readFile(`scripts/references/${YEAR}-fbref-schedule.json`, 'utf-8'),
  )
  console.log(`Loaded ${fbrefSchedule.length} schedule entries for ${YEAR}`)

  // Cutoff selection.
  const sinceEnv = process.env[SINCE_ENV]
  let cutoffDay: string
  let onOrAfterCutoff: boolean
  if (sinceEnv) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceEnv)) {
      throw new Error(`${SINCE_ENV} must be YYYY-MM-DD, got: ${sinceEnv}`)
    }
    cutoffDay = sinceEnv
    onOrAfterCutoff = true
  } else {
    const resultDays = existingDates.filter((d) => d.isResult).map((d) => getDay(d.datetime || d.date || ''))
    if (!resultDays.length) {
      cutoffDay = '0000-01-01'
    } else {
      // `resultDays` is non-empty here, so the last element always exists.
      cutoffDay = resultDays.sort()[resultDays.length - 1]
    }
    // Default resume: strictly after the last recorded result. Matches played
    // on the same `cutoffDay` were already fetched by Understat.
    onOrAfterCutoff = false
  }
  console.log(
    `Backfill cutoff: matches ${onOrAfterCutoff ? 'on or after' : 'after'} ${cutoffDay}` +
      `(set ${SINCE_ENV} to override)`,
  )

  function inRange(day: string): boolean {
    return onOrAfterCutoff ? day >= cutoffDay : day > cutoffDay
  }

  const candidates = fbrefSchedule
    .map((entry) => toBackfillEntry(entry, teamMetaByApp))
    .filter((entry) => inRange(getDay(entry.datetime)))
  const candidatePairs = new Set(candidates.map(entryPairKey))

  // Keep results Understat already recorded (their xG/history exists there);
  // a backfilled entry for one of those fixtures would only overwrite real
  // data with xG 0.
  const coveredPairs = new Set(existingDates.filter((d) => d.isResult).map(entryPairKey))

  // Ids to adopt: an existing *scheduled* entry (that the backfill replaces)
  // carries the genuine Understat id for its fixture. Non-numeric entries
  // (legacy backfills with slug ids) are never adopted as a source.
  const scheduledIdByPair = new Map<string, string>()
  let syntheticIdSeed = 0
  for (const d of existingDates) {
    if (/^\d+$/.test(d.id) && Number.parseInt(d.id, 10) > syntheticIdSeed) {
      syntheticIdSeed = Number.parseInt(d.id, 10)
    }
    if (d.isResult || !/^\d+$/.test(d.id)) continue
    scheduledIdByPair.set(entryPairKey(d), d.id)
  }
  // Numeric continuation above every id already present in the file.
  let adoptedIdsAssigned = 0
  let synthesizedIdsAssigned = 0

  let freshCandidates = candidates.filter((d) => !coveredPairs.has(entryPairKey(d)))
  // Deterministic id assignment: enumerate in kickoff order (schedule entries
  // already arrive grouped by matchweek from earliest to latest), so a rerun
  // assigns the same ids unless a fixture's kickoff itself changed.
  freshCandidates = freshCandidates.sort((a, b) => (a.datetime || a.date || '').localeCompare(b.datetime || b.date || ''))
  for (const candidate of freshCandidates) {
    const adoptedId = scheduledIdByPair.get(entryPairKey(candidate))
    if (adoptedId) {
      candidate.id = adoptedId
      adoptedIdsAssigned += 1
    } else {
      candidate.id = String(syntheticIdSeed + 1)
      syntheticIdSeed = syntheticIdSeed + 1
      synthesizedIdsAssigned += 1
    }
  }
  const ids = new Set(freshCandidates.map((d) => d.id))
  if (ids.size !== freshCandidates.length) {
    throw new Error('duplicate match ids among backfilled entries')
  }

  // Dropping stale raw entries in range: unplayed fixtures (re-scheduling
  // happens between releases) or fixtures the fresh schedule carries.
  const kept = existingDates.filter((d) => {
    if (d.isResult) return true
    return !inRange(getDay(d.datetime || d.date || '')) && !candidatePairs.has(entryPairKey(d))
  })

  // Migrate results created by earlier backfill runs (which used slug ids like
  // "9LiverpoolArsenal") to numeric ids: adopt the pair's Understat id when it
  // still exists in the file, else continue the numeric sequence. This keeps
  // the id space homogeneous even mid-outage. Team entries created by earlier
  // backfill runs (app-name ids) are restored to Understat-native ids/titles.
  let migratedLegacyIds = 0
  for (const d of kept) {
    if (!/^\d+$/.test(d.id)) {
      const adoptedId = scheduledIdByPair.get(entryPairKey(d))
      if (adoptedId) {
        d.id = adoptedId
        adoptedIdsAssigned += 1
      } else {
        d.id = String(syntheticIdSeed + 1)
        syntheticIdSeed = syntheticIdSeed + 1
        synthesizedIdsAssigned += 1
      }
      migratedLegacyIds += 1
    }
    for (const team of [d.h, d.a]) {
      const native = teamMetaByApp.get(normalizeUnderstatName(team.title)) ?? teamMetaByApp.get(team.title)
      if (native) {
        team.id = native.id
        team.title = native.title
        team.short_title = native.short_title
      }
    }
  }

  const merged = [...kept, ...freshCandidates].sort((x, y) => (x.datetime || x.date || '').localeCompare(y.datetime || y.date || ''))
  const addedResults = freshCandidates.filter((d) => d.isResult).length

  console.log(
    `Merged: kept ${kept.length} existing (incl. ${existingDates.filter((d) => d.isResult).length} results), ` +
      `replaced/added ${freshCandidates.length} entries (${addedResults} new results; ` +
      `${adoptedIdsAssigned} Understat ids adopted, ${synthesizedIdsAssigned} synthesized, ` +
      `${migratedLegacyIds} legacy slug ids migrated)`,
  )
  // Key order mirrors Understat's native payload, keeping diffs minimal.
  const output: UnderstatRawData = { teams: raw?.teams ?? {}, players: raw?.players ?? [], dates: merged }
  await fs.writeFile(RAW_PATH, JSON.stringify(output, null, 2))
  console.log(`Saved ${RAW_PATH}`)
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
