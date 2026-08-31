import { diffDays, toLocalISODate } from '@/lib/dates'
import { pace as formatPace } from '@/lib/format'
import { allPlannedWorkouts } from './plan'
import type {
  MarathonPlan,
  MarathonWeek,
  MarathonSummary,
  MarathonStatusRecord,
  NutritionPhase,
  PlannedWorkout,
  WeekTotals,
  WorkoutActual,
} from '@/types/marathon'
import type { IsoDate, RunLogEntry } from '@/types/userData'

type StatusMap = Record<IsoDate, MarathonStatusRecord>

export function weekForDate(plan: MarathonPlan, date: IsoDate): MarathonWeek | undefined {
  return plan.weeks.find((w) => date >= w.startDate && date <= w.endDate)
}

export function plannedWorkoutFor(plan: MarathonPlan, date: IsoDate): PlannedWorkout | undefined {
  return weekForDate(plan, date)?.days.find((d) => d.date === date)
}

export type PlanPhase = 'pre-plan' | 'in-plan' | 'post-race'

export function planPhase(plan: MarathonPlan, today: IsoDate = toLocalISODate()): PlanPhase {
  if (today < plan.meta.startDate) return 'pre-plan'
  if (today > plan.meta.raceDate) return 'post-race'
  return 'in-plan'
}

export function raceCountdownDays(plan: MarathonPlan, today: IsoDate = toLocalISODate()): number {
  return Math.max(0, diffDays(plan.meta.raceDate, today))
}

/** The single largest scheduled LONG_RUN (RACE excluded — it isn't a training long run). */
export function peakLongRun(plan: MarathonPlan): PlannedWorkout {
  const longRuns = allPlannedWorkouts(plan).filter((w) => w.workoutType === 'LONG_RUN')
  return longRuns.reduce((best, w) =>
    (w.targetDistanceKm ?? 0) > (best.targetDistanceKm ?? 0) ? w : best,
  )
}

export function sundayLongRunFor(plan: MarathonPlan, date: IsoDate): PlannedWorkout | undefined {
  return weekForDate(plan, date)?.days[6]
}

export function nutritionPhaseFor(plan: MarathonPlan, date: IsoDate): NutritionPhase | undefined {
  return plan.meta.nutritionPhases.find((p) => date >= p.startDate && date <= p.endDate)
}

export function defaultOpenWeek(plan: MarathonPlan, today: IsoDate = toLocalISODate()): number {
  const phase = planPhase(plan, today)
  if (phase === 'pre-plan') return 1
  if (phase === 'post-race') return plan.weeks.length
  return weekForDate(plan, today)?.weekNumber ?? 1
}

/** D3: resolves planned vs. actual for a single day. Pure, never stored. */
export function resolveActual(
  workout: PlannedWorkout,
  runLog: RunLogEntry[],
  statusMap: StatusMap,
): WorkoutActual {
  const runs = runLog.filter((r) => r.date === workout.date)
  const override = statusMap[workout.date]
  const isRest = workout.workoutType === 'REST'

  const status = override?.status ?? (!isRest && runs.length > 0 ? 'completed' : 'pending')

  const distance = runs.length > 0 ? runs.reduce((sum, r) => sum + r.distanceKm, 0) : null
  const everyHasDuration = runs.length > 0 && runs.every((r) => r.durationMin != null)
  const duration = everyHasDuration
    ? runs.reduce((sum, r) => sum + (r.durationMin ?? 0), 0)
    : null

  let derivedPace: string | null
  if (distance && duration) derivedPace = formatPace(distance, duration)
  else if (runs.length === 1) derivedPace = runs[0]?.averagePace ?? null
  else derivedPace = null

  const notes = override?.notes ?? (!isRest ? runs[0]?.notes ?? null : null)

  return {
    date: workout.date,
    status,
    actualDistanceKm: isRest ? null : distance,
    actualDurationMin: isRest ? null : duration,
    actualPace: isRest ? null : derivedPace,
    notes: notes ?? null,
    loggedRunsOnDate: runs.length,
    isOverride: override != null,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

function totalsForDays(
  days: PlannedWorkout[],
  runLog: RunLogEntry[],
  statusMap: StatusMap,
): WeekTotals {
  let plannedKm = 0
  let completedKm = 0
  let sessionsPlanned = 0
  let sessionsCompleted = 0
  let sessionsSkipped = 0
  let restPlanned = 0
  let restCompleted = 0
  let restSkipped = 0

  for (const day of days) {
    plannedKm += day.targetDistanceKm ?? 0
    const actual = resolveActual(day, runLog, statusMap)
    const isRest = day.workoutType === 'REST'

    if (actual.status === 'completed') completedKm += actual.actualDistanceKm ?? 0

    if (isRest) {
      restPlanned++
      if (actual.status === 'completed') restCompleted++
      if (actual.status === 'skipped') restSkipped++
    } else {
      sessionsPlanned++
      if (actual.status === 'completed') sessionsCompleted++
      if (actual.status === 'skipped') sessionsSkipped++
    }
  }

  const completionRatio = plannedKm === 0 ? 0 : completedKm / plannedKm
  const completionPercent = plannedKm === 0 ? 0 : clamp(Math.round(completionRatio * 100), 0, 100)

  return {
    plannedKm,
    completedKm,
    completionPercent,
    completionRatio,
    sessionsPlanned,
    sessionsCompleted,
    sessionsSkipped,
    restPlanned,
    restCompleted,
    restSkipped,
  }
}

export function weekTotals(
  week: MarathonWeek,
  runLog: RunLogEntry[],
  statusMap: StatusMap,
): WeekTotals {
  return totalsForDays(week.days, runLog, statusMap)
}

export function planTotals(
  plan: MarathonPlan,
  runLog: RunLogEntry[],
  statusMap: StatusMap,
): WeekTotals {
  return totalsForDays(allPlannedWorkouts(plan), runLog, statusMap)
}

/** First day from `today` onward that is a run day and still pending. */
export function nextWorkout(
  plan: MarathonPlan,
  runLog: RunLogEntry[],
  statusMap: StatusMap,
  today: IsoDate = toLocalISODate(),
): PlannedWorkout | undefined {
  return allPlannedWorkouts(plan)
    .filter((w) => w.date >= today && w.workoutType !== 'REST')
    .find((w) => resolveActual(w, runLog, statusMap).status === 'pending')
}

/** Everything the summary strip renders — one call, no prop drilling. */
export function marathonSummary(
  plan: MarathonPlan,
  runLog: RunLogEntry[],
  statusMap: StatusMap,
  today: IsoDate = toLocalISODate(),
): MarathonSummary {
  const currentWeek = weekForDate(plan, today) ?? null
  return {
    phase: planPhase(plan, today),
    raceDate: plan.meta.raceDate,
    raceName: plan.meta.raceName,
    raceDistanceKm: plan.meta.raceDistanceKm,
    daysToRace: raceCountdownDays(plan, today),
    currentWeek,
    week: currentWeek ? weekTotals(currentWeek, runLog, statusMap) : null,
    plan: planTotals(plan, runLog, statusMap),
    nextWorkout: nextWorkout(plan, runLog, statusMap, today),
    sundayLongRun: sundayLongRunFor(plan, today),
    peakLongRun: peakLongRun(plan),
    nutritionPhase: nutritionPhaseFor(plan, today),
  }
}
