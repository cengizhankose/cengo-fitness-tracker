import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChecklistKey, DayName } from '@/types/plan'
import type {
  Settings,
  DailyChecklist,
  DailyChecklistRecord,
  CheckIn,
  StrengthLogEntry,
  StrengthSet,
  ActiveSession,
  RunLogEntry,
  BenchmarkResult,
  IsoDate,
} from '@/types/userData'
import type { PhotoSlot } from '@/lib/photos'
import { mondayOf, toLocalISODate } from '@/lib/dates'
import { pace } from '@/lib/format'
import { isBenchmarkDistance, isValidBenchmarkSec } from '@/lib/benchmark'
import { setKind } from '@/lib/derive'

export const SCHEMA_VERSION = 2

/** localStorage key holding the persist envelope `{ state, version }`. */
export const STORAGE_KEY = 'cengo-cut'

/** The exact keys `persist` writes to localStorage. Single source of truth —
 *  `partialize` and the backup exporter both derive from this, so they can't drift. */
export const PERSISTED_KEYS = [
  'settings',
  'checklist',
  'checkIns',
  'strengthLog',
  'runLog',
  'benchmark',
  'activeSession',
  '_schemaVersion',
] as const

const nowISO = (): string => new Date().toISOString()

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

type ChecklistMap = Record<IsoDate, DailyChecklistRecord>

/** Record-level fields (outside `items`) a write may patch. */
type ChecklistMeta = Pick<DailyChecklistRecord, 'autoWorkout'>

function writeChecklist(
  map: ChecklistMap,
  date: IsoDate,
  patch: (items: DailyChecklist) => DailyChecklist,
  meta?: ChecklistMeta,
): ChecklistMap {
  const prev = map[date]
  return {
    ...map,
    [date]: { ...prev, ...meta, date, items: patch(prev?.items ?? {}), updatedAt: nowISO() },
  }
}

/** Auto-tick the workout box for a date if not already set, remembering we set it. */
function tickWorkout(map: ChecklistMap, date: IsoDate): ChecklistMap {
  if (map[date]?.items.completedWorkout === true) return map
  return writeChecklist(map, date, (items) => ({ ...items, completedWorkout: true }), {
    autoWorkout: true,
  })
}

/** Revert an auto-tick once the day's last real log is gone. Manual ticks are left alone. */
function untickWorkout(map: ChecklistMap, date: IsoDate): ChecklistMap {
  if (map[date]?.autoWorkout !== true) return map
  return writeChecklist(map, date, (items) => ({ ...items, completedWorkout: false }), {
    autoWorkout: undefined,
  })
}

/** Does the date still hold a real workout log? Benchmarks mirror a run entry, so they don't count. */
function hasWorkoutOn(
  date: IsoDate,
  strengthLog: StrengthLogEntry[],
  runLog: RunLogEntry[],
): boolean {
  return strengthLog.some((e) => e.date === date) || runLog.some((e) => e.date === date)
}

/** A manual set/toggle of the workout box hands ownership to the user. */
const ownershipMeta = (key: ChecklistKey): ChecklistMeta | undefined =>
  key === 'completedWorkout' ? { autoWorkout: undefined } : undefined

/** Everything a 5K benchmark needs. `distanceKm` is rejected unless it is exactly 5. */
export interface BenchmarkRunInput {
  date: IsoDate
  timeSec: number
  distanceKm: number
  averageHeartRate?: number
  maxHeartRate?: number
  rpe?: number
  notes?: string
  scheduleDay?: RunLogEntry['scheduleDay']
}

export interface SessionSetsInput {
  sessionId: string
  date: IsoDate
  exerciseName: string
  sets: StrengthSet[]
  progressionNote?: string
}

export interface AppState {
  settings: Settings
  checklist: ChecklistMap
  checkIns: Record<IsoDate, CheckIn>
  strengthLog: StrengthLogEntry[]
  runLog: RunLogEntry[]
  benchmark?: BenchmarkResult
  activeSession?: ActiveSession
  _schemaVersion: number

