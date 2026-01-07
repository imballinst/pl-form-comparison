import type { SeasonTableData } from '@/types'

/**
 * Calculates Fixture Difficulty Rating (FDR) based on opponent's strength as a percentile.
 *
 * Formula:
 * 1. Calculate percentile: (opponent_points - last_place_points) / (leader_points - last_place_points) * 100%
 * 2. Map percentile to FDR tier:
 *    - FDR 5: >= 80% (very strong, closest to leader)
 *    - FDR 4: 60-79%
 *    - FDR 3: 40-59%
 *    - FDR 2: 20-39%
 *    - FDR 1: 0-19% (weakest)
 *
 * Away matches get a +0.5 bonus (easier to score away, harder to defend away).
 * Result is clamped to 1–5.
 *
 * @param opponentPoints - Opponent's current league points
 * @param leaderPoints - Leader's (1st place) current league points
 * @param lastPlacePoints - Last place team's current league points
 * @param venue - "home" or "away"
 * @returns FDR score (1–5)
 */
export function getDifficultyRating(opponentPoints: number, leaderPoints: number, lastPlacePoints: number, venue: 'home' | 'away'): number {
  // Calculate total point distance (league range)
  const pointRange = leaderPoints - lastPlacePoints

  // Avoid division by zero if all teams have same points
  if (pointRange === 0) {
    return 3 // Default to mid-tier
  }

  // Calculate opponent's percentile (0-100%)
  const percentile = ((opponentPoints - lastPlacePoints) / pointRange) * 100
  let fdr = (5 * percentile) / 100

  // Away matches are slightly easier (add 0.5 to FDR)
  if (venue === 'away') {
    fdr += 0.5
  }

  // Clamp to 1–5 range
  return Math.min(5, Math.max(1, fdr))
}

/**
 * Finds the league position of a team in the current season table.
 * Position is 1-indexed (1 = 1st place).
 * Returns undefined if team not found.
 *
 * @param teamName - Full team name (e.g., "Arsenal")
 * @param table - Current season league table
 * @returns Position (1-indexed) or undefined
 */
export function getTeamLeaguePosition(teamName: string, table: SeasonTableData[]): number | undefined {
  const index = table.findIndex((entry) => entry.name === teamName)
  return index >= 0 ? index + 1 : undefined
}

/**
 * Gets the points for a team from the league table.
 * Returns undefined if team not found.
 *
 * @param teamName - Full team name (e.g., "Arsenal")
 * @param table - Current season league table
 * @returns Points or undefined
 */
export function getTeamPoints(teamName: string, table: SeasonTableData[]): number | undefined {
  const entry = table.find((t) => t.name === teamName)
  return entry?.points
}

/**
 * Returns a CSS class for FDR styling based on the rating.
 * Uses a green-to-red gradient: green (easy, FDR 1) → red (difficult, FDR 5)
 *
 * @param fdr - FDR score (1–5)
 * @returns CSS class for styling
 */
export function getFdrColorClass(fdr: number): string {
  if (fdr <= 1.5) {
    return 'bg-green-200 text-green-900' // Easy (green)
  } else if (fdr <= 2.5) {
    return 'bg-yellow-200 text-yellow-900' // Moderate-easy (yellow-green)
  } else if (fdr <= 3.5) {
    return 'bg-yellow-400 text-yellow-900' // Moderate (yellow)
  } else if (fdr <= 4.5) {
    return 'bg-orange-400 text-orange-900' // Difficult (orange)
  }

  return 'bg-red-500 text-white' // Very difficult (red)
}

/**
 * Returns the display text for an FDR badge (e.g., "5.0" or "4.5")
 * @param fdr - FDR score (1–5)
 * @returns Formatted string
 */
export function formatFdr(fdr: number): string {
  return fdr.toFixed(1).endsWith('0') ? `${Math.round(fdr)}` : `${fdr.toFixed(1)}`
}
