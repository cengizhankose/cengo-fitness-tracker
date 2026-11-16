// Body-weight stats from per-day weigh-ins (CheckIn.date is any calendar day).

import { diffDays, mondayOf, toLocalISODate } from '@/lib/dates'
import { PLAN_START_DATE } from '@/lib/plan'
import type { Goal } from '@/types/plan'
import type { CheckIn, IsoDate } from '@/types/userData'

const round1 = (n: number) => Math.round(n * 10) / 10

/** One dated measurement. */
export interface MetricPoint {
  date: IsoDate
  value: number
}

/** Numeric CheckIn fields that can be charted. */
export type MeasurementKey = 'weightKg' | 'waistCm' | 'chestCm' | 'hipCm'

/** One point per day that has the measurement, oldest first. */
export function metricSeries(checkIns: Readonly<Record<IsoDate, CheckIn>>, key: MeasurementKey): MetricPoint[] {
  const points: MetricPoint[] = []
  for (const c of Object.values(checkIns)) {
    const value = c[key]
    if (value != null && Number.isFinite(value)) points.push({ date: c.date, value })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** Per-day weigh-ins, oldest first. */
export function weightSeries(checkIns: Readonly<Record<IsoDate, CheckIn>>): MetricPoint[] {
  return metricSeries(checkIns, 'weightKg')
}

/** Mean weight of one Monday–Sunday week. */
export interface WeeklyAverage {
  /** Monday of the week. */
  weekStart: IsoDate
  /** Mean of the week's weigh-ins, rounded to 0.1 kg. */
  avgKg: number
  count: number
}

/** Monday-keyed weekly mean weight with the number of weigh-ins, oldest week first. */
export function weeklyAverages(checkIns: Readonly<Record<IsoDate, CheckIn>>): WeeklyAverage[] {
  const buckets = new Map<IsoDate, { sum: number; count: number }>()
  for (const { date, value } of weightSeries(checkIns)) {
    const wk = mondayOf(date)
    const b = buckets.get(wk) ?? { sum: 0, count: 0 }
    b.sum += value
    b.count += 1
    buckets.set(wk, b)
  }
  return [...buckets]
    .map(([weekStart, { sum, count }]) => ({ weekStart, avgKg: round1(sum / count), count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/** Most recent weigh-in. */
export function latestWeight(checkIns: Readonly<Record<IsoDate, CheckIn>>): MetricPoint | undefined {
  return weightSeries(checkIns).at(-1)
}

/**
 * Change between the last two weeks that have weigh-ins (negative = lost), from the
 * rounded averages the user sees. Undefined with fewer than two such weeks.
 */
export function weeklyChangeKg(checkIns: Readonly<Record<IsoDate, CheckIn>>): number | undefined {
  const weeks = weeklyAverages(checkIns)
  const last = weeks.at(-1)
  const prev = weeks.at(-2)
  if (!last || !prev) return undefined
  return round1(last.avgKg - prev.avgKg)
}

/** Progress toward the plan's first weight milestone. */
export interface GoalProgress {
  startKg: number
  /** Latest weekly average (smooths daily water swings); undefined before any weigh-in. */
  currentKg?: number
  /** start − current (negative = gained). */
  lostKg?: number
  /** Distance to the top of the milestone band, 0 once inside/below it. */
  toMilestoneKg?: number
  milestoneReached: boolean
  /** 0..1 of the way from start to the top of the milestone band. */
  fraction: number
  /** Whole weeks since plan start (0 in week 1). */
  weeksElapsed: number
  /** weeksElapsed × kgPerWeek. */
  expectedLostKg: number
  /** lostKg ≥ expectedLostKg; undefined before any weigh-in. */
  onTrack?: boolean
}

/** Progress toward the plan's first milestone, measured against the expected weekly rate. */
export function goalProgress(
  goal: Goal,
  checkIns: Readonly<Record<IsoDate, CheckIn>>,
  today: IsoDate = toLocalISODate(),
): GoalProgress {
  const weeksElapsed = Math.max(0, Math.floor(diffDays(today, PLAN_START_DATE) / 7))
  const expectedLostKg = round1(weeksElapsed * goal.kgPerWeek)
  const currentKg = weeklyAverages(checkIns).at(-1)?.avgKg
  if (currentKg == null) {
    return { startKg: goal.startKg, milestoneReached: false, fraction: 0, weeksElapsed, expectedLostKg }
  }
  const lostKg = round1(goal.startKg - currentKg)
  const toMilestoneKg = round1(Math.max(0, currentKg - goal.milestoneKg.max))
  const span = goal.startKg - goal.milestoneKg.max
  return {
    startKg: goal.startKg,
    currentKg,
    lostKg,
    toMilestoneKg,
    milestoneReached: toMilestoneKg === 0,
    fraction: span > 0 ? Math.min(Math.max(lostKg / span, 0), 1) : 0,
    weeksElapsed,
    expectedLostKg,
    onTrack: lostKg >= expectedLostKg,
  }
}

// ---- weight chart framing ----

/** Start line + target band the weight chart draws. */
export interface WeightBand {
  start: number
  targetLow: number
  targetHigh: number
}

/** The plan goal as a chart band (start weight + milestone band). */
export function weightBand(goal: Goal): WeightBand {
  return { start: goal.startKg, targetLow: goal.milestoneKg.min, targetHigh: goal.milestoneKg.max }
}

const WEIGHT_DOMAIN_PAD = 1
const WEIGHT_DOMAIN_MIN_SPAN = 4
const WEIGHT_DOMAIN_MAX_SPAN = 16
const START_SPAN_RATIO = 2

/** False for a degenerate band (equal or non-finite bounds), which has nothing to draw. */
export function hasWeightBand(band: WeightBand): boolean {
  return (
    Number.isFinite(band.targetLow) &&
    Number.isFinite(band.targetHigh) &&
    band.targetLow !== band.targetHigh
  )
}

/**
 * Y-axis domain for the weight chart. Always contains every finite data point AND the whole
 * target band, so the chart can't discard the band as out-of-range. `band.start` joins only
 * when it doesn't flatten the series (it falls outside the rest only once you're at goal).
 */
export function weightChartDomain(data: MetricPoint[], band?: WeightBand): [number, number] {
  let lo = Infinity
  let hi = -Infinity

  for (const point of data) {
    if (!Number.isFinite(point.value)) continue
    if (point.value < lo) lo = point.value
    if (point.value > hi) hi = point.value
  }
  if (band && hasWeightBand(band)) {
    lo = Math.min(lo, band.targetLow, band.targetHigh)
    hi = Math.max(hi, band.targetLow, band.targetHigh)
  }
  if (lo > hi) {
    // No data and no drawable band: anchor on the start weight, else a safe range.
    if (!band || !Number.isFinite(band.start)) return [0, WEIGHT_DOMAIN_MIN_SPAN]
    lo = band.start
    hi = band.start
  }

  if (band && Number.isFinite(band.start)) {
    const coreSpan = hi - lo
    const withLo = Math.min(lo, band.start)
    const withHi = Math.max(hi, band.start)
    const withSpan = withHi - withLo
    if (
      withSpan <= WEIGHT_DOMAIN_MAX_SPAN &&
      withSpan <= Math.max(coreSpan, WEIGHT_DOMAIN_MIN_SPAN) * START_SPAN_RATIO
    ) {
      lo = withLo
      hi = withHi
    }
  }

  // Order matters: pad → round → widen to the min span in whole units.
  lo = Math.floor(lo - WEIGHT_DOMAIN_PAD)
  hi = Math.ceil(hi + WEIGHT_DOMAIN_PAD)
  const shortfall = WEIGHT_DOMAIN_MIN_SPAN - (hi - lo)
  if (shortfall > 0) {
    lo -= Math.ceil(shortfall / 2)
    hi += Math.floor(shortfall / 2)
  }
  return [lo, hi]
}
