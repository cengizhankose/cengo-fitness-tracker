import type { ChecklistKey, DayName } from '@/types/plan'

/** Local civil date 'YYYY-MM-DD'. Always produced via toLocalISODate(). */
export type IsoDate = string
/** Full ISO timestamp for "recorded at" fields. */
export type IsoTimestamp = string

// ---- Daily checklist ----
/**
 * Keys of the retired checklist. Records written before plan v2 may still carry them; they
 * are kept verbatim when a record is round-tripped but never rendered or counted.
 */
export type LegacyChecklistKey =
  | 'completedMorningMobility'
  | 'completedStretching'
  | 'hitCalorieTarget'
  | 'steps10000Plus'
  | 'sleep75Plus'
  | 'noAlcohol'

export type DailyChecklist = Partial<Record<ChecklistKey | LegacyChecklistKey, boolean>>
export interface DailyChecklistRecord {
  date: IsoDate
  items: DailyChecklist
  /** completedWorkout was ticked by a strength/run log, not by the user. */
  autoWorkout?: boolean
  updatedAt: IsoTimestamp
}

// ---- Check-in (measurements + photo refs) ----
export interface CheckIn {
  date: IsoDate // any calendar day (key)
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
  kind?: SetKind // absent => 'working' (see setKind() in lib/exerciseStats)
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
 * start (and only ever appended to) so a plan edit mid-session can't shift the cursor.
 */
export interface ActiveSession {
  id: string
  date: IsoDate
  /** A plan `SessionId`, or 'free' for a session built exercise by exercise. */
  planSessionId: string
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

// ---- Settings ----
/** No user-editable settings yet (the plan start is a constant in plan data). The slice stays
 *  so persisted envelopes and backups keep their shape. */
export type Settings = Record<string, never>
