import type { ChecklistKey, DayName } from '@/types/plan'

/** Local civil date 'YYYY-MM-DD'. Always produced via toLocalISODate(). */
export type IsoDate = string
/** Full ISO timestamp for "recorded at" fields. */
export type IsoTimestamp = string

// ---- Daily checklist ----
export type DailyChecklist = Partial<Record<ChecklistKey, boolean>>
export interface DailyChecklistRecord {
  date: IsoDate
  items: DailyChecklist
  /** completedWorkout was ticked by a strength/run log, not by the user. */
  autoWorkout?: boolean
  updatedAt: IsoTimestamp
}

// ---- Weekly check-in (measurements + photo refs) ----
export interface CheckIn {
  date: IsoDate // the Monday it belongs to (key)
  weightKg?: number
  waistCm?: number
  chestCm?: number
  hipCm?: number
  frontPhotoKey?: string // photos live in IndexedDB; record holds only the key
  sidePhotoKey?: string
  notes?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

// ---- Strength log ----
/** Warmup vs working set. Absent on pre-session entries -> treat as 'working'. */
export type SetKind = 'warmup' | 'working'

export interface StrengthSet {
  id?: string // absent on legacy sets; fall back to the array index
  weightKg: number
  reps: number
  rpe?: number
  kind?: SetKind // absent => 'working' (see setKind() in lib/derive)
}
export interface StrengthLogEntry {
  id: string
  date: IsoDate
  exerciseName: string
  sets: StrengthSet[]
  /** Set when the entry was written by the workout-session flow. Legacy/ad-hoc entries have none. */
  sessionId?: string
  updatedAt?: IsoTimestamp
  progressionNote?: string
  createdAt: IsoTimestamp
}

// ---- In-progress workout session ----
/**
 * Cursor only — the sets themselves are written straight to `strengthLog`, so a
 * half-finished session can never lose data. `exerciseNames` is snapshotted at
 * start so an edit to plan.json mid-session can't shift the cursor.
 */
export interface ActiveSession {
  id: string
  date: IsoDate
  dayName: DayName
  exerciseNames: string[]
  currentIndex: number
  startedAt: IsoTimestamp
}

// ---- Run log ----
export interface RunLogEntry {
  id: string
  date: IsoDate
  distanceKm: number
  durationMin?: number
  averagePace?: string // "5:45/km"
  averageHeartRate?: number
  maxHeartRate?: number
  rpe?: number
  notes?: string
  scheduleDay?: DayName
  createdAt: IsoTimestamp
}

// ---- Benchmark (one-shot 5K) ----
export interface BenchmarkResult {
  date: IsoDate
  timeSec: number
  averagePace?: string
  averageHeartRate?: number
  maxHeartRate?: number
  notes?: string
  createdAt: IsoTimestamp
}

// ---- Settings ----
export interface Settings {
  programStartDate: IsoDate // anchors marathon week 1
}
