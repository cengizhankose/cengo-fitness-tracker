import type { ExerciseUnit, Range } from '@/types/plan'

/** tr-TR number: decimal comma, dot thousands ("82,5", "8.000"); at most `maxFraction` decimals. */
export function formatNumber(n: number, maxFraction = 1): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: maxFraction })
}

/** "200–220 g", or "300 g" when min === max. */
export function formatRange(r: Range, unit = ''): string {
  const suffix = unit ? ` ${unit}` : ''
  if (r.min === r.max) return `${formatNumber(r.min)}${suffix}`
  return `${formatNumber(r.min)}–${formatNumber(r.max)}${suffix}`
}

/** "8.000+" / "8.000+ adım". */
export function formatMinPlus(min: number, unit = ''): string {
  const suffix = unit ? ` ${unit}` : ''
  return `${formatNumber(min)}+${suffix}`
}

/** seconds → "mm:ss" (run time, pace). */
export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Pace from distance + duration: "5:45/km"; "—" when either is missing. */
export function pace(distanceKm: number, durationMin: number): string {
  if (!distanceKm || !durationMin) return '—'
  const secPerKm = (durationMin * 60) / distanceKm
  return `${formatDuration(secPerKm)}/km`
}

/** "82,5 kg"; "—" when unknown. */
export function kg(n: number | undefined): string {
  return n == null ? '—' : `${formatNumber(n, 2)} kg`
}

/**
 * One set, respecting the exercise unit:
 * kg → "80 kg × 5" · bodyweight → "5 tekrar" or "+10 kg × 5" with added load ·
 * seconds → "45 sn" (`reps` holds seconds).
 */
export function formatSet(set: { weightKg: number; reps: number }, unit: ExerciseUnit = 'kg'): string {
  switch (unit) {
    case 'seconds':
      return `${set.reps} sn`
    case 'bodyweight':
      return set.weightKg > 0 ? `+${kg(set.weightKg)} × ${set.reps}` : `${set.reps} tekrar`
    case 'kg':
      return `${kg(set.weightKg)} × ${set.reps}`
  }
}

/** Plan prescription: "1 × 5", "1 × max", "2 × 45 sn". */
export function formatSetsReps(sets: number, reps: number | 'max', unit: ExerciseUnit): string {
  const target = unit === 'seconds' && reps !== 'max' ? `${reps} sn` : String(reps)
  return `${sets} × ${target}`
}
