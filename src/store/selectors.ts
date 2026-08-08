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
