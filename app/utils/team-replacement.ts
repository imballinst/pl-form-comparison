import { TEAMS_PER_SEASON } from '@/constants'

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
  if (TEAMS_PER_SEASON[to]?.includes(team)) {
    // If team exist in the said season, then return directly.
    return team
  }

  let currentTeamPromotionIndex = -1
  for (const seasonKey in PROMOTED_TEAMS_TO_PREMIER_LEAGUE) {
    currentTeamPromotionIndex = PROMOTED_TEAMS_TO_PREMIER_LEAGUE[seasonKey].indexOf(team)
    if (currentTeamPromotionIndex > -1) {
      break
    }
  }

  // The team isn't in Premier League that season, so we find the equivalent index.
  const relegatedTeamsTargetYear = RELEGATED_TEAMS_FROM_PREMIER_LEAGUE[to.toString()]
  if (!relegatedTeamsTargetYear) {
    throw new Error(`Missing relegated teams to target year ${from}`)
  }

  const equivalentTeam = relegatedTeamsTargetYear[currentTeamPromotionIndex]
  if (!equivalentTeam) {
    throw new Error(
      `No promoted team found from ${relegatedTeamsTargetYear.join(', ')}, want team ${team}, index ${currentTeamPromotionIndex}`,
    )
  }

  return equivalentTeam
}
