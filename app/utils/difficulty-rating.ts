import type { SeasonTableData } from '@/types'

export function getDifficultyRating(opponentPosition: number, venue: string): number {
  let fdr: number

  if (opponentPosition <= 4) {
    fdr = 5
  } else if (opponentPosition <= 8) {
    fdr = 4
  } else if (opponentPosition <= 12) {
    fdr = 3
  } else if (opponentPosition <= 16) {
    fdr = 2
  } else {
    fdr = 1
  }

  // Away matches are slightly easier (add 0.5 to FDR)
  if (venue === 'away') {
    fdr += 0.5
  }

  // Clamp to 1–5 range
  return Math.min(5, Math.max(1, fdr))
}

export function getTeamLeaguePosition(teamName: string, table: SeasonTableData[]): number | undefined {
  const index = table.findIndex((entry) => entry.name === teamName)
  return index >= 0 ? index + 1 : undefined
}

export function getFdrColorClass(fdr: number): string {
  const roundedFdr = Math.round(fdr * 2) / 2 // Round to nearest 0.5

  if (roundedFdr <= 1.5) {
    return 'bg-green-200 text-green-900' // Easy (green)
  } else if (roundedFdr <= 2.5) {
    return 'bg-yellow-200 text-yellow-900' // Moderate-easy (yellow-green)
  } else if (roundedFdr <= 3.5) {
    return 'bg-yellow-400 text-yellow-900' // Moderate (yellow)
  } else if (roundedFdr <= 4.5) {
    return 'bg-orange-400 text-orange-900' // Difficult (orange)
  } else {
    return 'bg-red-500 text-white' // Very difficult (red)
  }
}

export function formatFdr(fdr: number): string {
  return fdr % 1 === 0 ? `${Math.round(fdr)}` : `${fdr.toFixed(1)}`
}
