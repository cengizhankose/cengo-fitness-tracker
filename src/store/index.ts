import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChecklistKey } from '@/types/plan'
import type {
  Settings,
  DailyChecklist,
  DailyChecklistRecord,
  CheckIn,
  StrengthLogEntry,
  RunLogEntry,
  BenchmarkResult,
  IsoDate,
} from '@/types/userData'
import type { PhotoSlot } from '@/lib/photos'
import { mondayOf, toLocalISODate } from '@/lib/dates'

export const SCHEMA_VERSION = 2

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

export interface AppState {
  settings: Settings
  checklist: ChecklistMap
  checkIns: Record<IsoDate, CheckIn>
  strengthLog: StrengthLogEntry[]
  runLog: RunLogEntry[]
  benchmark?: BenchmarkResult
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
  saveBenchmark: (b: Omit<BenchmarkResult, 'createdAt'>) => void
  resetAll: () => void
}

/** The slice actually written to localStorage (see `partialize` below). */
export type PersistedState = Pick<
  AppState,
  | 'settings'
  | 'checklist'
  | 'checkIns'
  | 'strengthLog'
  | 'runLog'
  | 'benchmark'
  | '_schemaVersion'
>

/**
 * v1 -> v2: only bump the version. v1 records carry no provenance, and a same-day log does NOT
 * prove the tick was automatic — the user may have ticked it by hand and logged separately.
 * Leaving `autoWorkout` unset treats every legacy tick as user-owned, so deleting a log can never
 * revoke it. Automatic provenance is created only by v2 add-log actions, going forward.
 */
export function migrateState(state: PersistedState, version: number): PersistedState {
  if (version >= 2) return state
  return { ...state, _schemaVersion: SCHEMA_VERSION }
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      settings: { programStartDate: mondayOf(toLocalISODate()) },
      checklist: {},
      checkIns: {},
      strengthLog: [],
      runLog: [],
      benchmark: undefined,
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

      saveBenchmark: (b) => set(() => ({ benchmark: { ...b, createdAt: nowISO() } })),

      resetAll: () =>
        set(() => ({
          checklist: {},
          checkIns: {},
          strengthLog: [],
          runLog: [],
          benchmark: undefined,
        })),
    }),
    {
      name: 'cengo-cut',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        checklist: s.checklist,
        checkIns: s.checkIns,
        strengthLog: s.strengthLog,
        runLog: s.runLog,
        benchmark: s.benchmark,
        _schemaVersion: s._schemaVersion,
      }),
      migrate: (state, version) => migrateState(state as PersistedState, version),
    },
  ),
)
