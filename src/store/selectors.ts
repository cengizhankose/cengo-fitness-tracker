import { useStore } from '@/store'
import { plan } from '@/lib/plan'
import { toLocalISODate } from '@/lib/dates'
import {
  scheduleForDate,
  scheduleForDay,
  programWeek,
  workoutStreak,
  perfectDays,
  weeklyCompletion,
  applicableChecklistKeys,
  checklistRatio,
  lastWeightForExercise,
  sessionProgress,
  sessionSets,
} from '@/lib/derive'
import type { DayName, StrengthDay } from '@/types/plan'
import type { IsoDate } from '@/types/userData'
import { marathonPlan } from '@/lib/marathon/plan'
import { marathonSummary, plannedWorkoutFor, resolveActual } from '@/lib/marathon/derive'

// Raw slice hooks (stable references — safe to derive outside the selector).
export const useSettings = () => useStore((s) => s.settings)
export const useChecklist = () => useStore((s) => s.checklist)
export const useCheckIns = () => useStore((s) => s.checkIns)
export const useStrengthLog = () => useStore((s) => s.strengthLog)
export const useRunLog = () => useStore((s) => s.runLog)
export const useBenchmark = () => useStore((s) => s.benchmark)

export const useChecklistRecord = (date: IsoDate) => useStore((s) => s.checklist[date])

// Derived hooks — select stable slices, compute during render.
export function useTodayTask() {
  return scheduleForDate(plan, new Date())
}

export function useDayTask(day: DayName) {
  return scheduleForDay(plan, day)
}

export function useProgramWeek() {
  const start = useStore((s) => s.settings.programStartDate)
  return programWeek(plan, start)
}

export function useStreak() {
  const checklist = useStore((s) => s.checklist)
  return workoutStreak(checklist)
}

export function usePerfectDays() {
  const checklist = useStore((s) => s.checklist)
  return perfectDays(plan, checklist)
}

export function useWeeklyCompletion(today: IsoDate = toLocalISODate()) {
  const checklist = useStore((s) => s.checklist)
  return weeklyCompletion(plan, checklist, today)
}

/** Today's checklist completion ratio over the day's applicable items. */
export function useTodayChecklistRatio(today: IsoDate = toLocalISODate()) {
  const record = useStore((s) => s.checklist[today])
  const day = scheduleForDate(plan, new Date())
  const keys = applicableChecklistKeys(plan, day)
  return { ...checklistRatio(record, keys), keys }
}

/** History-only load suggestion — an in-progress session never seeds its own prefill. */
export function useLastWeight(exerciseName: string) {
  const strengthLog = useStore((s) => s.strengthLog)
  const activeSessionId = useStore((s) => s.activeSession?.id)
  return lastWeightForExercise(strengthLog, exerciseName, { excludeSessionId: activeSessionId })
}

// ---- Workout session ----

export const useActiveSession = () => useStore((s) => s.activeSession)

export function useSessionProgress(day: StrengthDay, sessionId: string) {
  const strengthLog = useStore((s) => s.strengthLog)
  return sessionProgress(day, strengthLog, sessionId)
}

export function useSessionSets(sessionId: string, exerciseName: string) {
  const strengthLog = useStore((s) => s.strengthLog)
  return sessionSets(strengthLog, sessionId, exerciseName)
}

// ---- Marathon plan ----

export const useMarathonStatus = () => useStore((s) => s.marathonStatus)

export function useMarathonSummary(today: IsoDate = toLocalISODate()) {
  const runLog = useStore((s) => s.runLog)
  const statusMap = useStore((s) => s.marathonStatus)
  return marathonSummary(marathonPlan, runLog, statusMap, today)
}

/** Planned workout + resolved actual for one date — the pair MarathonDayRow needs. */
export function useMarathonWorkout(date: IsoDate) {
  const runLog = useStore((s) => s.runLog)
  const statusMap = useStore((s) => s.marathonStatus)
  const workout = plannedWorkoutFor(marathonPlan, date)
  const actual = workout ? resolveActual(workout, runLog, statusMap) : undefined
  return { workout, actual }
}
