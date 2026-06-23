export function truncateDecimals(val: number) {
  return Math.trunc(val * 100) / 100
}

export function toPercentage(val: number) {
  return `${Math.trunc(val * 10000) / 100}%`
}
