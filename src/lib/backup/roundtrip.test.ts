import { describe, expect, it, vi } from 'vitest'
import { clear, get, set } from 'idb-keyval'
import { SCHEMA_VERSION, STORAGE_KEY, pickPersisted, useStore } from '@/store'
import type { PersistedState } from '@/store'
import { buildBackup } from './export'
import { MAX_FILE_BYTES, blobToBase64, decodePhoto } from './format'
import { applyBackup, readBackupFile } from './import'
import {
  EMPTY_STATE,
  bytesOf,
  fakePhoto,
  legacyBackupDoc,
  legacyState,
  populatedState,
  resetStore,
  toFile,
} from '@/test/fixtures'

const FRONT = 'photo:2026-11-16:front'
const SIDE = 'photo:2026-11-16:side'

async function backupFile(): Promise<File> {
  const built = await buildBackup(new Date('2026-08-08T13:42:11.284Z'))
  expect(built.filename).toBe('cengo-cut-backup-2026-08-08-1642.json')
  return new File([built.blob], built.filename, { type: 'application/json' })
}

/**
 * Photo keys are deliberately rewritten on import (blobs are staged under fresh
 * keys rather than overwriting live ones), so compare state with the keys
 * normalised back to the base they were staged from.
 */
function withNormalisedPhotoKeys(state: PersistedState): PersistedState {
  const checkIns = Object.fromEntries(
    Object.entries(state.checkIns).map(([date, c]) => [
      date,
      {
        ...c,
        ...(c.frontPhotoKey ? { frontPhotoKey: c.frontPhotoKey.split('#')[0] } : {}),
        ...(c.sidePhotoKey ? { sidePhotoKey: c.sidePhotoKey.split('#')[0] } : {}),
      },
    ]),
  )
  return { ...state, checkIns }
}

describe('base64 helpers', () => {
  it('round-trips bytes exactly', async () => {
    const blob = fakePhoto(5, 1024)
    const restored = decodePhoto(await blobToBase64(blob), 'image/jpeg', blob.size)
    expect(restored).toBeDefined()
    expect(await bytesOf(restored as Blob)).toEqual(await bytesOf(blob))
    expect(restored?.type).toBe('image/jpeg')
  })

  it('handles a 250 KB photo without blowing the call stack', async () => {
    const blob = fakePhoto(6, 250_000)
    const restored = decodePhoto(await blobToBase64(blob), 'image/jpeg', blob.size)
    expect(restored?.size).toBe(blob.size)
    expect(await bytesOf(restored as Blob)).toEqual(await bytesOf(blob))
  })

  it('refuses to decode when the declared size disagrees', async () => {
    const blob = fakePhoto(7, 512)
    expect(decodePhoto(await blobToBase64(blob), 'image/jpeg', 511)).toBeUndefined()
    expect(decodePhoto('!!!not base64!!!', 'image/jpeg', 12)).toBeUndefined()
  })
})

describe('input size cap', () => {
  it('rejects an oversized file before reading it into memory', async () => {
    const file = new File(['{}'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES + 1 })
    const text = vi.spyOn(file, 'text')

    const result = await readBackupFile(file)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('E_FILE_TOO_LARGE')
    expect(text).not.toHaveBeenCalled()
  })
})

