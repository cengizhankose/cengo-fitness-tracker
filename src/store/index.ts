import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChecklistKey } from '@/types/plan'
import type {
  Settings,
  DailyChecklist,
  DailyChecklistRecord,
  CheckIn,
  StrengthLogEntry,
  StrengthSet,
  ActiveSession,
  RunLogEntry,
  IsoDate,
} from '@/types/userData'
import type { PhotoSlot } from '@/lib/photos'
import { setKind } from '@/lib/exerciseStats'

export const SCHEMA_VERSION = 3

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

/** Does the date still hold a real workout log? */
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

export interface SessionSetsInput {
  sessionId: string
  date: IsoDate
  exerciseName: string
  sets: StrengthSet[]
  progressionNote?: string
}

/** Fields of a logged strength entry that can be corrected after the fact. */
export interface StrengthEntryPatch {
  sets?: StrengthSet[]
  date?: IsoDate
  exerciseName?: string
  /** An empty string clears the note. */
  progressionNote?: string
}

export interface AppState {
  settings: Settings
  checklist: ChecklistMap
  checkIns: Record<IsoDate, CheckIn>
  strengthLog: StrengthLogEntry[]
  runLog: RunLogEntry[]
  activeSession?: ActiveSession
  _schemaVersion: number

  // actions
  setChecklistItem: (date: IsoDate, key: ChecklistKey, value: boolean) => void
  toggleChecklistItem: (date: IsoDate, key: ChecklistKey) => void
  /** Upserts the check-in keyed by `date` (any calendar day). Photos stay local-only. */
  saveCheckIn: (input: Partial<CheckIn> & { date: IsoDate }) => void
  attachPhotoRef: (date: IsoDate, slot: PhotoSlot, key: string) => void
  addStrengthEntry: (e: Omit<StrengthLogEntry, 'id' | 'createdAt'>) => string
  /**
   * Corrects a logged entry. Bumps `updatedAt` and re-evaluates the automatic workout tick
   * for the old and the new date. An empty `sets` removes the entry. Returns false when no
   * entry has that id.
   */
  updateStrengthEntry: (id: string, patch: StrengthEntryPatch) => boolean
  removeStrengthEntry: (id: string) => void
  addRunEntry: (e: Omit<RunLogEntry, 'id' | 'createdAt'>) => string
  removeRunEntry: (id: string) => void
  /** `planSessionId` is a plan SessionId or 'free'. Returns the new session id. */
  startSession: (date: IsoDate, planSessionId: string, exerciseNames: string[]) => string
  setSessionIndex: (index: number) => void
  /** Appends an exercise to the running session unless it is already listed. No-op without one. */
  addSessionExercise: (name: string) => void
  upsertSessionSets: (input: SessionSetsInput) => string | undefined
  /** Ends the session. Returns whether it counted as a completed workout. */
  finishSession: () => boolean
  discardSession: () => void
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
    activeSession: s.activeSession,
    _schemaVersion: s._schemaVersion,
  }
}

/** User data that every schema version shares and that migration carries over untouched. */
const KEPT_SLICES = ['settings', 'checklist', 'checkIns', 'strengthLog', 'runLog'] as const

/**
 * v1/v2 -> v3.
 * - The two retired client slices (the race-plan day status and the one-off 5K result) are
 *   dropped: those features no longer exist on the client (their server tables keep the history).
 * - `activeSession` is dropped: its shape changed (`dayName` -> `planSessionId`), and it is only a
 *   cursor — every set it wrote already lives in `strengthLog`, so nothing is lost.
 * - `settings`, `checklist`, `checkIns`, `strengthLog`, `runLog` are kept as the very same objects,
 *   including legacy checklist keys and the now-unused `settings.programStartDate`.
 *
 * Provenance is never inferred: v1 records carry no `autoWorkout`, and a same-day log does not
 * prove a tick was automatic, so legacy ticks stay user-owned (deleting a log never revokes them).
 *
 * Slices absent from the persisted state are left absent rather than set to undefined, so the
 * persist middleware's shallow merge keeps the store's own defaults for them.
 */
export function migrateState(persisted: unknown, version: number): PersistedState {
  if (version >= SCHEMA_VERSION) return persisted as PersistedState
  const old = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Record<
    string,
    unknown
  >
  const next: Record<string, unknown> = {}
  for (const key of KEPT_SLICES) {
    if (old[key] !== undefined) next[key] = old[key]
  }
  next._schemaVersion = SCHEMA_VERSION
  return next as unknown as PersistedState
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: {},
      checklist: {},
      checkIns: {},
      strengthLog: [],
      runLog: [],
      activeSession: undefined,
      _schemaVersion: SCHEMA_VERSION,

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

      updateStrengthEntry: (id, patch) => {
        const prev = get().strengthLog.find((x) => x.id === id)
        if (!prev) return false
        if (patch.sets !== undefined && patch.sets.length === 0) {
          get().removeStrengthEntry(id)
          return true
        }

        const next: StrengthLogEntry = { ...prev, updatedAt: nowISO() }
        // Legacy sets carry no id; stamp one so the edited set can be keyed like session sets.
        if (patch.sets !== undefined) {
          next.sets = patch.sets.map((x) => ({ ...x, id: x.id ?? newId() }))
        }
        if (patch.date) next.date = patch.date
        if (patch.exerciseName) next.exerciseName = patch.exerciseName
        if (patch.progressionNote !== undefined) {
          if (patch.progressionNote) next.progressionNote = patch.progressionNote
          else delete next.progressionNote
        }

        set((s) => {
          const strengthLog = s.strengthLog.map((x) => (x.id === id ? next : x))
          let checklist = s.checklist
          if (next.date !== prev.date) {
            if (!hasWorkoutOn(prev.date, strengthLog, s.runLog)) {
              checklist = untickWorkout(checklist, prev.date)
            }
            // Sets of the running session only count once finishSession says so.
            const inRunningSession =
              next.sessionId !== undefined && next.sessionId === s.activeSession?.id
            if (!inRunningSession) checklist = tickWorkout(checklist, next.date)
          }
          return { strengthLog, checklist }
        })
        return true
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

      // ---- Workout session ----

      startSession: (date, planSessionId, exerciseNames) => {
        const id = newId()
        set(() => ({
          activeSession: {
            id,
            date,
            planSessionId,
            exerciseNames: [...exerciseNames],
            currentIndex: 0,
            startedAt: nowISO(),
          },
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

      addSessionExercise: (name) =>
        set((s) => {
          const cur = s.activeSession
          if (!cur || cur.exerciseNames.includes(name)) return {}
          return { activeSession: { ...cur, exerciseNames: [...cur.exerciseNames, name] } }
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
       * the entry. An empty `sets` removes it. Entries without a sessionId (ad-hoc ones)
       * are never matched, so they can't be overwritten from a session.
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
          activeSession: undefined,
        })),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: pickPersisted,
      migrate: (state, version) => migrateState(state, version),
    },
  ),
)
