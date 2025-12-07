export const PROMOTED_TEAMS_TO_PREMIER_LEAGUE: Record<string, string[]> = {
  '2024': ['Leeds', 'Burnley', 'Sunderland'],
  '2023': ['Leicester City', 'Ipswich Town', 'Southampton'],
  '2022': ['Burnley', 'Sheffield United', 'Luton Town'],
}

export const RELEGATED_TEAMS_TO_CHAMPIONSHIP: Record<string, string[]> = {
  '2024': ['Leicester City', 'Ipswich Town', 'Southampton'],
  '2023': ['Luton Town', 'Burnley', 'Sheffield United'],
  '2022': ['Leicester City', 'Leeds United', 'Southampton'],
}

export function replaceTeamFromAnchorSeasonToPromotedTeamThatSeason(team: string, from: number, to: number) {
  const promotedTeams = PROMOTED_TEAMS_TO_PREMIER_LEAGUE[(to - 1).toString()]
  const relegatedTeams = RELEGATED_TEAMS_TO_CHAMPIONSHIP[from.toString()]

  if (!promotedTeams || !relegatedTeams) {
    return team
  }

  const relegatedTeamsIdx = relegatedTeams.indexOf(team)
  if (relegatedTeamsIdx === -1) {
    return team
  }

  const relegatedTeam = promotedTeams[relegatedTeamsIdx]
  if (!relegatedTeam) {
    throw new Error('error')
  }

  return relegatedTeam
}
