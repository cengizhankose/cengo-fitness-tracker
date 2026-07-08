import type { IsoDate } from '@/types/userData'

const MS_PER_DAY = 86_400_000

/** Local civil date 'YYYY-MM-DD' (NOT toISOString, which is UTC). */
export function toLocalISODate(d: Date = new Date()): IsoDate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocalISODate(s: IsoDate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1) // local midnight
}

export function addDays(s: IsoDate, n: number): IsoDate {
  const d = parseLocalISODate(s)
  d.setDate(d.getDate() + n)
  return toLocalISODate(d)
}

/** a - b in whole days. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((parseLocalISODate(a).getTime() - parseLocalISODate(b).getTime()) / MS_PER_DAY)
}

/** Monday-of-week for a date (used to key weekly check-ins / aggregations). */
export function mondayOf(s: IsoDate): IsoDate {
  const d = parseLocalISODate(s)
  const js = d.getDay() // Sun=0..Sat=6
  const delta = js === 0 ? -6 : 1 - js
  return addDays(s, delta)
}

/** Pretty short label e.g. "Mon 15 Jun". */
export function formatShortDate(s: IsoDate): string {
  return parseLocalISODate(s).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** "15 Jun" — compact axis / list label. */
export function formatDayMonth(s: IsoDate): string {
  return parseLocalISODate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