  // actions
  setProgramStartDate: (d: IsoDate) => void
  setChecklistItem: (date: IsoDate, key: ChecklistKey, value: boolean) => void
  toggleChecklistItem: (date: IsoDate, key: ChecklistKey) => void
  saveCheckIn: (input: Partial<CheckIn> & { date: IsoDate }) => void
  attachPhotoRef: (date: IsoDate, slot: PhotoSlot, key: string) => void
  addStrengthEntry: (e: Omit<StrengthLogEntry, 'id' | 'createdAt'>) => string
  removeStrengthEntry: (id: string) => void
  addRunEntry: (e: Omit<RunLogEntry, 'id' | 'createdAt'>) => string
  removeRunEntry: (id: string) => void
  /**
   * Writes the 5K benchmark *and* its run-log entry in one transition.
   * Returns false and persists nothing at all when the result fails validation.
   */
  logBenchmarkRun: (input: BenchmarkRunInput) => boolean
  startSession: (date: IsoDate, dayName: DayName, exerciseNames: string[]) => string
  setSessionIndex: (index: number) => void
  /** Ends the session. Returns whether it counted as a completed workout. */
  finishSession: () => boolean
  discardSession: () => void
  upsertSessionSets: (input: SessionSetsInput) => string | undefined
  resetAll: () => void
}

/** The slice of AppState that actually reaches storage. */
export type PersistedState = Pick<AppState, (typeof PERSISTED_KEYS)[number]>

export function pickPersisted(s: AppState): PersistedState {
  return {
    settings: s.settings,
    checklist: s.checklist,
    checkIns: s.checkIns,
    strengthLog: s.strengthLog,
    runLog: s.runLog,
    benchmark: s.benchmark,
    activeSession: s.activeSession,
    _schemaVersion: s._schemaVersion,
  }
}

/**
 * v1 -> v2: only bump the version. v1 records carry no provenance, and a same-day log does NOT
 * prove the tick was automatic — the user may have ticked it by hand and logged separately.
 * Leaving `autoWorkout` unset treats every legacy tick as user-owned, so deleting a log can never
 * revoke it. Automatic provenance is created only by v2 add-log actions, going forward.
 */
