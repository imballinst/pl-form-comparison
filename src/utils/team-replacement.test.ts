import { describe, expect, it } from 'vitest'
import { replaceTeamFromAnchorSeasonToPromotedTeamThatSeason } from './team-replacement'

describe('replaceTeamFromAnchorSeasonToPromotedTeamThatSeason', () => {
  //   const testCases = [

  //   '2024': ['Leeds', 'Burnley', 'Sunderland'],
  //   '2024': ['Leicester City', 'Ipswich Town', 'Southampton'],

  //   '2023': ['Luton Town', 'Burnley', 'Sheffield United'],
  //   '2023': ['Leicester City', 'Ipswich Town', 'Southampton'],

  //   '2022': ['Burnley', 'Sheffield United', 'Luton Town'],
  //   '2022': ['Leicester City', 'Leeds United', 'Southampton'],
  // }
  //   ]

  it('replaces Southampton with Sunderland', () => {
    const result = replaceTeamFromAnchorSeasonToPromotedTeamThatSeason('Southampton', 2024, 2025)

    expect(result).toBe('Sunderland')
  })
})
