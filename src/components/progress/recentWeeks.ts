import { addDays, mondayOf } from '@/lib/dates'
import type { WeeklyAgg } from '@/lib/week'
import type { IsoDate } from '@/types/userData'

/** Weeks a weekly bar chart shows at most. */
export const CHART_WEEKS = 12

/**
 * Chart window for a weekly series: from its first week (at most `weeks` back) through the
 * current week, with weeks that have nothing logged as 0 so gaps in consistency stay visible.
 */
export function recentWeeks(series: readonly WeeklyAgg[], today: IsoDate, weeks = CHART_WEEKS): WeeklyAgg[] {
  const first = series[0]
  if (!first) return []
  const current = mondayOf(today)
  const earliest = addDays(current, -7 * (weeks - 1))
  const byWeek = new Map(series.map((w) => [w.weekStart, w.value]))
  const out: WeeklyAgg[] = []
  for (let wk = first.weekStart > earliest ? first.weekStart : earliest; wk <= current; wk = addDays(wk, 7)) {
    out.push({ weekStart: wk, value: byWeek.get(wk) ?? 0 })
  }
  return out
}
