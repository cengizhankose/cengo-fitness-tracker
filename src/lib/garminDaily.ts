import { addDays } from '@/lib/dates'
import type { GarminDaily } from '@/types/garminDaily'
import type { IsoDate } from '@/types/userData'

/** Daily values the Toparlanma card shows, each with a 7-day average. */
export type RecoveryMetric = 'sleepMin' | 'hrvNightAvg' | 'restingHr' | 'steps'

/** Every recovery metric, in card order. */
export const RECOVERY_METRICS: readonly RecoveryMetric[] = ['sleepMin', 'hrvNightAvg', 'restingHr', 'steps']

/** Change between two 7-day averages below which the direction counts as unchanged. */
const FLAT_WITHIN: Record<RecoveryMetric, number> = {
  sleepMin: 10,
  hrvNightAvg: 2,
  restingHr: 1,
  steps: 500,
}

/** Direction of one 7-day average against the 7 days before it. */
export type WeekDirection = 'up' | 'flat' | 'down'

export interface WeekAverage {
  avg: number
  /** Absent when the 7 days before have no value to compare against. */
  direction?: WeekDirection
}

/** How many of the recorded nights started before the plan's bedtime grace limit. */
export interface BedtimeCount {
  onTime: number
  nights: number
}

export interface RecoverySummary {
  /** The most recent day with at least one recovery metric. */
  day: GarminDaily
  /** 7-day averages ending on `day.date`, only for metrics that have a value in that window. */
  week: Partial<Record<RecoveryMetric, WeekAverage>>
  /** Absent when no night up to `day.date` has a sleep start. */
  bedtime?: BedtimeCount
}

/** Latest wall-clock time, on the day the night ends, that still counts as in bed by 00:00. */
export const ASLEEP_BY = '00:30'

/** Number of recorded nights the bedtime count looks back over. */
export const BEDTIME_NIGHTS = 7

/** Garmin's HRV status labels in Turkish; anything else is shown as Garmin sent it. */
export const HRV_STATUS_TR: Readonly<Record<string, string>> = {
  BALANCED: 'Dengeli',
  UNBALANCED: 'Dengesiz',
  LOW: 'Düşük',
  POOR: 'Zayıf',
}

/** The most recent day carrying any recovery metric; undefined when there is none. */
export function latestRecoveryDay(days: readonly GarminDaily[]): GarminDaily | undefined {
  let latest: GarminDaily | undefined
  for (const day of days) {
    if (!RECOVERY_METRICS.some((m) => day[m] != null)) continue
    if (!latest || day.date > latest.date) latest = day
  }
  return latest
}

function average(days: readonly GarminDaily[], metric: RecoveryMetric, from: IsoDate, to: IsoDate): number | undefined {
  let sum = 0
  let count = 0
  for (const day of days) {
    const value = day[metric]
    if (value == null || day.date < from || day.date > to) continue
    sum += value
    count++
  }
  return count > 0 ? sum / count : undefined
}

/**
 * Average of `metric` over the 7 calendar days ending on `endDate` (days without a value are
 * skipped), and its direction against the 7 days before. Undefined when the window is empty.
 */
export function weekAverage(
  days: readonly GarminDaily[],
  metric: RecoveryMetric,
  endDate: IsoDate,
): WeekAverage | undefined {
  const avg = average(days, metric, addDays(endDate, -6), endDate)
  if (avg === undefined) return undefined
  const prev = average(days, metric, addDays(endDate, -13), addDays(endDate, -7))
  if (prev === undefined) return { avg }
  const diff = avg - prev
  return { avg, direction: Math.abs(diff) < FLAT_WITHIN[metric] ? 'flat' : diff > 0 ? 'up' : 'down' }
}

/**
 * Of the last 7 recorded nights ending on or before `endDate`, how many fell asleep before
 * 00:30 on the morning's date. A night is keyed by the day it ended, so a sleep start on the
 * evening before, or before 00:30 on that day, is on time; one at 01:10 is not.
 */
export function asleepByCount(days: readonly GarminDaily[], endDate: IsoDate): BedtimeCount | undefined {
  const nights = days
    .filter((d) => d.sleepStartLocal != null && d.date <= endDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, BEDTIME_NIGHTS)
  if (nights.length === 0) return undefined
  const onTime = nights.filter((d) => d.sleepStartLocal! < `${d.date}T${ASLEEP_BY}`).length
  return { onTime, nights: nights.length }
}

/** Everything the Toparlanma card shows; undefined when there is no Garmin data at all. */
export function recoverySummary(days: readonly GarminDaily[]): RecoverySummary | undefined {
  const day = latestRecoveryDay(days)
  if (!day) return undefined
  const week: RecoverySummary['week'] = {}
  for (const metric of RECOVERY_METRICS) {
    const avg = weekAverage(days, metric, day.date)
    if (avg) week[metric] = avg
  }
  return { day, week, bedtime: asleepByCount(days, day.date) }
}
