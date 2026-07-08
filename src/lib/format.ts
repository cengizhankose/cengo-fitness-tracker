import type { Range } from '@/types/plan'

/** "200–220 g" or "10000+" */
export function formatRange(r: Range, unit = ''): string {
  const suffix = unit ? ` ${unit}` : ''
  if (r.min === r.max) return `${r.min}${suffix}`
  return `${r.min}–${r.max}${suffix}`
}

export function formatMinPlus(min: number, unit = ''): string {
  const suffix = unit ? ` ${unit}` : ''
  return `${min.toLocaleString()}+${suffix}`
}

/** seconds -> "mm:ss" (run time) */
export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Parse "mm:ss" -> seconds (for the 5K benchmark input). Returns NaN if malformed. */
export function parseDurationToSec(v: string): number {
  const m = v.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/** Pace from distance + duration: "5:45/km" */
export function pace(distanceKm: number, durationMin: number): string {
  if (!distanceKm || !durationMin) return '—'
  const secPerKm = (durationMin * 60) / distanceKm
  return `${formatDuration(secPerKm)}/km`
}

export function kg(n: number | undefined): string {
  return n == null ? '—' : `${n} kg`
}
