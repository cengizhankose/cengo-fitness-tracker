import type { DayName, Range } from '@/types/plan'
import type { IsoDate, IsoTimestamp } from '@/types/userData'
import type { PaceZoneKey } from '@/lib/marathon/zones'

export type MarathonWorkoutType =
  | 'REST'
  | 'EASY'
  | 'STRIDES'
  | 'THRESHOLD'
  | 'MARATHON_PACE'
  | 'LONG_RUN'
  | 'RACE'

/** True for every type that can carry a logged run. The single guard used by UI and derive. */
export const isRunType = (t: MarathonWorkoutType): boolean => t !== 'REST'

export interface PlannedWorkout {
  date: IsoDate // authoritative
  dayName: DayName
  weekNumber: number // 1..9
  title: string
  workoutType: MarathonWorkoutType
  targetDistanceKm: number | null // whole-session distance; null on REST
  targetDurationMin: number | null // only for time-prescribed work; else null
  paceZone: PaceZoneKey | null // key only — never a pace string
  description: string
}

export interface MarathonWeek {
  weekNumber: number
  startDate: IsoDate // Monday
  endDate: IsoDate // Sunday
  focus: string
  targetVolumeKm: Range | null // null for race week
  qualitySummary: string
  longRunKm: number
  days: PlannedWorkout[] // length 7, Monday-first
}

export type NutritionPhaseKey = 'CUT' | 'MAINTENANCE_TRANSITION' | 'PERFORMANCE'
export interface NutritionPhase {
  key: NutritionPhaseKey
  label: string
  startDate: IsoDate
  endDate: IsoDate
  intent: string // no kcal numbers — plan.json owns targets
}

export interface MarathonPlan {
  meta: {
    planName: string
    version: string
    startDate: IsoDate
    raceDate: IsoDate
    raceName: string
    raceDistanceKm: number
    totalWeeks: number
    paceZoneKeys: PaceZoneKey[]
    nutritionPhases: NutritionPhase[] // length 3
  }
  weeks: MarathonWeek[] // length 9
}

// ---- actual state (user data) ----
export type MarathonStatus = 'completed' | 'skipped'
export interface MarathonStatusRecord {
  date: IsoDate
  status: MarathonStatus
  notes?: string
  updatedAt: IsoTimestamp
}
export type ResolvedStatus = 'pending' | MarathonStatus

export interface WorkoutActual {
  date: IsoDate
  status: ResolvedStatus
  /** Always null for REST — a rest day has no distance/duration/pace of its own (D3). */
  actualDistanceKm: number | null
  actualDurationMin: number | null
  actualPace: string | null // formatted via existing lib/format.ts `pace()`
  notes: string | null
  /** Informational only: runs logged on this date. Lets a REST row say "you ran 8 km today"
   *  without claiming the rest day was the run. */
  loggedRunsOnDate: number
  /** True when the user set the status explicitly — drives the Undo affordance. */
  isOverride: boolean
}

export interface WeekTotals {
  plannedKm: number
  completedKm: number
  completionPercent: number // clamped 0..100 for the bar
  completionRatio: number // raw — an over-delivered week stays visible
  sessionsPlanned: number
  sessionsCompleted: number
  sessionsSkipped: number // non-REST only
  restPlanned: number
  restCompleted: number
  restSkipped: number
}

export interface MarathonSummary {
  phase: 'pre-plan' | 'in-plan' | 'post-race'
  raceDate: IsoDate
  raceName: string
  raceDistanceKm: number
  daysToRace: number
  currentWeek: MarathonWeek | null
  week: WeekTotals | null
  plan: WeekTotals
  nextWorkout: PlannedWorkout | undefined
  sundayLongRun: PlannedWorkout | undefined
  peakLongRun: PlannedWorkout
  nutritionPhase: NutritionPhase | undefined
}
