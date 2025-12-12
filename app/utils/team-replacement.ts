export const PROMOTED_TEAMS_TO_PREMIER_LEAGUE: Record<string, string[]> = {
  '2025': ['Leeds United', 'Burnley', 'Sunderland'],
  '2024': ['Leicester City', 'Ipswich Town', 'Southampton'],
  '2023': ['Burnley', 'Sheffield United', 'Luton Town'],
}

export function getEquivalentTeamFromAnotherSeason(team: string, from: number, to: number) {
  const promotedTeamsAnchorYear = PROMOTED_TEAMS_TO_PREMIER_LEAGUE[from.toString()]
  const promotedTeams = PROMOTED_TEAMS_TO_PREMIER_LEAGUE[to.toString()]

  if (!promotedTeamsAnchorYear) {
    return team
  }

  const promotedTeamsIdx = promotedTeamsAnchorYear.indexOf(team)
  if (promotedTeamsIdx === -1) {
    return team
  }

  const equivalentTeam = promotedTeams[promotedTeamsIdx]
  if (!equivalentTeam) {
    throw new Error('error')
  }

  return equivalentTeam
}
