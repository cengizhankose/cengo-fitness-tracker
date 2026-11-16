import { set } from 'idb-keyval'
import { SCHEMA_VERSION, useStore } from '@/store'
import type { PersistedState } from '@/store'
import { MAGIC, FORMAT_VERSION } from '@/lib/backup/format'

export const EMPTY_STATE: PersistedState = {
  settings: {},
  checklist: {},
  checkIns: {},
  strengthLog: [],
  runLog: [],
  _schemaVersion: SCHEMA_VERSION,
}

export function makeState(overrides: Partial<PersistedState> = {}): PersistedState {
  return { ...EMPTY_STATE, ...overrides }
}

/** A small, deterministic "JPEG" — content differs per seed so blobs are comparable. */
export function fakePhoto(seed: number, size = 64): Blob {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i++) bytes[i] = (seed * 31 + i * 7) % 256
  return new Blob([bytes], { type: 'image/jpeg' })
}

export async function bytesOf(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())]
}

export function resetStore(state: PersistedState = EMPTY_STATE): void {
  useStore.setState(state, false)
}

export async function seedPhoto(key: string, blob: Blob): Promise<void> {
  await set(key, blob)
}

/**
 * A populated v3 state used across the round-trip / rollback tests: a pre-plan day carrying
 * only retired checklist keys, an auto-ticked plan day, two check-ins on non-Monday-aligned
 * days, one session entry (warmup + working sets, set ids, sessionId, updatedAt), one ad-hoc
 * entry in the legacy shape, and one run.
 */
export function populatedState(): PersistedState {
  return makeState({
    checklist: {
      '2026-11-15': {
        date: '2026-11-15',
        items: { completedWorkout: true, noAlcohol: true, sleep75Plus: false },
        updatedAt: '2026-11-15T21:00:00.000Z',
      },
      '2026-11-16': {
        date: '2026-11-16',
        items: { completedWorkout: true, hitProteinTarget: true, inBedByMidnight: false },
        autoWorkout: true,
        updatedAt: '2026-11-16T08:10:00.000Z',
      },
    },
    checkIns: {
      '2026-11-16': {
        date: '2026-11-16',
        weightKg: 95.5,
        waistCm: 101,
        frontPhotoKey: 'photo:2026-11-16:front',
        sidePhotoKey: 'photo:2026-11-16:side',
        notes: 'start',
        createdAt: '2026-11-16T06:30:00.000Z',
        updatedAt: '2026-11-16T06:30:00.000Z',
      },
      '2026-11-18': {
        date: '2026-11-18',
        weightKg: 95.1,
        createdAt: '2026-11-18T06:25:00.000Z',
        updatedAt: '2026-11-18T06:25:00.000Z',
      },
    },
    strengthLog: [
      {
        id: 's2',
        date: '2026-11-16',
        exerciseName: 'Deadlift',
        sets: [
          { id: 'set-1', weightKg: 80, reps: 5, kind: 'warmup' },
          { id: 'set-2', weightKg: 120, reps: 5, rpe: 9, kind: 'working' },
        ],
        sessionId: 'session-1',
        createdAt: '2026-11-16T07:20:00.000Z',
        updatedAt: '2026-11-16T07:25:00.000Z',
      },
      {
        id: 's1',
        date: '2026-11-16',
        exerciseName: 'Pull Up / Lat Pulldown',
        sets: [{ weightKg: 60, reps: 10, rpe: 9 }],
        createdAt: '2026-11-16T07:05:00.000Z',
      },
    ],
    runLog: [
      {
        id: 'r1',
        date: '2026-11-15',
        distanceKm: 8.2,
        durationMin: 47,
        averageHeartRate: 148,
        createdAt: '2026-11-15T09:30:00.000Z',
      },
    ],
  })
}

/** A structurally valid `photos[]` entry with real, self-consistent base64. */
export function photoEntry(
  key: string,
  seed = 1,
  size = 32,
): { key: string; mime: string; bytes: number; data: string } {
  let binary = ''
  for (let i = 0; i < size; i++) binary += String.fromCharCode((seed * 31 + i * 7) % 256)
  return { key, mime: 'image/jpeg', bytes: size, data: btoa(binary) }
}

