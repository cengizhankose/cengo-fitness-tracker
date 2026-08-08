import type {
  TrainingPlan,
  ScheduleDay,
  DayName,
  RunDay,
  StretchingRoutine,
  ChecklistKey,
} from '@/types/plan'
import type {
  DailyChecklistRecord,
  RunLogEntry,
  StrengthLogEntry,
  CheckIn,
  IsoDate,
} from '@/types/userData'
import { toLocalISODate, addDays, diffDays, mondayOf } from '@/lib/dates'

const JS_DAY_TO_NAME: Record<number, DayName> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

export function dayNameForDate(date: Date = new Date()): DayName {
  return JS_DAY_TO_NAME[date.getDay()] ?? 'Monday'
}

/** Today's (or any date's) scheduled task, matched by weekday name. */
export function scheduleForDate(plan: TrainingPlan, date: Date = new Date()): ScheduleDay {
  const name = dayNameForDate(date)
  return scheduleForDay(plan, name)
}

export function scheduleForDay(plan: TrainingPlan, name: DayName): ScheduleDay {
  const day = plan.weeklySchedule.find((d) => d.day === name)
  if (!day) throw new Error(`No schedule entry for ${name}`)
  return day
}

// ---- Marathon program week ----

export interface ProgramWeek {
  index: number // 0-based
  weekNumber: number // 1..12 for UI
  totalWeeks: number
  isComplete: boolean // past the final week
}

export function sundayLongRun(plan: TrainingPlan): RunDay | undefined {
  return plan.weeklySchedule.find(
    (d): d is RunDay => d.type === 'run' && Array.isArray(d.progressionKmByWeek),
  )
}

export function programWeek(
  plan: TrainingPlan,
  startDate: IsoDate,
  today: IsoDate = toLocalISODate(),
): ProgramWeek {
  const total = sundayLongRun(plan)?.progressionKmByWeek?.length ?? 12
  const raw = Math.floor(diffDays(today, startDate) / 7)
  const index = Math.min(Math.max(raw, 0), total - 1)
  return { index, weekNumber: index + 1, totalWeeks: total, isComplete: raw >= total }
}

export function longRunKmForDate(
  plan: TrainingPlan,
  startDate: IsoDate,
  today?: IsoDate,
): number | undefined {
  const weeks = sundayLongRun(plan)?.progressionKmByWeek
  if (!weeks) return undefined
  const { index } = programWeek(plan, startDate, today)
  return weeks[index]
}

// ---- Streaks ----

export interface StreakResult {
  current: number
  best: number
}

/**
 * Streak = consecutive days with checklist.completedWorkout === true.
 * `current` counts back from today, or from yesterday if today isn't logged yet
 * (so an unlogged today doesn't break the streak until tomorrow).
 */
export function workoutStreak(
  checklist: Record<IsoDate, DailyChecklistRecord>,
  today: IsoDate = toLocalISODate(),
): StreakResult {
  const counted = (d: IsoDate) => checklist[d]?.items.completedWorkout === true

  // best
  const dates = Object.keys(checklist).filter(counted).sort()
  let best = 0
  let run = 0
  let prev: IsoDate | null = null
  for (const d of dates) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }

  // current
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

/** Count of days where every applicable checklist key (all 8) is true. */
export function perfectDays(
  plan: TrainingPlan,
  checklist: Record<IsoDate, DailyChecklistRecord>,
): number {
  const keys = plan.progressTracking.dailyChecklist
  return Object.values(checklist).filter((rec) => keys.every((k) => rec.items[k] === true)).length
}

// ---- Checklist applicability ----

/** Friday football has no stretching routine -> exclude that item from the day. */
export function applicableChecklistKeys(plan: TrainingPlan, day: ScheduleDay): ChecklistKey[] {
  const all = plan.progressTracking.dailyChecklist
  if (day.type === 'football') return all.filter((k) => k !== 'completedStretching')
  return all
}

export function checklistRatio(
  record: DailyChecklistRecord | undefined,
  keys: ChecklistKey[],
): { done: number; total: number } {
  const total = keys.length
  if (!record) return { done: 0, total }
  const done = keys.filter((k) => record.items[k] === true).length
  return { done, total }
}

/** Workouts completed this week / total scheduled days (7). */
export function weeklyCompletion(
  plan: TrainingPlan,
  checklist: Record<IsoDate, DailyChecklistRecord>,
  today: IsoDate = toLocalISODate(),
): { done: number; total: number } {
  const weekStart = mondayOf(today)
  const total = plan.weeklySchedule.length
  let done = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    if (checklist[d]?.items.completedWorkout === true) done++
  }
  return { done, total }
}

// ---- Chart aggregations ----

export interface WeeklyAgg {
  weekStart: IsoDate
  value: number
}

const byWeek = (a: WeeklyAgg, b: WeeklyAgg) => a.weekStart.localeCompare(b.weekStart)

export function workoutsPerWeek(
  checklist: Record<IsoDate, DailyChecklistRecord>,
): WeeklyAgg[] {
  const buckets = new Map<IsoDate, number>()
  for (const [date, rec] of Object.entries(checklist)) {
    if (rec.items.completedWorkout !== true) continue
    const wk = mondayOf(date)
    buckets.set(wk, (buckets.get(wk) ?? 0) + 1)
  }
  return [...buckets].map(([weekStart, value]) => ({ weekStart, value })).sort(byWeek)
}

export function runningKmPerWeek(runLog: RunLogEntry[]): WeeklyAgg[] {
  const buckets = new Map<IsoDate, number>()
  for (const r of runLog) {
    const wk = mondayOf(r.date)
    buckets.set(wk, (buckets.get(wk) ?? 0) + r.distanceKm)
  }
  return [...buckets]
    .map(([weekStart, value]) => ({ weekStart, value: Math.round(value * 10) / 10 }))
    .sort(byWeek)
}

