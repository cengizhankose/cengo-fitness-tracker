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
export interface StrengthSet {
  weightKg: number
  reps: number
  rpe?: number
}
export interface StrengthLogEntry {
  id: string
  date: IsoDate
  exerciseName: string
  sets: StrengthSet[]
  progressionNote?: string
  createdAt: IsoTimestamp
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
