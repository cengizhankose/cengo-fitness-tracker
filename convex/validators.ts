// Convex value validators mirroring src/types/userData.ts and src/types/marathon.ts.
// Kept in one place so every table/function derives the same shape — no parallel models.
import { v } from 'convex/values'

/** Mirrors src/types/plan.ts ChecklistKey. */
export const checklistKey = v.union(
  v.literal('completedWorkout'),
  v.literal('completedMorningMobility'),
  v.literal('completedStretching'),
  v.literal('hitProteinTarget'),
  v.literal('hitCalorieTarget'),
  v.literal('steps10000Plus'),
  v.literal('sleep75Plus'),
  v.literal('noAlcohol'),
)

/** Mirrors src/types/userData.ts DailyChecklist (Partial<Record<ChecklistKey, boolean>>). */
export const checklistItems = v.object({
  completedWorkout: v.optional(v.boolean()),
  completedMorningMobility: v.optional(v.boolean()),
  completedStretching: v.optional(v.boolean()),
  hitProteinTarget: v.optional(v.boolean()),
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

/** Mirrors src/types/marathon.ts MarathonStatus. */
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
