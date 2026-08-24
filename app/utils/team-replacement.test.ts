import { describe, expect, test } from 'vitest'
import { getEquivalentTeamFromAnotherSeason } from './team-replacement'

describe('getEquivalentTeamFromAnotherSeason', () => {
  const testCases = [
    // 2026 (2026 -> lower, and lower -> 2026)
    { team: 'Coventry City', from: 2026, to: 2025, expected: 'West Ham United' },
    { team: 'Ipswich Town', from: 2026, to: 2025, expected: 'Burnley' },
    { team: 'Hull City', from: 2026, to: 2025, expected: 'Wolverhampton Wanderers' },

    { team: 'Coventry City', from: 2026, to: 2024, expected: 'Leicester City' },
    { team: 'Ipswich Town', from: 2026, to: 2024, expected: 'Ipswich Town' },
    { team: 'Hull City', from: 2026, to: 2024, expected: 'Southampton' },

    { team: 'Coventry City', from: 2026, to: 2023, expected: 'Luton Town' },
    { team: 'Ipswich Town', from: 2026, to: 2023, expected: 'Burnley' },
    { team: 'Hull City', from: 2026, to: 2023, expected: 'Sheffield United' },

    { team: 'Coventry City', from: 2026, to: 2022, expected: 'Leicester City' },
    { team: 'Ipswich Town', from: 2026, to: 2022, expected: 'Leeds United' },
    { team: 'Hull City', from: 2026, to: 2022, expected: 'Southampton' },

    // 2025 (2025 -> lower, and lower -> 2025)
    { team: 'Leeds United', from: 2025, to: 2024, expected: 'Leicester City' },
    { team: 'Burnley', from: 2025, to: 2024, expected: 'Ipswich Town' },
    { team: 'Sunderland', from: 2025, to: 2024, expected: 'Southampton' },

    { team: 'Leeds United', from: 2025, to: 2023, expected: 'Luton Town' },
    { team: 'Burnley', from: 2025, to: 2023, expected: 'Burnley' },
    { team: 'Sunderland', from: 2025, to: 2023, expected: 'Sheffield United' },

    { team: 'Leeds United', from: 2025, to: 2022, expected: 'Leicester City' },
    { team: 'Burnley', from: 2025, to: 2022, expected: 'Leeds United' },
    { team: 'Sunderland', from: 2025, to: 2022, expected: 'Southampton' },

    // 2024 (2024 -> lower, and lower -> 2024)
    { team: 'Leicester City', from: 2024, to: 2023, expected: 'Luton Town' },
    { team: 'Ipswich Town', from: 2024, to: 2023, expected: 'Burnley' },
    { team: 'Southampton', from: 2024, to: 2023, expected: 'Sheffield United' },

    { team: 'Leicester City', from: 2024, to: 2022, expected: 'Leicester City' },
    { team: 'Ipswich Town', from: 2024, to: 2022, expected: 'Leeds United' },
    { team: 'Southampton', from: 2024, to: 2022, expected: 'Southampton' },

    // 2023 (2023 -> lower, and lower -> 2023)
    { team: 'Burnley', from: 2023, to: 2022, expected: 'Leicester City' },
    { team: 'Sheffield United', from: 2023, to: 2022, expected: 'Leeds United' },
    { team: 'Luton Town', from: 2023, to: 2022, expected: 'Southampton' },
  ]

  test.each(testCases)('correctly replaces $team to $expected ($from->$to)', ({ team, from, to, expected }) => {
    const result = getEquivalentTeamFromAnotherSeason(team, from, to)

    expect(result).toBe(expected)
  })
})
