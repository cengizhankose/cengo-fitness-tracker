import planData from '@/data/plan.json'
import { dayNameOf, diffDays } from '@/lib/dates'
import type {
  DayBlock,
  DayName,
  PlanExercise,
  Range,
  Session,
  SessionId,
  TrainingPlan,
} from '@/types/plan'
import type { IsoDate } from '@/types/userData'

/**
 * The bundled plan (works offline). This cast is the ONE place we assert JSON ⟷ type
 * agreement; `plan.test.ts` checks the data's integrity.
 */
export const plan: TrainingPlan = planData as unknown as TrainingPlan

/** First day of plan week 1 (a Monday). */
export const PLAN_START_DATE: IsoDate = plan.startDate

/** Session by id, or undefined for an unknown id (e.g. 'free'). */
export function sessionById(id: string): Session | undefined {
  return plan.sessions.find((s) => s.id === id)
}

/** Every exercise of a session flattened in order (superset members in their listed order). */
export function sessionExercises(session: Session): PlanExercise[] {
  return session.items.flatMap((item) => (item.kind === 'single' ? [item.exercise] : item.exercises))
}

/** Planned blocks of a weekday, in the order they are done. */
export function blocksForDay(dayName: DayName): DayBlock[] {
  return plan.weeklyTemplate.find((d) => d.day === dayName)?.blocks ?? []
}

/** Planned blocks for a calendar date (by its weekday). */
export function blocksForDate(isoDate: IsoDate): DayBlock[] {
  return blocksForDay(dayNameOf(isoDate))
}

/**
 * The session the day suggests by default: its non-optional strength block. Undefined on
 * Saturday (optional alternatives only) and Sunday. Any session may still be started any day.
 */
export function defaultSessionForDate(isoDate: IsoDate): SessionId | undefined {
  for (const block of blocksForDate(isoDate)) {
    if (block.type === 'strength' && !block.optional) return block.sessionId
  }
  return undefined
}

/** 1-based plan week of a date, counted from PLAN_START_DATE; dates before the start ⇒ 1. */
export function planWeekNumber(isoDate: IsoDate): number {
  const days = diffDays(isoDate, PLAN_START_DATE)
  if (days < 0) return 1
  return Math.floor(days / 7) + 1
}

/**
 * Sunday long-run target for the plan week of `isoDate`: a single km number during the
 * progression (weeks 1–4), then the hold range.
 */
export function longRunTargetKm(isoDate: IsoDate): number | Range {
  const { kmByWeek, hold } = plan.longRun
  const km = kmByWeek[planWeekNumber(isoDate) - 1]
  return km ?? hold
}

/** Canonical exercise name: applies the plan's alias map (read time only; data is never rewritten). */
export function canonicalExerciseName(name: string): string {
  return plan.aliases[name] ?? name
}

const firstOccurrence = new Map<string, PlanExercise>()
for (const session of plan.sessions) {
  for (const ex of sessionExercises(session)) {
    if (!firstOccurrence.has(ex.name)) firstOccurrence.set(ex.name, ex)
  }
}

/**
 * First occurrence of an exercise in the plan (session order), for unit/step/region lookups.
 * Accepts aliased names. Undefined for exercises the plan doesn't contain.
 */
export function findPlanExercise(name: string): PlanExercise | undefined {
  return firstOccurrence.get(canonicalExerciseName(name))
}

const uniqueNames = [...firstOccurrence.keys()]

/** Unique exercise names of the plan, in plan order (session order, then item order). */
export function planExerciseNames(): string[] {
  return [...uniqueNames]
}

/** Number of non-optional strength blocks per week (5). */
export const PLANNED_STRENGTH_DAYS_PER_WEEK: number = plan.weeklyTemplate.reduce(
  (n, day) => n + day.blocks.filter((b) => b.type === 'strength' && !b.optional).length,
  0,
)
