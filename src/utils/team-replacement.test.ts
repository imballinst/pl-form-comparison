import { describe, expect, test } from 'vitest'
import { getEquivalentTeamFromAnotherSeason } from './team-replacement'

describe('getEquivalentTeamFromAnotherSeason', () => {
  const testCases = [
    { team: 'Leeds United', from: 2025, to: 2024, expected: 'Leicester City' },
    { team: 'Burnley', from: 2025, to: 2024, expected: 'Ipswich Town' },
    { team: 'Sunderland', from: 2025, to: 2024, expected: 'Southampton' },

    { expected: 'Leeds United', from: 2024, to: 2025, team: 'Leicester City' },
    { expected: 'Burnley', from: 2024, to: 2025, team: 'Ipswich Town' },
    { expected: 'Sunderland', from: 2024, to: 2025, team: 'Southampton' },

    { team: 'Leeds United', from: 2025, to: 2023, expected: 'Burnley' },
    { team: 'Burnley', from: 2025, to: 2023, expected: 'Sheffield United' },
    { team: 'Sunderland', from: 2025, to: 2023, expected: 'Luton Town' },

    { expected: 'Leeds United', from: 2023, to: 2025, team: 'Burnley' },
    { expected: 'Burnley', from: 2023, to: 2025, team: 'Sheffield United' },
    { expected: 'Sunderland', from: 2023, to: 2025, team: 'Luton Town' },
  ]

  test.each(testCases)('correctly replaces $team to $expected ($from->$to)', ({ team, from, to, expected }) => {
    const result = getEquivalentTeamFromAnotherSeason(team, from, to)

    expect(result).toBe(expected)
  })
})
