import type { SeasonTableData } from '@/types'
import { describe, expect, it } from 'vitest'
import { formatFdr, getDifficultyRating, getFdrColorClass, getTeamLeaguePosition } from './difficulty-rating'

describe('getDifficultyRating', () => {
  it('should return FDR 5 for top 4 teams at home', () => {
    expect(getDifficultyRating(1, 'home')).toBe(5)
    expect(getDifficultyRating(4, 'home')).toBe(5)
  })

  it('should return FDR 5.5 for top 4 teams away', () => {
    expect(getDifficultyRating(1, 'away')).toBe(5) // Clamped to 5
    expect(getDifficultyRating(4, 'away')).toBe(5) // Clamped to 5
  })

  it('should return FDR 4 for positions 5-8 at home', () => {
    expect(getDifficultyRating(5, 'home')).toBe(4)
    expect(getDifficultyRating(8, 'home')).toBe(4)
  })

  it('should return FDR 4.5 for positions 5-8 away', () => {
    expect(getDifficultyRating(5, 'away')).toBe(4.5)
    expect(getDifficultyRating(8, 'away')).toBe(4.5)
  })

  it('should return FDR 3 for positions 9-12 at home', () => {
    expect(getDifficultyRating(9, 'home')).toBe(3)
    expect(getDifficultyRating(12, 'home')).toBe(3)
  })

  it('should return FDR 3.5 for positions 9-12 away', () => {
    expect(getDifficultyRating(9, 'away')).toBe(3.5)
    expect(getDifficultyRating(12, 'away')).toBe(3.5)
  })

  it('should return FDR 2 for positions 13-16 at home', () => {
    expect(getDifficultyRating(13, 'home')).toBe(2)
    expect(getDifficultyRating(16, 'home')).toBe(2)
  })

  it('should return FDR 2.5 for positions 13-16 away', () => {
    expect(getDifficultyRating(13, 'away')).toBe(2.5)
    expect(getDifficultyRating(16, 'away')).toBe(2.5)
  })

  it('should return FDR 1 for positions 17-20 at home', () => {
    expect(getDifficultyRating(17, 'home')).toBe(1)
    expect(getDifficultyRating(20, 'home')).toBe(1)
  })

  it('should return FDR 1.5 for positions 17-20 away', () => {
    expect(getDifficultyRating(17, 'away')).toBe(1.5)
    expect(getDifficultyRating(20, 'away')).toBe(1.5)
  })
})

describe('getTeamLeaguePosition', () => {
  const mockTable: SeasonTableData[] = [
    { name: 'Arsenal', abbr: 'ARS', points: 48, gf: 40, ga: 14, gd: 26 },
    { name: 'Manchester City', abbr: 'MCI', points: 42, gf: 44, ga: 18, gd: 26 },
    { name: 'Liverpool', abbr: 'LIV', points: 41, gf: 38, ga: 15, gd: 23 },
    { name: 'Wolverhampton Wanderers', abbr: 'WOL', points: 6, gf: 14, ga: 40, gd: -26 },
  ]

  it('should return 1 for the first team', () => {
    expect(getTeamLeaguePosition('Arsenal', mockTable)).toBe(1)
  })

  it('should return correct position for mid-table teams', () => {
    expect(getTeamLeaguePosition('Liverpool', mockTable)).toBe(3)
  })

  it('should return position for last team', () => {
    expect(getTeamLeaguePosition('Wolverhampton Wanderers', mockTable)).toBe(4)
  })

  it('should return undefined for team not in table', () => {
    expect(getTeamLeaguePosition('Chelsea', mockTable)).toBeUndefined()
  })
})

describe('getFdrColorClass', () => {
  it('should return green for FDR 1 (easy)', () => {
    expect(getFdrColorClass(1)).toBe('bg-green-200 text-green-900')
  })

  it('should return green for FDR 1.5', () => {
    expect(getFdrColorClass(1.5)).toBe('bg-green-200 text-green-900')
  })

  it('should return yellow for FDR 3 (moderate)', () => {
    expect(getFdrColorClass(3)).toBe('bg-yellow-400 text-yellow-900')
  })

  it('should return orange for FDR 4.5', () => {
    expect(getFdrColorClass(4.5)).toBe('bg-orange-400 text-orange-900')
  })

  it('should return red for FDR 5 (difficult)', () => {
    expect(getFdrColorClass(5)).toBe('bg-red-500 text-white')
  })
})

describe('formatFdr', () => {
  it('should format integer FDR values without decimals', () => {
    expect(formatFdr(1)).toBe('1')
    expect(formatFdr(3)).toBe('3')
    expect(formatFdr(5)).toBe('5')
  })

  it('should format decimal FDR values with one decimal place', () => {
    expect(formatFdr(1.5)).toBe('1.5')
    expect(formatFdr(4.5)).toBe('4.5')
    expect(formatFdr(3.5)).toBe('3.5')
  })

  it('should round edge cases correctly', () => {
    expect(formatFdr(1.0)).toBe('1')
    expect(formatFdr(1.50001)).toBe('1.5')
  })
})
