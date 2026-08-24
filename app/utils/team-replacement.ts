import { TEAMS_PER_SEASON } from '@/constants'

// Keyed by season: "2022" -> 2022-23, "2023" -> 2023-24, "2024" -> 2024-25, "2025" -> 2025-26.
// The club gets promoted/relegated in that season. Both maps share the same keys (2022-2025);
// the live 2026-27 season is omitted because its relegation result isn't known yet.
// PROMOTED lists the teams that came up into that season; RELEGATED lists the teams that went down from it.
export const PROMOTED_TEAMS_TO_PREMIER_LEAGUE: Record<string, string[]> = {
  '2025': ['Coventry City', 'Ipswich Town', 'Hull City'],
  '2024': ['Leeds United', 'Burnley', 'Sunderland'],
  '2023': ['Leicester City', 'Ipswich Town', 'Southampton'],
  '2022': ['Burnley', 'Sheffield United', 'Luton Town'],
}
const RELEGATED_TEAMS_FROM_PREMIER_LEAGUE: Record<string, string[]> = {
  '2025': ['West Ham United', 'Burnley', 'Wolverhampton Wanderers'],
  '2024': ['Leicester City', 'Ipswich Town', 'Southampton'],
  '2023': ['Luton Town', 'Burnley', 'Sheffield United'],
  '2022': ['Leicester City', 'Leeds United', 'Southampton'],
}

export function getEquivalentTeamFromAnotherSeason(team: string, from: number, to: number) {
  if (from <= to) {
    return team
  }

  if (TEAMS_PER_SEASON[to]?.includes(team)) {
    // Team already plays in the target season; no cross-season substitution needed.
    return team
  }

  // `from`/`to` are TEAMS indices (the season's end year, e.g. 2026 = 2025-26).
  // RELEGATED is keyed by that same end year, but PROMOTED is keyed by the season's start year
  // (promotees of season N+1 live under key N), so PROMOTED keys shift by -1.
  const promotedFromKey = (from - 1).toString()
  const promotedToKey = (to - 1).toString()

  // Forward (current -> past): a team promoted into "from" replaced the team relegated from "to".
  // Reverse (past -> current): a team relegated from "from" is replaced by the team promoted into "to".
  // Slot index is kept aligned in both directions.
  let anchorList = RELEGATED_TEAMS_FROM_PREMIER_LEAGUE[from.toString()]
  let targetList = PROMOTED_TEAMS_TO_PREMIER_LEAGUE[promotedToKey]
  if (from > to) {
    anchorList = PROMOTED_TEAMS_TO_PREMIER_LEAGUE[promotedFromKey]
    targetList = RELEGATED_TEAMS_FROM_PREMIER_LEAGUE[to.toString()]
  }

  if (!anchorList || !targetList) {
    // No mapping data for this season pair (e.g. the live season whose result isn't known yet).
    // Fall back to the team itself rather than crashing the caller.
    return team
  }

  const slotIdx = anchorList.indexOf(team)
  if (slotIdx === -1) {
    // Going toward the past: the team may have been promoted in an earlier season K (K+1 < from).
    // Its slot in the older target season was held by the team relegated from K+1 (the team it replaced).
    // Look up from the biggest K down to the smallest so the season closest to `from` is tried first.
    const promoKeys = Object.keys(PROMOTED_TEAMS_TO_PREMIER_LEAGUE)
      .map(Number)
      .filter((k) => k < from - 1)
      .sort((a, b) => b - a)
    for (const key of promoKeys) {
      const keyStr = key.toString()
      const promotedList = PROMOTED_TEAMS_TO_PREMIER_LEAGUE[keyStr]
      const idx = promotedList.indexOf(team)

      return RELEGATED_TEAMS_FROM_PREMIER_LEAGUE[keyStr][idx]
    }
  }

  const equivalentTeam = targetList[slotIdx]
  if (!equivalentTeam) {
    throw new Error(`No equivalent team found for ${team} (index ${slotIdx}) in season ${to}`)
  }

  return equivalentTeam
}
