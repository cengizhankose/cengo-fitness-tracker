import { toLocalISODate, mondayOf } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import type { Activity } from '@/types/activities'
import type { IsoDate, RunLogEntry } from '@/types/userData'

/** Recency bucket of an activity list. */
export type RecencyGroup = 'today' | 'thisWeek' | 'older'

/** Turkish recency bucket headings. */
export const RECENCY_GROUP_LABEL: Record<RecencyGroup, string> = {
  today: 'Bugün',
  thisWeek: 'Bu Hafta',
  older: 'Daha Eski',
}

/** Buckets activities into today / this week (Monday-anchored, excluding today) / older,
 *  each newest-first. */
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

/** Running-type Garmin activity (outdoor, treadmill, track). */
export function isRunActivity(activity: Activity): boolean {
  return activity.sportGroup === 'run'
}

/**
 * Manual run entries that are not mirrors of a Garmin activity. `runLog` ids starting with
 * `garmin-` were copied from Garmin (with a wrong `averagePace`); the activity is the source
 * of truth, so those entries are never shown or counted.
 */
export function manualRuns(runLog: readonly RunLogEntry[]): RunLogEntry[] {
  return runLog.filter((r) => !r.id.startsWith('garmin-'))
}

/** "32 dk" under an hour, "1 sa 12 dk" at or above. */
export function formatActivityDuration(min: number): string {
  const totalMin = Math.round(min)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`
}

/** "6,4 km" — distanceKm already carries the Garmin metres→km conversion. */
export function formatActivityDistance(km: number): string {
  return `${formatNumber(km, 2)} km`
}
