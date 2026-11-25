// Static training/nutrition plan types — mirror src/data/plan.json (version "2.0") exactly.
// The JSON is the single source of truth; this is the typed contract the UI codes against.

export type DayName =
  | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday'
  | 'Friday' | 'Saturday' | 'Sunday'

/** Ids of the six strength sessions. */
export type SessionId = 'pull' | 'push' | 'legs' | 'upper-superset' | 'short' | 'shoulders-arms'

/** The three daily ticks. `completedWorkout` is auto-ticked by logging. */
export type ChecklistKey = 'completedWorkout' | 'hitProteinTarget' | 'inBedByMidnight'

/**
 * How an exercise is measured:
 * - `kg`: weight × reps
 * - `bodyweight`: reps; `weightKg` 0 = bodyweight, > 0 = added load
 * - `seconds`: the `reps` field holds seconds; `weightKg` is 0
 */
export type ExerciseUnit = 'kg' | 'bodyweight' | 'seconds'

/** Body region key (labels live in lib/exerciseGroups). */
export type Region = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'core'

/** Inclusive numeric range, e.g. the 12–14 km long-run hold or the 89–90 kg milestone. */
export interface Range { min: number; max: number }

// ---- goal ----
export interface Goal {
  startKg: number
  /** First milestone band. */
  milestoneKg: Range
  milestoneDate: string // IsoDate
  /** Expected loss per week. */
  kgPerWeek: number
}

// ---- sessions ----
export interface PlanExercise {
  /** Canonical English gym name — the `exerciseName` key in logged data. */
  name: string
  sets: number
  /** Target reps per set; seconds for `seconds` exercises; 'max' = as many as possible. */
  reps: number | 'max'
  unit: ExerciseUnit
  /** Current working load, used as the target before any history exists. */
  startKg?: number
  /** Load increment suggested once the target gets easy (kg exercises only). */
  stepKg?: number
  region: Region
}

export interface SingleItem {
  kind: 'single'
  exercise: PlanExercise
}
export interface SupersetItem {
  kind: 'superset'
  /** 2–3 exercises done back to back. */
  exercises: PlanExercise[]
}
export type SessionItem = SingleItem | SupersetItem

export interface Session {
  id: SessionId
  title: string
  durationMin: number
  items: SessionItem[]
}

// ---- weekly template ----
interface BlockBase {
  /** Saturday alternatives: pick one of the optional blocks, or rest. */
  optional?: boolean
}
export interface StrengthBlock extends BlockBase {
  type: 'strength'
  sessionId: SessionId
}
export interface RunBlock extends BlockBase {
  type: 'run'
  title: string
  durationMin?: number
  /** Sunday group run: distance comes from `longRun` by plan week. */
  longRun?: boolean
}
export interface FootballBlock extends BlockBase {
  type: 'football'
  title: string
  when?: string
}
export type DayBlock = StrengthBlock | RunBlock | FootballBlock
export type BlockType = DayBlock['type']

export interface PlanDay {
  day: DayName
  /** Ordered; done in this order on the day. */
  blocks: DayBlock[]
}

// ---- running ----
export interface RunRule {
  /** Easy = average HR under this. */
  hrEasyMax: number
  /** Walk when HR goes above this. */
  hrWalkAbove: number
  text: string
}
export interface LongRunProgression {
  /** Target km for plan weeks 1..n. */
  kmByWeek: number[]
  /** Range held after the progression ends. */
  hold: Range
}

// ---- nutrition ----
export interface NutritionTargets {
  caloriesKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  waterL: number
  stepsMin: number
}
export interface Meal {
  id: string
  title: string
  time?: string // "12:30"
  items: string[]
  approxKcal: Range
  proteinG?: number
}
export interface Nutrition {
  targets: NutritionTargets
  meals: Meal[]
  eatingOut: string
}

// ---- supplements ----
export interface Supplement {
  name: string
  dose: string
  timing?: string
  note?: string
  optional?: boolean
}
export interface Supplements {
  items: Supplement[]
  avoid: string[]
}

// ---- root ----
export interface TrainingPlan {
  name: string
  version: string
  startDate: string // IsoDate, Monday of plan week 1
  goal: Goal
  /** Monday-first, length 7. */
  weeklyTemplate: PlanDay[]
  sessions: Session[]
  sessionRules: string[]
  runRule: RunRule
  longRun: LongRunProgression
  nutrition: Nutrition
  supplements: Supplements
  sleepRule: string
  dailyChecklist: ChecklistKey[]
  /** Logged name → canonical name; applied at read time only. */
  aliases: Record<string, string>
}