interface BackupDocOverrides {
  magic?: unknown
  formatVersion?: unknown
  schemaVersion?: unknown
  exportedAt?: unknown
  state?: unknown
  photos?: unknown
}

/** A structurally valid backup document, ready to be mutated by the invalid-file tests. */
export function backupDoc(overrides: BackupDocOverrides = {}): Record<string, unknown> {
  const state = populatedState()
  const doc: Record<string, unknown> = {
    magic: MAGIC,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-11-18T13:42:11.284Z',
    counts: { checklist: 2, checkIns: 2, strength: 2, run: 1, photos: 0 },
    state,
    photos: [],
  }
  for (const [k, v] of Object.entries(overrides)) doc[k] = v
  return doc
}

/**
 * The persisted state exactly as the schema-v2 build wrote it (backup `state` or localStorage
 * envelope `state`): retired `benchmark` / `marathonStatus` slices, `settings.programStartDate`,
 * an `activeSession` in the old `dayName` shape and pre-plan checklist keys. `version` 1 drops
 * the v2-only slices and the session cursor, as the shipped v1 build never wrote them.
 */
export function legacyState(version: 1 | 2): Record<string, unknown> {
  const state: Record<string, unknown> = {
    settings: { programStartDate: '2026-08-03' },
    checklist: {
      '2026-08-03': {
        date: '2026-08-03',
        items: { completedWorkout: true, noAlcohol: true, completedMorningMobility: false },
        updatedAt: '2026-08-03T18:00:00.000Z',
      },
      '2026-08-04': {
        date: '2026-08-04',
        items: { hitCalorieTarget: true, steps10000Plus: true, sleep75Plus: true },
        updatedAt: '2026-08-04T21:00:00.000Z',
      },
    },
    checkIns: {
      '2026-08-03': {
        date: '2026-08-03',
        weightKg: 91.2,
        waistCm: 94,
        createdAt: '2026-08-03T07:00:00.000Z',
        updatedAt: '2026-08-03T07:00:00.000Z',
      },
    },
    strengthLog: [
      {
        id: 'legacy-s1',
        date: '2026-08-03',
        exerciseName: 'Bench Press',
        sets: [
          { weightKg: 80, reps: 8, rpe: 9 },
          { weightKg: 80, reps: 7 },
        ],
        createdAt: '2026-08-03T18:10:00.000Z',
      },
    ],
    runLog: [
      {
        id: 'legacy-r1',
        date: '2026-08-04',
        distanceKm: 5,
        durationMin: 25,
        averagePace: '5:00/km',
        scheduleDay: 'Tuesday',
        createdAt: '2026-08-04T06:30:00.000Z',
      },
    ],
    _schemaVersion: version,
  }
  if (version === 2) {
    state.benchmark = {
      date: '2026-08-04',
      timeSec: 1500,
      averagePace: '5:00/km',
      createdAt: '2026-08-04T06:30:00.000Z',
    }
    state.marathonStatus = {
      '2026-09-02': {
        date: '2026-09-02',
        status: 'completed',
        notes: 'threshold felt strong',
        updatedAt: '2026-09-02T19:00:00.000Z',
      },
    }
    state.activeSession = {
      id: 'legacy-session',
      date: '2026-08-05',
      dayName: 'Wednesday',
      exerciseNames: ['Squat', 'Leg Press'],
      currentIndex: 1,
      startedAt: '2026-08-05T07:00:00.000Z',
    }
  }
  return state
}

/** A backup file as the schema-v1/v2 build exported it (see `legacyState`). */
export function legacyBackupDoc(version: 1 | 2): Record<string, unknown> {
  return backupDoc({
    schemaVersion: version,
    exportedAt: '2026-09-03T10:00:00.000Z',
    state: legacyState(version),
  })
}

export function toFile(doc: unknown, name = 'backup.json'): File {
  return new File([JSON.stringify(doc)], name, { type: 'application/json' })
}
