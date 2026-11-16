import type { DayName } from '@/types/plan'
import type { IsoDate } from '@/types/userData'

const MS_PER_DAY = 86_400_000

/** Local civil date 'YYYY-MM-DD' (NOT toISOString, which is UTC). */
export function toLocalISODate(d: Date = new Date()): IsoDate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 'YYYY-MM-DD' → local midnight Date. */
export function parseLocalISODate(s: IsoDate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1) // local midnight
}

/** Calendar date `n` days after `s` (negative `n` goes back). */
export function addDays(s: IsoDate, n: number): IsoDate {
  const d = parseLocalISODate(s)
  d.setDate(d.getDate() + n)
  return toLocalISODate(d)
}

/** a - b in whole days. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((parseLocalISODate(a).getTime() - parseLocalISODate(b).getTime()) / MS_PER_DAY)
}

/** Monday-of-week for a date (keys every weekly aggregation). */
export function mondayOf(s: IsoDate): IsoDate {
  const d = parseLocalISODate(s)
  const js = d.getDay() // Sun=0..Sat=6
  const delta = js === 0 ? -6 : 1 - js
  return addDays(s, delta)
}

/** The seven dates Monday..Sunday of the week containing `s`. */
export function weekDates(s: IsoDate): IsoDate[] {
  const monday = mondayOf(s)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Weekdays Monday-first. */
export const DAY_NAMES: readonly DayName[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** Weekday of a calendar date. */
export function dayNameOf(s: IsoDate): DayName {
  const js = parseLocalISODate(s).getDay() // Sun=0..Sat=6
  return DAY_NAMES[(js + 6) % 7] ?? 'Monday'
}

/** Turkish weekday names. */
export const DAY_LABEL_TR: Record<DayName, string> = {
  Monday: 'Pazartesi',
  Tuesday: 'Salı',
  Wednesday: 'Çarşamba',
  Thursday: 'Perşembe',
  Friday: 'Cuma',
  Saturday: 'Cumartesi',
  Sunday: 'Pazar',
}

/** Turkish short weekday labels (tr-TR abbreviations). */
export const DAY_SHORT_TR: Record<DayName, string> = {
  Monday: 'Pzt',
  Tuesday: 'Sal',
  Wednesday: 'Çar',
  Thursday: 'Per',
  Friday: 'Cum',
  Saturday: 'Cmt',
  Sunday: 'Paz',
}

const MONTH_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const
const MONTH_SHORT_TR = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
] as const

// Built from fixed tables rather than Intl so the output never depends on the device's ICU data.

/** "Pzt 16 Kas" — list/card label. */
export function formatShortDate(s: IsoDate): string {
  const d = parseLocalISODate(s)
  return `${DAY_SHORT_TR[dayNameOf(s)]} ${d.getDate()} ${MONTH_SHORT_TR[d.getMonth()]}`
}

/** "16 Kas" — compact axis / list label. */
export function formatDayMonth(s: IsoDate): string {
  const d = parseLocalISODate(s)
  return `${d.getDate()} ${MONTH_SHORT_TR[d.getMonth()]}`
}

/** "16 Kasım Pazartesi" — screen header. */
export function formatLongDate(s: IsoDate): string {
  const d = parseLocalISODate(s)
  return `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${DAY_LABEL_TR[dayNameOf(s)]}`
}