export function migrateState(state: PersistedState, version: number): PersistedState {
  if (version >= 2) return state
  return { ...state, activeSession: state.activeSession, _schemaVersion: SCHEMA_VERSION }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: { programStartDate: mondayOf(toLocalISODate()) },
      checklist: {},
      checkIns: {},
      strengthLog: [],
      runLog: [],
      benchmark: undefined,
      activeSession: undefined,
      _schemaVersion: SCHEMA_VERSION,

      setProgramStartDate: (d) =>
        set((s) => ({ settings: { ...s.settings, programStartDate: d } })),

      setChecklistItem: (date, key, value) =>
        set((s) => ({
          checklist: writeChecklist(
            s.checklist,
            date,
            (items) => ({ ...items, [key]: value }),
            ownershipMeta(key),
          ),
        })),

      toggleChecklistItem: (date, key) =>
        set((s) => ({
          checklist: writeChecklist(
            s.checklist,
            date,
            (items) => ({ ...items, [key]: !items[key] }),
            ownershipMeta(key),
          ),
        })),

      saveCheckIn: (input) =>
        set((s) => {
          const existing = s.checkIns[input.date]
          const base: CheckIn = existing ?? {
            date: input.date,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          }
          const merged: CheckIn = { ...base, ...input, updatedAt: nowISO() }
          return { checkIns: { ...s.checkIns, [input.date]: merged } }
        }),

      attachPhotoRef: (date, slot, key) =>
        set((s) => {
          const existing: CheckIn = s.checkIns[date] ?? {
            date,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          }
          const field = slot === 'front' ? 'frontPhotoKey' : 'sidePhotoKey'
          return {
            checkIns: { ...s.checkIns, [date]: { ...existing, [field]: key, updatedAt: nowISO() } },
          }
        }),

      addStrengthEntry: (e) => {
        const id = newId()
        set((s) => ({
          strengthLog: [{ ...e, id, createdAt: nowISO() }, ...s.strengthLog],
          checklist: tickWorkout(s.checklist, e.date),
        }))
        return id
      },
      removeStrengthEntry: (id) =>
        set((s) => {
          const gone = s.strengthLog.find((x) => x.id === id)
          if (!gone) return {}
          const strengthLog = s.strengthLog.filter((x) => x.id !== id)
          if (hasWorkoutOn(gone.date, strengthLog, s.runLog)) return { strengthLog }
          return { strengthLog, checklist: untickWorkout(s.checklist, gone.date) }
        }),

      addRunEntry: (e) => {
        const id = newId()
        set((s) => ({
          runLog: [{ ...e, id, createdAt: nowISO() }, ...s.runLog],
          checklist: tickWorkout(s.checklist, e.date),
        }))
        return id
      },
      removeRunEntry: (id) =>
        set((s) => {
          const gone = s.runLog.find((x) => x.id === id)
          if (!gone) return {}
          const runLog = s.runLog.filter((x) => x.id !== id)
          if (hasWorkoutOn(gone.date, s.strengthLog, runLog)) return { runLog }
          return { runLog, checklist: untickWorkout(s.checklist, gone.date) }
        }),

      logBenchmarkRun: (input) => {
        // Second line of defence: never let an invalid result reach localStorage,
        // even if a caller skipped the form validation.
        if (!input.date || !isValidBenchmarkSec(input.timeSec)) return false
        // A benchmark is a 5K: any other distance is rejected outright rather
        // than silently coerced, so it can never be persisted as a benchmark.
        if (!isBenchmarkDistance(input.distanceKm)) return false

        const createdAt = nowISO()
        const durationMin = input.timeSec / 60
        // Pace is derived here, never accepted, so it cannot disagree with 5 km.
        const averagePace = pace(input.distanceKm, durationMin)

        // One set() -> one persist write: the benchmark and its run entry can
        // never exist without each other.
        set((s) => ({
          benchmark: {
            date: input.date,
            timeSec: input.timeSec,
            averagePace,
            averageHeartRate: input.averageHeartRate,
            maxHeartRate: input.maxHeartRate,
            notes: input.notes,
            createdAt,
          },
          runLog: [
            {
              id: newId(),
              date: input.date,
              distanceKm: input.distanceKm,
              durationMin,
              averagePace,
              averageHeartRate: input.averageHeartRate,
              maxHeartRate: input.maxHeartRate,
              rpe: input.rpe,
              notes: input.notes,
              scheduleDay: input.scheduleDay,
              createdAt,
            },
            ...s.runLog,
          ],
          checklist: tickWorkout(s.checklist, input.date),
        }))
        return true
      },

      // ---- Workout session ----

      startSession: (date, dayName, exerciseNames) => {
        const id = newId()
        set(() => ({
          activeSession: { id, date, dayName, exerciseNames, currentIndex: 0, startedAt: nowISO() },
        }))
        return id
      },

      setSessionIndex: (index) =>
        set((s) => {
          const cur = s.activeSession
          if (!cur) return {}
          const last = Math.max(cur.exerciseNames.length - 1, 0)
          return { activeSession: { ...cur, currentIndex: Math.min(Math.max(index, 0), last) } }
        }),

      /**
       * The one and only completion trigger for a session. A workout counts as done only
       * once at least one working set is on record — warmup-only, empty and fully-skipped
       * sessions end without ticking anything.
       */
      finishSession: () => {
        const current = get().activeSession
        if (!current) return false
        const completed = get().strengthLog.some(
          (e) => e.sessionId === current.id && e.sets.some((x) => setKind(x) === 'working'),
        )
        set((s) => ({
          activeSession: undefined,
          checklist: completed ? tickWorkout(s.checklist, current.date) : s.checklist,
        }))
        return completed
      },

      /** Abandons the session cursor. Sets already written to the log are kept. */
      discardSession: () => set(() => ({ activeSession: undefined })),

      /**
       * Idempotent per (sessionId, exerciseName): replaces that entry's sets, or creates
       * the entry. An empty `sets` removes it. Entries without a sessionId (the Log screen's
       * ad-hoc ones) are never matched, so they can't be overwritten from a session.
       *
       * Deliberately does NOT touch the checklist — completion is finishSession's job alone,
       * so a workout you started but walked away from never reads as done.
       */
      upsertSessionSets: ({ sessionId, date, exerciseName, sets, progressionNote }) => {
        const existing = get().strengthLog.find(
          (e) => e.sessionId === sessionId && e.exerciseName === exerciseName,
        )

        if (sets.length === 0) {
          if (existing) {
            set((s) => ({ strengthLog: s.strengthLog.filter((x) => x.id !== existing.id) }))
          }
          return undefined
        }

        const stamped = sets.map((x) => ({ ...x, id: x.id ?? newId() }))
        const id = existing?.id ?? newId()

        set((s) => ({
          strengthLog: existing
            ? s.strengthLog.map((e) =>
                e.id === id ? { ...e, sets: stamped, progressionNote, updatedAt: nowISO() } : e,
              )
            : [
                {
                  id,
                  date,
                  exerciseName,
                  sets: stamped,
                  sessionId,
                  progressionNote,
                  createdAt: nowISO(),
                  updatedAt: nowISO(),
                },
                ...s.strengthLog,
              ],
        }))
        return id
      },

      resetAll: () =>
        set(() => ({
          checklist: {},
          checkIns: {},
          strengthLog: [],
          runLog: [],
          benchmark: undefined,
          activeSession: undefined,
        })),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: pickPersisted,
      migrate: (state, version) => migrateState(state as PersistedState, version),
    },
  ),
)
