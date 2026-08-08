import { set } from 'idb-keyval'
import { SCHEMA_VERSION, useStore } from '@/store'
import type { PersistedState } from '@/store'
import { MAGIC, FORMAT_VERSION } from '@/lib/backup/format'

export const EMPTY_STATE: PersistedState = {
  settings: { programStartDate: '2026-08-03' },
  checklist: {},
  checkIns: {},
  strengthLog: [],
  runLog: [],
  benchmark: undefined,
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

/** A populated state used across the round-trip / rollback tests. */
export function populatedState(): PersistedState {
  return makeState({
    settings: { programStartDate: '2026-08-03' },
    checklist: {
      '2026-08-03': {
        date: '2026-08-03',
        items: { completedWorkout: true, noAlcohol: true },
        updatedAt: '2026-08-03T18:00:00.000Z',
      },
      '2026-08-04': {
        date: '2026-08-04',
        items: { completedMorningMobility: true },
        updatedAt: '2026-08-04T08:00:00.000Z',
      },
    },
    checkIns: {
      '2026-08-03': {
        date: '2026-08-03',
        weightKg: 91.2,
        waistCm: 94,
        frontPhotoKey: 'photo:2026-08-03:front',
        sidePhotoKey: 'photo:2026-08-03:side',
        notes: 'week 1',
        createdAt: '2026-08-03T07:00:00.000Z',
        updatedAt: '2026-08-03T07:00:00.000Z',
      },
    },
    strengthLog: [
      {
        id: 's1',
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
        id: 'r1',
        date: '2026-08-04',
        distanceKm: 8.2,
        durationMin: 47,
        averagePace: '5:44/km',
        createdAt: '2026-08-04T06:30:00.000Z',
      },
    ],
    benchmark: {
      date: '2026-08-02',
      timeSec: 1380,
      averagePace: '4:36/km',
      createdAt: '2026-08-02T09:00:00.000Z',
    },
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
    exportedAt: '2026-08-08T13:42:11.284Z',
    counts: { checklist: 2, checkIns: 1, strength: 1, run: 1, photos: 0 },
    state,
    photos: [],
  }
  for (const [k, v] of Object.entries(overrides)) doc[k] = v
  return doc
}

export function toFile(doc: unknown, name = 'backup.json'): File {
  return new File([JSON.stringify(doc)], name, { type: 'application/json' })
}
