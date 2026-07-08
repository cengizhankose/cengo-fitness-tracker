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

export const SCHEMA_VERSION = 1

const nowISO = (): string => new Date().toISOString()

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

type ChecklistMap = Record<IsoDate, DailyChecklistRecord>

function writeChecklist(
  map: ChecklistMap,
  date: IsoDate,
  patch: (items: DailyChecklist) => DailyChecklist,
): ChecklistMap {
  const prev = map[date]?.items ?? {}
  return { ...map, [date]: { date, items: patch(prev), updatedAt: nowISO() } }
}

/** Auto-tick the workout box for a date if not already set. */
function tickWorkout(map: ChecklistMap, date: IsoDate): ChecklistMap {
  if (map[date]?.items.completedWorkout === true) return map
  return writeChecklist(map, date, (items) => ({ ...items, completedWorkout: true }))
}

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
          checklist: writeChecklist(s.checklist, date, (items) => ({ ...items, [key]: value })),
        })),

      toggleChecklistItem: (date, key) =>
        set((s) => ({
          checklist: writeChecklist(s.checklist, date, (items) => ({ ...items, [key]: !items[key] })),
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
        set((s) => ({ strengthLog: s.strengthLog.filter((x) => x.id !== id) })),

      addRunEntry: (e) => {
        const id = newId()
        set((s) => ({
          runLog: [{ ...e, id, createdAt: nowISO() }, ...s.runLog],
          checklist: tickWorkout(s.checklist, e.date),
        }))
        return id
      },
      removeRunEntry: (id) => set((s) => ({ runLog: s.runLog.filter((x) => x.id !== id) })),

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
      migrate: (state) => state as AppState,
    },
  ),
)
