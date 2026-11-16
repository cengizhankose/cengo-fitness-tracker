import { parseLocalISODate } from '@/lib/dates'
import { formatSet } from '@/lib/format'
import type { ExerciseUnit } from '@/types/plan'
import type { IsoDate, StrengthSet } from '@/types/userData'

const MONTH_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const

/** "Kasım 2026" — month heading of the history feed. */
export function formatMonthYear(date: IsoDate): string {
  const d = parseLocalISODate(date)
  return `${MONTH_TR[d.getMonth()]} ${d.getFullYear()}`
}

/** Error shown when a set in a history form can't be logged yet (see `toStrengthSet`). */
export const MISSING_SET_MESSAGE: Record<ExerciseUnit, string> = {
  kg: 'Her sete ağırlık ve tekrar gir.',
  bodyweight: 'Her sete tekrar gir.',
  seconds: 'Her sete süre gir.',
}

/**
 * Sets of one exercise-day as one line: "40 kg × 10, 40 kg × 12 · RPE 7". A shared RPE is
 * shown once at the end; when the sets differ, each set carries its own ("… × 7 (RPE 8)").
 */
export function formatSetList(sets: readonly StrengthSet[], unit: ExerciseUnit): string {
  if (sets.length === 0) return ''
  const rpes = new Set(sets.map((s) => s.rpe))
  const shared = rpes.size === 1 ? sets[0]?.rpe : undefined
  const perSet = rpes.size > 1
  const list = sets
    .map((s) => {
      const text = formatSet(s, unit)
      return perSet && s.rpe != null ? `${text} (RPE ${s.rpe})` : text
    })
    .join(', ')
  return shared != null ? `${list} · RPE ${shared}` : list
}
