import type { SeasonTableData } from '@/types'
import { describe, expect, it } from 'vitest'
import { formatFdr, getDifficultyRating, getFdrColorClass, getTeamPoints } from './difficulty-rating'

describe('getDifficultyRating', () => {
  // Example: leader (rank 1) has 48 points, last place (rank 20) has 7 points
  // Distance = 48 - 7 = 41 points
  // FDR = (5 * percentile) / 100, where percentile = (opponent_points - last_place_points) / point_range * 100
  const leaderPoints = 48
  const lastPlacePoints = 7
  const pointRange = leaderPoints - lastPlacePoints // 41

  it('should return FDR 5 for team at leader points (100% percentile)', () => {
    // (48-7)/41 * 100 = 100%, FDR = (5 * 100) / 100 = 5
    expect(getDifficultyRating(48, leaderPoints, lastPlacePoints, 'home')).toBe(5)
  })

  it('should return FDR 5 (clamped) for team above leader at home', () => {
    // Should clamp to 5 max
    expect(getDifficultyRating(50, leaderPoints, lastPlacePoints, 'home')).toBe(5)
  })

  it('should return FDR 5 (clamped) for team above leader away (before clamping would be 5.5)', () => {
    // Should clamp to 5 max
    expect(getDifficultyRating(50, leaderPoints, lastPlacePoints, 'away')).toBe(5)
  })

  it('should return FDR ~4 for team at 80% percentile at home', () => {
    // 80% of 41 = 32.8, so 32.8 + 7 = 39.8 ≈ 40
    // (40-7)/41 * 100 = 80.49%, FDR = (5 * 80.49) / 100 = 4.02 ≈ 4
    const opponentPoints = 40
    const fdr = getDifficultyRating(opponentPoints, leaderPoints, lastPlacePoints, 'home')
    expect(fdr).toBeCloseTo(4.02, 1)
  })

  it('should return FDR ~4.5 for team at 80% percentile away', () => {
    // 80.49% percentile + 0.5 for away = 4.52
    const opponentPoints = 40
    const fdr = getDifficultyRating(opponentPoints, leaderPoints, lastPlacePoints, 'away')
    expect(fdr).toBeCloseTo(4.52, 1)
  })

  it('should return FDR ~3 for team at 60% percentile at home', () => {
    // 60% of 41 = 24.6, so 24.6 + 7 = 31.6 ≈ 32
    // (32-7)/41 * 100 = 61%, FDR = (5 * 61) / 100 = 3.05 ≈ 3
    const opponentPoints = 32
    const fdr = getDifficultyRating(opponentPoints, leaderPoints, lastPlacePoints, 'home')
    expect(fdr).toBeCloseTo(3.05, 1)
  })

  it('should return FDR ~3.5 for team at 60% percentile away', () => {
    // 61% percentile + 0.5 for away = 3.55
    const opponentPoints = 32
    const fdr = getDifficultyRating(opponentPoints, leaderPoints, lastPlacePoints, 'away')
    expect(fdr).toBeCloseTo(3.55, 1)
  })

  it('should return FDR ~2 for team at 40% percentile at home', () => {
    // 40% of 41 = 16.4, so 16.4 + 7 = 23.4 ≈ 24
    // (24-7)/41 * 100 = 41.46%, FDR = (5 * 41.46) / 100 = 2.07 ≈ 2
    const opponentPoints = 24
    const fdr = getDifficultyRating(opponentPoints, leaderPoints, lastPlacePoints, 'home')
    expect(fdr).toBeCloseTo(2.07, 1)
  })

  it('should return FDR ~2.5 for team at 40% percentile away', () => {
    // 41.46% percentile + 0.5 for away = 2.57
    const opponentPoints = 24
    const fdr = getDifficultyRating(opponentPoints, leaderPoints, lastPlacePoints, 'away')
    expect(fdr).toBeCloseTo(2.57, 1)
  })

  it('should return FDR 1 for team at last place (0% percentile) at home', () => {
    // (7-7)/41 * 100 = 0%, FDR = (5 * 0) / 100 = 0, clamped to 1
    expect(getDifficultyRating(7, leaderPoints, lastPlacePoints, 'home')).toBe(1)
  })

  it('should return FDR 1 (clamped) for team below last place at home', () => {
    // Should clamp to 1 min
    expect(getDifficultyRating(0, leaderPoints, lastPlacePoints, 'home')).toBe(1)
  })

  it('should return FDR 1 (clamped) for team below last place away (before clamping would be 1.5)', () => {
    // Should clamp to 1 min
    expect(getDifficultyRating(0, leaderPoints, lastPlacePoints, 'away')).toBe(1)
  })

  it('should return FDR 1.5 for team at 20% percentile away', () => {
    // 20% of 41 = 8.2, so 8.2 + 7 = 15.2 ≈ 15
    // (15-7)/41 * 100 = 19.51%, FDR = (5 * 19.51) / 100 = 0.98 ≈ 1, clamped to 1
    // but with away bonus: 1 + 0.5 = 1.5
    const opponentPoints = 15
    const fdr = getDifficultyRating(opponentPoints, leaderPoints, lastPlacePoints, 'away')
    expect(fdr).toBeCloseTo(1.47, 0.01)
  })

  it('should return mid-tier (FDR 3) when point range is 0 (all teams same points)', () => {
    expect(getDifficultyRating(48, 48, 48, 'home')).toBe(3)
  })
})

describe('getTeamPoints', () => {
  const mockTable: SeasonTableData[] = [
    { name: 'Arsenal', abbr: 'ARS', points: 48, gf: 40, ga: 14, gd: 26 },
    { name: 'Manchester City', abbr: 'MCI', points: 42, gf: 44, ga: 18, gd: 26 },
    { name: 'Liverpool', abbr: 'LIV', points: 41, gf: 38, ga: 15, gd: 23 },
    { name: 'Wolverhampton Wanderers', abbr: 'WOL', points: 6, gf: 14, ga: 40, gd: -26 },
  ]

  it('should return points for the leader', () => {
    expect(getTeamPoints('Arsenal', mockTable)).toBe(48)
  })

  it('should return correct points for mid-table teams', () => {
    expect(getTeamPoints('Liverpool', mockTable)).toBe(41)
  })

  it('should return points for last team', () => {
    expect(getTeamPoints('Wolverhampton Wanderers', mockTable)).toBe(6)
  })

  it('should return undefined for team not in table', () => {
    expect(getTeamPoints('Chelsea', mockTable)).toBeUndefined()
  })
})

describe('getFdrColorClass', () => {
  it('should return green for FDR 1 (easy)', () => {
    expect(getFdrColorClass(1)).toBe('bg-green-200 text-green-900')
  })

  it('should return yellow-green for FDR 1.5', () => {
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