describe('export → import round trip', () => {
  it('restores state and photos byte-for-byte onto a wiped browser', async () => {
    const original: PersistedState = {
      ...populatedState(),
      activeSession: {
        id: 'session-1',
        date: '2026-11-16',
        planSessionId: 'upper-a',
        exerciseNames: ['Incline Dumbbell Press', 'Lat Pulldown'],
        currentIndex: 1,
        startedAt: '2026-11-16T18:00:00.000Z',
      },
    }
    resetStore(original)
    const front = fakePhoto(1, 512)
    const side = fakePhoto(2, 512)
    await set(FRONT, front)
    await set(SIDE, side)

    const file = await backupFile()

    // Simulate site-data wipe: no localStorage, no IndexedDB, empty store.
    await clear()
    localStorage.clear()
    resetStore(EMPTY_STATE)

    const read = await readBackupFile(file)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.value.photos.size).toBe(2)
    expect(read.value.counts).toEqual({
      checklist: 2,
      checkIns: 2,
      strength: 2,
      run: 1,
      photos: 2,
    })

    const outcome = await applyBackup(read.value, 'replace')
    expect(outcome.ok).toBe(true)

    const restored = pickPersisted(useStore.getState())
    expect(withNormalisedPhotoKeys(restored)).toEqual(original)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      state: JSON.parse(JSON.stringify(restored)),
      version: SCHEMA_VERSION,
    })

    // The v3 record fields survive the trip explicitly, not just via the deep equality above.
    const s2 = restored.strengthLog.find((e) => e.id === 's2')
    expect(s2?.sets.map((st) => [st.id, st.kind])).toEqual([
      ['set-1', 'warmup'],
      ['set-2', 'working'],
    ])
    expect(s2?.sessionId).toBe('session-1')
    expect(s2?.updatedAt).toBe('2026-11-16T07:25:00.000Z')
    expect(restored.checklist['2026-11-16']?.autoWorkout).toBe(true)
    expect(restored.checklist['2026-11-15']?.items).toEqual({
      completedWorkout: true,
      noAlcohol: true,
      sleep75Plus: false,
    })
    expect(restored.activeSession).toEqual(original.activeSession)

    const checkIn = restored.checkIns['2026-11-16']
    expect(checkIn?.frontPhotoKey).toMatch(/^photo:2026-11-16:front#[0-9a-z]+-\d+$/)
    expect(checkIn?.sidePhotoKey).toMatch(/^photo:2026-11-16:side#[0-9a-z]+-\d+$/)
    expect(checkIn?.frontPhotoKey).not.toBe(checkIn?.sidePhotoKey)
    expect(await bytesOf((await get<Blob>(checkIn?.frontPhotoKey ?? '')) as Blob)).toEqual(
      await bytesOf(front),
    )
    expect(await bytesOf((await get<Blob>(checkIn?.sidePhotoKey ?? '')) as Blob)).toEqual(
      await bytesOf(side),
    )
  })

  it('exports and re-imports an empty store', async () => {
    resetStore(EMPTY_STATE)
    const file = await backupFile()
    const read = await readBackupFile(file)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.value.photos.size).toBe(0)

    const outcome = await applyBackup(read.value, 'replace')
    expect(outcome.ok).toBe(true)
    expect(pickPersisted(useStore.getState())).toEqual(EMPTY_STATE)
  })

  it('merges a backup into a store that has moved on since the export', async () => {
    const exported = populatedState()
    resetStore(exported)
    await set(FRONT, fakePhoto(1, 512))
    await set(SIDE, fakePhoto(2, 512))
    const file = await backupFile()

    // A run logged after the export must survive the import.
    resetStore({
      ...exported,
      runLog: [
        ...exported.runLog,
        { id: 'r2', date: '2026-11-19', distanceKm: 12, createdAt: '2026-11-19T06:30:00.000Z' },
      ],
    })

    const read = await readBackupFile(file)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const outcome = await applyBackup(read.value, 'merge')
    expect(outcome.ok).toBe(true)

    expect(useStore.getState().runLog.map((e) => e.id)).toEqual(['r2', 'r1'])
    // Local blobs already existed, so nothing needed staging.
    if (!outcome.ok) return
    expect(outcome.report.photoWrites).toEqual([])
    expect(useStore.getState().checkIns['2026-11-16']?.frontPhotoKey).toBe(FRONT)
  })

  it('rejects a backup whose photo does not decode, rather than dropping it', async () => {
    resetStore(populatedState())
    await set(FRONT, fakePhoto(1, 512))
    await set(SIDE, fakePhoto(2, 512))
    const file = await backupFile()

    const doc = JSON.parse(await file.text()) as { photos: Array<{ data: string }> }
    const first = doc.photos[0]
    if (!first) throw new Error('expected a photo in the export')
    // Same length, invalid alphabet — the declared byte count still "fits".
    first.data = '!'.repeat(first.data.length)
    const broken = new File([JSON.stringify(doc)], 'broken.json', { type: 'application/json' })

    const before = pickPersisted(useStore.getState())
    const read = await readBackupFile(broken)

    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.error.code).toBe('E_INVALID')
    expect(pickPersisted(useStore.getState())).toEqual(before)
  })
})

describe('importing a backup written by the v2 build', () => {
  const liveSession = {
    id: 'session-live',
    date: '2026-11-16',
    planSessionId: 'upper-a',
    exerciseNames: ['Bench Press', 'Chest Supported Row'],
    currentIndex: 1,
    startedAt: '2026-11-16T07:00:00.000Z',
  }

  it('reads and merges the remaining slices, ignoring the retired ones', async () => {
    const local: PersistedState = { ...populatedState(), activeSession: liveSession }
    resetStore(local)
    await set(FRONT, fakePhoto(1, 512))
    await set(SIDE, fakePhoto(2, 512))

    const read = await readBackupFile(toFile(legacyBackupDoc(2)))
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.value.schemaVersion).toBe(SCHEMA_VERSION)

    const outcome = await applyBackup(read.value, 'merge')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.report.removed).toBe(0)

    const legacy = legacyState(2)
    const live = useStore.getState()
    expect(live.checklist).toEqual({ ...local.checklist, ...(legacy['checklist'] as object) })
    expect(live.checkIns).toEqual({ ...local.checkIns, ...(legacy['checkIns'] as object) })
    expect(live.strengthLog.map((e) => e.id).sort()).toEqual(['legacy-s1', 's1', 's2'])
    expect(live.runLog.map((e) => e.id).sort()).toEqual(['legacy-r1', 'r1'])
    expect(live.settings).toEqual({})
    expect(live._schemaVersion).toBe(SCHEMA_VERSION)
    expect('benchmark' in live).toBe(false)
    expect('marathonStatus' in live).toBe(false)
    expect(live.activeSession).toEqual(liveSession)
  })

  it('a replace import leaves no activeSession behind', async () => {
    resetStore({ ...populatedState(), activeSession: liveSession })

    const read = await readBackupFile(toFile(legacyBackupDoc(2)))
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const outcome = await applyBackup(read.value, 'replace')
    expect(outcome.ok).toBe(true)

    const live = useStore.getState()
    expect(live.activeSession).toBeUndefined()
    const legacy = legacyState(2)
    expect(live.checklist).toEqual(legacy['checklist'])
    expect(live.runLog).toEqual(legacy['runLog'])
    expect('benchmark' in live).toBe(false)
    expect('marathonStatus' in live).toBe(false)
  })
})
