// Static training/nutrition plan types — mirror src/data/plan.json exactly.
// The JSON is the single source of truth; this is the typed contract the UI codes against.

export type DayName =
  | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday'
  | 'Friday' | 'Saturday' | 'Sunday'

export type WorkoutType = 'strength' | 'run' | 'football'

export interface Range { min: number; max: number }
export interface MinOnly { min: number }

// ---- meta ----
export interface ProfileAssumptions {
  heightCm: number
  startWeightKg: number
  estimatedBodyFatPercent: number
  trainingStyle: string
  dietStyle: string
}
export interface PlanMeta {
  planName: string
  version: string
  primaryGoals: string[]
  profileAssumptions: ProfileAssumptions
}

// ---- nutrition ----
export interface DailyTargets {
  caloriesKcal: Range
  proteinG: Range
  carbsG: Range
  fatG: Range
  steps: MinOnly
  sleepHours: Range
}
export interface MealItem { name: string; amount: number; unit: string }
export interface Meal {
  id: string
  name: string
  time: string // "12:00" | "after_training" — not a time type
  items: MealItem[]
  estimatedCaloriesKcal: number
}
export interface Nutrition {
  dailyTargets: DailyTargets
  meals: Meal[]
  rules: string[]
}

// ---- weeklySchedule (discriminated union on `type`) ----
export interface StrengthExercise {
  name: string
  warmupSets: number
  workingSets: number
  repRange: string // "6-10" | "controlled"
  intensity: string // "RPE 9-10" | "clean reps"
}
interface ScheduleBase {
  day: DayName
  title: string
  durationMin?: number | null // nullable (Thu) / absent (Sun)
}
export interface StrengthDay extends ScheduleBase {
  type: 'strength'
  exercises: StrengthExercise[]
  postWorkoutStretchingId: string
}
export interface RunSegment {
  segment: string // "easy" | "tempo"
  distanceKm: number
  pace?: string // only present on tempo segment
}
export interface RunDay extends ScheduleBase {
  type: 'run'
  intensity?: string // Tue / Sun
  targetDistanceKm?: number // Tue / Thu
  structure?: RunSegment[] // Thu
  progressionKmByWeek?: number[] // Sun (length 12)
  postWorkoutStretchingId: string
}
export interface FootballDay extends ScheduleBase {
  type: 'football'
  rule: string // "No extra training"
}
export type ScheduleDay = StrengthDay | RunDay | FootballDay

// ---- mobility ----
export interface MobilityItem {
  name: string
  durationSec: number
  eachSide?: boolean
}
export interface MorningMobility {
  id: string
  durationMin: number
  items: MobilityItem[]
}
export interface StretchingRoutine {
  id: string
  name: string
  durationMin: number
  items: MobilityItem[]
}
export interface Mobility {
  dailyMorningMobility: MorningMobility
  stretchingRoutines: StretchingRoutine[]
}

// ---- progressTracking ----
export type ChecklistKey =
  | 'completedWorkout' | 'completedMorningMobility' | 'completedStretching'
  | 'hitProteinTarget' | 'hitCalorieTarget' | 'steps10000Plus'
  | 'sleep75Plus' | 'noAlcohol'

export interface NumericMetric { key: string; label: string; unit: string; type?: undefined }
export interface ImageMetric { key: string; label: string; type: 'image'; unit?: undefined }
export type CheckInMetric = NumericMetric | ImageMetric

export interface ProgressTracking {
  weeklyCheckInDay: DayName
  weeklyCheckInTime: string
  metrics: CheckInMetric[]
  dailyChecklist: ChecklistKey[] // length 8
  runningMetrics: string[]
  strengthMetrics: string[]
}

// ---- benchmark ----
export interface Benchmark {
  initialTask: string
  effort: string
  requiredData: string[]
}

// ---- root ----
export interface TrainingPlan {
  meta: PlanMeta
  nutrition: Nutrition
  weeklySchedule: ScheduleDay[] // length 7, Monday-first
  mobility: Mobility
  progressTracking: ProgressTracking
  benchmark: Benchmark
}
