import type { IsoDate, IsoTimestamp } from './userData'

/** Mirrors Garmin Connect's own activity-type taxonomy (fetch_any_activity.py), narrowed to
 *  the types this tracker cares about. */
export type ActivityType =
  | 'running'
  | 'treadmill_running'
  | 'track_running'
  | 'open_water_swimming'
  | 'lap_swimming'
  | 'cycling'
  | 'strength_training'
  | 'meditation'
  | 'breathwork'
  | 'walking'
  | 'hiking'
  | 'other'

/** Coarse grouping over ActivityType, used for the Activities screen's filter chips. */
export type SportGroup = 'run' | 'swim' | 'bike' | 'strength' | 'other'

/** Set by the Hermes cron job once it has compared the activity against the plan. */
export type PlanAdherence = 'on_plan' | 'substitution' | 'extra' | 'unplanned'

export interface HrZoneEntry {
  zone: number
  min: number
}

export interface ActivitySplit {
  i: number
  distanceM: number
  sec: number
  hr?: number
}

export interface StrokeSummaryEntry {
  stroke: string
  meters: number
  secs: number
}

/** One active set of a Garmin strength activity (rest periods are dropped). */
export interface GarminStrengthSet {
  /** Garmin's exercise name ("BENCH_PRESS"); absent when the watch did not classify the set. */
  exercise?: string
  reps?: number
  /** Absent when no weight was entered on the watch. */
  weightKg?: number
  sec?: number
}

/**
 * A single Garmin activity (run/bike/swim/strength), pushed into Convex by the
 * garmin-logan Python scripts and pulled read-only into this app. The tracker never
 * creates or edits these locally — `comment`/`commentGeneratedAt`/`planAdherence`/`planRef`
 * are filled in later by the Hermes cron job's LLM pass, not by this app.
 */
export interface Activity {
  id: string // "garmin-<garminId>"
  garminId: number
  type: ActivityType
  sportGroup: SportGroup
  name: string
  date: IsoDate
  startTimeLocal: string
  durationMin: number
  movingDurationMin?: number
  distanceKm?: number
  avgHr?: number
  maxHr?: number
  calories?: number
  aerobicTE?: number
  anaerobicTE?: number
  trainingLoad?: number
  hrZones?: HrZoneEntry[]
  splits?: ActivitySplit[]
  strokeSummary?: StrokeSummaryEntry[]
  /** Strength activities only. */
  strengthSets?: GarminStrengthSet[]
  avgCadence?: number
  rawNotes?: string
  comment?: string
  commentGeneratedAt?: IsoTimestamp
  planAdherence?: PlanAdherence
  planRef?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}
