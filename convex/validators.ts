// Convex value validators mirroring the client types (src/types/userData.ts, src/types/plan.ts)
// plus the shapes of server tables the client no longer syncs. Kept in one place so every
// table/function derives the same shape — no parallel models.
import { v } from 'convex/values'

/**
 * Every checklist key a stored record may carry: the current ChecklistKey of src/types/plan.ts
 * plus the retired LegacyChecklistKey of src/types/userData.ts. Additive only — existing rows
 * still hold the retired keys.
 */
export const checklistKey = v.union(
  v.literal('completedWorkout'),
  v.literal('hitProteinTarget'),
  v.literal('inBedByMidnight'),
  v.literal('completedMorningMobility'),
  v.literal('completedStretching'),
  v.literal('hitCalorieTarget'),
  v.literal('steps10000Plus'),
  v.literal('sleep75Plus'),
  v.literal('noAlcohol'),
)

/** Mirrors src/types/userData.ts DailyChecklist. */
export const checklistItems = v.object({
  completedWorkout: v.optional(v.boolean()),
  hitProteinTarget: v.optional(v.boolean()),
  inBedByMidnight: v.optional(v.boolean()),
  completedMorningMobility: v.optional(v.boolean()),
  completedStretching: v.optional(v.boolean()),
  hitCalorieTarget: v.optional(v.boolean()),
  steps10000Plus: v.optional(v.boolean()),
  sleep75Plus: v.optional(v.boolean()),
  noAlcohol: v.optional(v.boolean()),
})

/** Mirrors src/types/plan.ts DayName. */
export const dayName = v.union(
  v.literal('Monday'),
  v.literal('Tuesday'),
  v.literal('Wednesday'),
  v.literal('Thursday'),
  v.literal('Friday'),
  v.literal('Saturday'),
  v.literal('Sunday'),
)

/** Mirrors src/types/userData.ts SetKind. */
export const setKind = v.union(v.literal('warmup'), v.literal('working'))

/** Mirrors src/types/userData.ts StrengthSet. */
export const strengthSet = v.object({
  id: v.optional(v.string()),
  weightKg: v.number(),
  reps: v.number(),
  rpe: v.optional(v.number()),
  kind: v.optional(setKind),
})

/** Server-only table shape (the client no longer syncs it; rows are retained). */
export const marathonStatus = v.union(v.literal('completed'), v.literal('skipped'))

/** Constant natural key for the singleton benchmark row. */
export const BENCHMARK_SINGLETON_KEY = 'singleton'

/** Mirrors src/types/activities.ts ActivityType — Garmin's own activity taxonomy, narrowed. */
export const activityType = v.union(
  v.literal('running'),
  v.literal('treadmill_running'),
  v.literal('track_running'),
  v.literal('open_water_swimming'),
  v.literal('lap_swimming'),
  v.literal('cycling'),
  v.literal('strength_training'),
  v.literal('meditation'),
  v.literal('breathwork'),
  v.literal('walking'),
  v.literal('hiking'),
  v.literal('other'),
)

/** Mirrors src/types/activities.ts SportGroup — coarse grouping for the Activities screen's filter chips. */
export const sportGroup = v.union(
  v.literal('run'),
  v.literal('swim'),
  v.literal('bike'),
  v.literal('strength'),
  v.literal('other'),
)

/** Mirrors src/types/activities.ts PlanAdherence — set by the Hermes cron job, never this app. */
export const planAdherence = v.union(
  v.literal('on_plan'),
  v.literal('substitution'),
  v.literal('extra'),
  v.literal('unplanned'),
)

/** Mirrors src/types/activities.ts HrZoneEntry. */
export const hrZoneEntry = v.object({
  zone: v.number(),
  min: v.number(),
})

/** Mirrors src/types/activities.ts ActivitySplit. */
export const activitySplit = v.object({
  i: v.number(),
  distanceM: v.number(),
  sec: v.number(),
  hr: v.optional(v.number()),
})

/** Mirrors src/types/activities.ts StrokeSummaryEntry. */
export const strokeSummaryEntry = v.object({
  stroke: v.string(),
  meters: v.number(),
  secs: v.number(),
})

/** Mirrors src/types/activities.ts GarminStrengthSet. */
export const garminStrengthSet = v.object({
  exercise: v.optional(v.string()),
  reps: v.optional(v.number()),
  weightKg: v.optional(v.number()),
  sec: v.optional(v.number()),
})

/** Mirrors src/types/garminDaily.ts GarminDaily. */
export const garminDailyFields = {
  date: v.string(),
  steps: v.optional(v.number()),
  stepGoal: v.optional(v.number()),
  distanceKm: v.optional(v.number()),
  activeKcal: v.optional(v.number()),
  totalKcal: v.optional(v.number()),
  intensityMin: v.optional(v.number()),
  restingHr: v.optional(v.number()),
  avgStress: v.optional(v.number()),
  bodyBatteryHigh: v.optional(v.number()),
  bodyBatteryLow: v.optional(v.number()),
  sleepMin: v.optional(v.number()),
  deepSleepMin: v.optional(v.number()),
  lightSleepMin: v.optional(v.number()),
  remSleepMin: v.optional(v.number()),
  awakeMin: v.optional(v.number()),
  sleepScore: v.optional(v.number()),
  sleepStartLocal: v.optional(v.string()),
  sleepEndLocal: v.optional(v.string()),
  hrvNightAvg: v.optional(v.number()),
  hrvWeeklyAvg: v.optional(v.number()),
  hrvStatus: v.optional(v.string()),
  vo2max: v.optional(v.number()),
  trainingReadiness: v.optional(v.number()),
  trainingStatus: v.optional(v.string()),
  weightKg: v.optional(v.number()),
  updatedAt: v.string(),
}
