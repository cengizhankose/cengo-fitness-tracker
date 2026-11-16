// Weekly views: the Monday–Sunday overview, weekly chart series and the workout streak.

import { addDays, dayNameOf, diffDays, mondayOf, toLocalISODate, weekDates } from '@/lib/dates'
import { isRunActivity, manualRuns } from '@/lib/activities'
import { setKind } from '@/lib/exerciseStats'
import {
  PLANNED_STRENGTH_DAYS_PER_WEEK,
  blocksForDay,
  longRunTargetKm,
  plan,
  planWeekNumber,
} from '@/lib/plan'
import type { Activity } from '@/types/activities'
import type { ChecklistKey, DayBlock, DayName, Range } from '@/types/plan'
import type { DailyChecklistRecord, IsoDate, RunLogEntry, StrengthLogEntry } from '@/types/userData'

const round1 = (n: number) => Math.round(n * 10) / 10

/** Dates with at least one working strength set. */
function strengthDates(strengthLog: readonly StrengthLogEntry[]): Set<IsoDate> {
  const dates = new Set<IsoDate>()
  for (const e of strengthLog) if (e.sets.some((s) => setKind(s) === 'working')) dates.add(e.date)
  return dates
}

/**
 * Every run as (date, km) with no double counting: running-type Garmin activities plus
 * manual runLog entries (the `garmin-` mirrors in runLog are dropped).
 */
function runDistances(
  runLog: readonly RunLogEntry[],
  activities: readonly Activity[],
): Array<{ date: IsoDate; km: number }> {
  return [
    ...activities.filter(isRunActivity).map((a) => ({ date: a.date, km: a.distanceKm ?? 0 })),
    ...manualRuns(runLog).map((r) => ({ date: r.date, km: r.distanceKm })),
  ]
}

/** One day of the week overview. */
export interface WeekDayOverview {
  date: IsoDate
  dayName: DayName
  blocks: DayBlock[]
  /** At least one working strength set logged. */
  strengthDone: boolean
  /** A running-type Garmin activity or a manual run exists. */
  runDone: boolean
  /** Any other non-strength Garmin activity (football, swim, walk…). */
  otherActivityDone: boolean
  /** Ticks of the three daily checklist keys (legacy keys ignored). */
  checklist: Record<ChecklistKey, boolean>
}

/** Monday–Sunday plan vs logged summary. */
export interface WeekOverview {
  weekStart: IsoDate
  weekEnd: IsoDate
  /** Plan week number (1-based). */
  planWeek: number
  /** Sunday long-run target of this week. */
  longRunTargetKm: number | Range
  days: WeekDayOverview[]
  strengthDays: { done: number; planned: number }
  /** Garmin running activities + manual runs, rounded to 0.1 km. */
  runKm: number
}

/** Raw store slices the overview reads (`activities` = Object.values of the store). */
export interface WeekInput {
  strengthLog: readonly StrengthLogEntry[]
  runLog: readonly RunLogEntry[]
  activities: readonly Activity[]
  checklist: Readonly<Record<IsoDate, DailyChecklistRecord>>
}

/** The Monday–Sunday week containing `isoDate`: plan vs what was logged, per day and in total. */
export function weekOverview(
  isoDate: IsoDate,
  { strengthLog, runLog, activities, checklist }: WeekInput,
): WeekOverview {
  const dates = weekDates(isoDate)
  const weekStart = dates[0]!
  const weekEnd = dates[6]!
  const inWeek = (d: IsoDate) => d >= weekStart && d <= weekEnd
  const lifted = strengthDates(strengthLog.filter((e) => inWeek(e.date)))
  const weekActivities = activities.filter((a) => inWeek(a.date))
  const runs = runDistances(
    runLog.filter((r) => inWeek(r.date)),
    weekActivities,
  )

  const days = dates.map((date): WeekDayOverview => {
    const dayName = dayNameOf(date)
    const items = checklist[date]?.items
    const ofDay = weekActivities.filter((a) => a.date === date)
    return {
      date,
      dayName,
      blocks: blocksForDay(dayName),
      strengthDone: lifted.has(date),
      runDone: runs.some((r) => r.date === date),
      otherActivityDone: ofDay.some((a) => !isRunActivity(a) && a.sportGroup !== 'strength'),
      checklist: Object.fromEntries(
        plan.dailyChecklist.map((key) => [key, items?.[key] === true]),
      ) as Record<ChecklistKey, boolean>,
    }
  })

  return {
    weekStart,
    weekEnd,
    planWeek: planWeekNumber(weekStart),
    longRunTargetKm: longRunTargetKm(weekStart),
    days,
    strengthDays: { done: lifted.size, planned: PLANNED_STRENGTH_DAYS_PER_WEEK },
    runKm: round1(runs.reduce((sum, r) => sum + r.km, 0)),
  }
}

/** One weekly chart bucket. */
export interface WeeklyAgg {
  /** Monday of the week. */
  weekStart: IsoDate
  value: number
}

/** Sum `value`s into Monday-keyed buckets, oldest week first. */
function bucketByWeek(points: Iterable<{ date: IsoDate; value: number }>): WeeklyAgg[] {
  const buckets = new Map<IsoDate, number>()
  for (const { date, value } of points) {
    const wk = mondayOf(date)
    buckets.set(wk, (buckets.get(wk) ?? 0) + value)
  }
  return [...buckets]
    .map(([weekStart, value]) => ({ weekStart, value: round1(value) }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/** Distinct days with a working strength set, per week (chart series). */
export function strengthDaysPerWeek(strengthLog: readonly StrengthLogEntry[]): WeeklyAgg[] {
  return bucketByWeek([...strengthDates(strengthLog)].map((date) => ({ date, value: 1 })))
}

/** Run km per week: Garmin running activities + manual runs, no double counting (chart series). */
export function runKmPerWeek(runLog: readonly RunLogEntry[], activities: readonly Activity[]): WeeklyAgg[] {
  return bucketByWeek(runDistances(runLog, activities).map((r) => ({ date: r.date, value: r.km })))
}

/** Current and best consecutive-day workout streaks. */
export interface StreakResult {
  current: number
  best: number
}

/**
 * Streak = consecutive days with checklist.completedWorkout === true.
 * `current` counts back from today, or from yesterday if today isn't ticked yet
 * (an unlogged today doesn't break the streak until tomorrow).
 */
export function workoutStreak(
  checklist: Readonly<Record<IsoDate, DailyChecklistRecord>>,
  today: IsoDate = toLocalISODate(),
): StreakResult {
  const counted = (d: IsoDate) => checklist[d]?.items.completedWorkout === true

  const dates = Object.keys(checklist).filter(counted).sort()
  let best = 0
  let run = 0
  let prev: IsoDate | null = null
  for (const d of dates) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }

  let cursor: IsoDate | null = counted(today)
    ? today
    : counted(addDays(today, -1))
      ? addDays(today, -1)
      : null
  let current = 0
  while (cursor && counted(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }

  return { current, best }
}