export interface MetricPoint {
  date: IsoDate
  value: number
}

export function metricSeries(
  checkIns: Record<IsoDate, CheckIn>,
  key: 'weightKg' | 'waistCm' | 'chestCm' | 'hipCm',
): MetricPoint[] {
  return Object.values(checkIns)
    .filter((c) => c[key] != null)
    .map((c) => ({ date: c.date, value: c[key] as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---- Routine resolvers ----

export function stretchingRoutineById(
  plan: TrainingPlan,
  id: string,
): StretchingRoutine | undefined {
  return plan.mobility.stretchingRoutines.find((r) => r.id === id)
}

export function postWorkoutStretchFor(
  plan: TrainingPlan,
  day: ScheduleDay,
): StretchingRoutine | undefined {
  if ('postWorkoutStretchingId' in day && day.postWorkoutStretchingId) {
    return stretchingRoutineById(plan, day.postWorkoutStretchingId)
  }
  return undefined
}

// ---- Strength log helpers ----

/** Last logged top-set weight for an exercise (prefill after-workout forms). */
export function lastWeightForExercise(
  strengthLog: StrengthLogEntry[],
  exerciseName: string,
): number | undefined {
  const entries = strengthLog
    .filter((e) => e.exerciseName === exerciseName)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const top = entries[0]?.sets.reduce<number | undefined>(
    (max, s) => (max == null || s.weightKg > max ? s.weightKg : max),
    undefined,
  )
  return top
}

/** Exercise names already logged on `date` — drives the Today workout summary counter. */
export function loggedExerciseNamesToday(
  strengthLog: StrengthLogEntry[],
  date: IsoDate = toLocalISODate(),
): Set<string> {
  return new Set(strengthLog.filter((e) => e.date === date).map((e) => e.exerciseName))
}

// ---- Weight goal ----

export interface WeightGoal {
  start: number
  targetLow: number
  targetHigh: number
}

/** Parse a goal string like "92kg -> 82-84kg" -> structured goal (JSON-driven, not hardcoded). */
export function parseWeightGoal(plan: TrainingPlan): WeightGoal | undefined {
  for (const g of plan.meta.primaryGoals) {
    const m = g.match(/(\d+(?:\.\d+)?)\s*kg\s*->\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*kg/i)
    if (m && m[1] && m[2] && m[3]) {
      return { start: Number(m[1]), targetLow: Number(m[2]), targetHigh: Number(m[3]) }
    }
  }
  const start = plan.meta.profileAssumptions.startWeightKg
  return start ? { start, targetLow: start, targetHigh: start } : undefined
}

/** 0..1 progress from start weight toward the (high end of the) target band. */
export function weightGoalProgress(goal: WeightGoal, current: number): number {
  const span = goal.start - goal.targetHigh
  if (span <= 0) return 0
  return Math.min(Math.max((goal.start - current) / span, 0), 1)
}

const WEIGHT_DOMAIN_PAD = 1
const WEIGHT_DOMAIN_MIN_SPAN = 4
const WEIGHT_DOMAIN_MAX_SPAN = 16
const START_SPAN_RATIO = 2

/** False for the degenerate `start === target` fallback goal, which has no drawable band. */
export function hasWeightBand(goal: WeightGoal): boolean {
  return (
    Number.isFinite(goal.targetLow) &&
    Number.isFinite(goal.targetHigh) &&
    goal.targetLow !== goal.targetHigh
  )
}

/**
 * Y-axis domain for the weight chart. Always contains every finite data point AND the whole
 * target band, so recharts can't discard the band as out-of-range. `goal.start` joins only
 * when it doesn't flatten the series (it falls outside the rest only once you're at goal).
 */
export function weightChartDomain(data: MetricPoint[], goal?: WeightGoal): [number, number] {
  let lo = Infinity
  let hi = -Infinity

  for (const point of data) {
    if (!Number.isFinite(point.value)) continue
    if (point.value < lo) lo = point.value
    if (point.value > hi) hi = point.value
  }
  // Same predicate the chart uses, so we never reserve space for a band that isn't drawn.
  if (goal && hasWeightBand(goal)) {
    lo = Math.min(lo, goal.targetLow, goal.targetHigh)
    hi = Math.max(hi, goal.targetLow, goal.targetHigh)
  }
  if (lo > hi) {
    // No data and no drawable band: anchor on the start weight, else give up on a safe range.
    if (!goal || !Number.isFinite(goal.start)) return [0, WEIGHT_DOMAIN_MIN_SPAN]
    lo = goal.start
    hi = goal.start
  }

  if (goal && Number.isFinite(goal.start)) {
    const coreSpan = hi - lo
    const withLo = Math.min(lo, goal.start)
    const withHi = Math.max(hi, goal.start)
    const withSpan = withHi - withLo
    if (
      withSpan <= WEIGHT_DOMAIN_MAX_SPAN &&
      withSpan <= Math.max(coreSpan, WEIGHT_DOMAIN_MIN_SPAN) * START_SPAN_RATIO
    ) {
      lo = withLo
      hi = withHi
    }
  }

  // Order matters: pad -> round -> widen to the min span in whole units. Rounding last
  // would inflate a fractional min-span expansion by up to another kg.
  lo = Math.floor(lo - WEIGHT_DOMAIN_PAD)
  hi = Math.ceil(hi + WEIGHT_DOMAIN_PAD)
  const shortfall = WEIGHT_DOMAIN_MIN_SPAN - (hi - lo)
  if (shortfall > 0) {
    lo -= Math.ceil(shortfall / 2)
    hi += Math.floor(shortfall / 2)
  }
  return [lo, hi]
}
