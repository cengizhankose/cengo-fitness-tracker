import { toLocalISODate, mondayOf } from '@/lib/dates'
import type { Activity } from '@/types/activities'
import type { IsoDate } from '@/types/userData'

export type RecencyGroup = 'today' | 'thisWeek' | 'older'

export const RECENCY_GROUP_LABEL: Record<RecencyGroup, string> = {
  today: 'Bugün',
  thisWeek: 'Bu Hafta',
  older: 'Daha Eski',
}

/** Buckets activities into today / this week (Monday-anchored, excluding today) / older,
 *  each newest-first. Mirrors the app's existing Monday-week convention (see lib/dates.ts). */
export function groupByRecency(
  activities: readonly Activity[],
  today: IsoDate = toLocalISODate(),
): Record<RecencyGroup, Activity[]> {
  const weekStart = mondayOf(today)
  const groups: Record<RecencyGroup, Activity[]> = { today: [], thisWeek: [], older: [] }
  for (const activity of activities) {
    if (activity.date === today) groups.today.push(activity)
    else if (activity.date >= weekStart) groups.thisWeek.push(activity)
    else groups.older.push(activity)
  }
  for (const group of Object.values(groups)) {
    group.sort((a, b) => b.startTimeLocal.localeCompare(a.startTimeLocal))
  }
  return groups
}

/** "32 min" under an hour, "1h 12m" at or above. */
export function formatActivityDuration(min: number): string {
  const totalMin = Math.round(min)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

/** "6.4 km" — distanceKm already carries the Garmin metres->km conversion (see schema notes). */
export function formatActivityDistance(km: number): string {
  const rounded = Math.round(km * 100) / 100
  return `${rounded} km`
}
