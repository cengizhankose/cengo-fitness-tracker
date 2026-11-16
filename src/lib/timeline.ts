// Day-by-day history feed (Geçmiş): strength, Garmin activities, manual runs and weigh-ins.

import { groupStrengthByDay, type ExerciseDay } from '@/lib/exerciseStats'
import { isRunActivity, manualRuns } from '@/lib/activities'
import type { Activity } from '@/types/activities'
import type { CheckIn, IsoDate, RunLogEntry, StrengthLogEntry } from '@/types/userData'

/** One day of the history feed. */
export interface TimelineDay {
  date: IsoDate
  /** Per canonical exercise, in the order first logged; sets carry entry ids for edit/delete. */
  strength: ExerciseDay[]
  /** Garmin activities of the date, newest first. */
  activities: Activity[]
  /** Manual runs only — `garmin-` mirrors are dropped in favour of the Garmin activity. */
  runs: RunLogEntry[]
  /** The day's weigh-in/measurement record, if any. */
  checkIn?: CheckIn
}

/** Raw store slices the timeline is built from (`activities` = Object.values of the store). */
export interface TimelineInput {
  strengthLog: readonly StrengthLogEntry[]
  runLog: readonly RunLogEntry[]
  activities: readonly Activity[]
  checkIns: Readonly<Record<IsoDate, CheckIn>>
}

/** Every day with something logged, newest first. */
export function buildTimeline({ strengthLog, runLog, activities, checkIns }: TimelineInput): TimelineDay[] {
  const days = new Map<IsoDate, TimelineDay>()
  const dayFor = (date: IsoDate): TimelineDay => {
    let day = days.get(date)
    if (!day) {
      day = { date, strength: [], activities: [], runs: [] }
      days.set(date, day)
    }
    return day
  }

  for (const exerciseDay of groupStrengthByDay(strengthLog)) dayFor(exerciseDay.date).strength.push(exerciseDay)
  for (const activity of activities) dayFor(activity.date).activities.push(activity)
  for (const run of manualRuns(runLog)) dayFor(run.date).runs.push(run)
  for (const checkIn of Object.values(checkIns)) dayFor(checkIn.date).checkIn = checkIn

  for (const day of days.values()) {
    day.activities.sort((a, b) => b.startTimeLocal.localeCompare(a.startTimeLocal))
    day.runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** History filter chip kinds. */
export type TimelineFilter = 'all' | 'strength' | 'run' | 'other'

/** Turkish filter chip labels. */
export const TIMELINE_FILTER_LABEL: Record<TimelineFilter, string> = {
  all: 'Tümü',
  strength: 'Ağırlık',
  run: 'Koşu',
  other: 'Diğer',
}

/**
 * Narrow a timeline to one kind; days left empty are dropped.
 * - strength: gym logs + Garmin strength activities
 * - run: running-type Garmin activities + manual runs
 * - other: every other Garmin activity (swims, walks, football…)
 * Weigh-ins only show under 'all'.
 */
export function filterTimeline(days: readonly TimelineDay[], filter: TimelineFilter): TimelineDay[] {
  if (filter === 'all') return [...days]
  const out: TimelineDay[] = []
  for (const day of days) {
    const narrowed: TimelineDay = {
      date: day.date,
      strength: filter === 'strength' ? day.strength : [],
      activities: day.activities.filter((a) =>
        filter === 'run'
          ? isRunActivity(a)
          : filter === 'strength'
            ? a.sportGroup === 'strength'
            : !isRunActivity(a) && a.sportGroup !== 'strength',
      ),
      runs: filter === 'run' ? day.runs : [],
    }
    if (narrowed.strength.length || narrowed.activities.length || narrowed.runs.length) out.push(narrowed)
  }
  return out
}
