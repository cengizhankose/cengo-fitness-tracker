import { afterEach, describe, expect, it, vi } from 'vitest'
import { clear, get, set } from 'idb-keyval'
import { STORAGE_KEY, pickPersisted, useStore } from '@/store'
import type { PersistedState } from '@/store'
import { buildBackup } from './export'
import {
  SNAPSHOT_KEY,
  UNDO_KEY,
  applyBackup,
  applySnapshot,
  envelopeFor,
  readBackupFile,
  readSnapshot,
  readUndoSnapshot,
} from './import'
import type { DecodedBackup } from './format'
import { bytesOf, fakePhoto, makeState, populatedState, resetStore } from '@/test/fixtures'

/** Number of upcoming setMany calls to reject — the rollback's own writes must succeed. */
const hooks = vi.hoisted(() => ({ failSetMany: 0 }))

vi.mock('idb-keyval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('idb-keyval')>()
  return {
    ...actual,
    setMany: async (entries: Array<[IDBValidKey, unknown]>) => {
      if (hooks.failSetMany > 0) {
        hooks.failSetMany--
        throw new DOMException('out of space', 'QuotaExceededError')
      }
      return actual.setMany(entries)
    },
  }
})

const FRONT = 'photo:2026-08-03:front'
const NEW_PHOTO = 'photo:2026-08-10:front'

/** The state the backup file carries: a photo for a date the local state also has, plus a new one. */
function incomingState(): PersistedState {
  return makeState({
    settings: { programStartDate: '2026-05-11' },
    checkIns: {
      '2026-08-03': {
        date: '2026-08-03',
        weightKg: 88,
        frontPhotoKey: FRONT,
        createdAt: '2026-08-03T07:00:00.000Z',
        updatedAt: '2026-09-01T07:00:00.000Z',
      },
      '2026-08-10': {
        date: '2026-08-10',
        weightKg: 87,
        frontPhotoKey: NEW_PHOTO,
        createdAt: '2026-08-10T07:00:00.000Z',
        updatedAt: '2026-08-10T07:00:00.000Z',
      },
    },
    runLog: [
      { id: 'r-new', date: '2026-08-10', distanceKm: 21.1, createdAt: '2026-08-10T06:00:00.000Z' },
    ],
  })
}

/**
 * Build a real backup file from `incomingState`, then restore the world to
 * `local` with its own photo in place. Returns the decoded backup, ready to apply.
 */
async function stage(local: PersistedState): Promise<{ decoded: DecodedBackup; localFront: Blob }> {
  resetStore(incomingState())
  await set(FRONT, fakePhoto(2, 256))
  await set(NEW_PHOTO, fakePhoto(3, 256))
  const built = await buildBackup(new Date('2026-09-01T10:00:00.000Z'))
  const file = new File([built.blob], built.filename, { type: 'application/json' })

  await clear()
  localStorage.clear()
  resetStore(local)
  const localFront = fakePhoto(1, 256)
  await set(FRONT, localFront)
  localStorage.setItem(STORAGE_KEY, envelopeFor(local))

  const read = await readBackupFile(file)
  if (!read.ok) throw new Error(`fixture backup did not validate: ${read.error.code}`)
  return { decoded: read.value, localFront }
}

/** Fail the first localStorage write that carries imported data — i.e. after setState. */
function failAfterStateCommit(marker: string): { stateAtFailure: () => PersistedState | undefined } {
  let captured: PersistedState | undefined
  let thrown = false
  // Spy on the prototype, not on `localStorage` itself: jsdom's Storage is a
  // Proxy whose defineProperty trap would turn the spy into a stored item.
  const real = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (!thrown && this === localStorage && key === STORAGE_KEY && value.includes(marker)) {
      thrown = true
      captured = pickPersisted(useStore.getState())
      throw new DOMException('out of space', 'QuotaExceededError')
    }
    real.call(this, key, value)
  })
  return { stateAtFailure: () => captured }
}

afterEach(() => {
  hooks.failSetMany = 0
  vi.restoreAllMocks()
})

describe('import never overwrites a live photo', () => {
  it('stages incoming blobs under fresh keys and leaves the originals alone', async () => {
    const local = populatedState()
    const { decoded, localFront } = await stage(local)

    const outcome = await applyBackup(decoded, 'replace', true)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    for (const write of outcome.report.photoWrites) {
      expect(write.to).not.toBe(write.from)
      expect(write.to.startsWith(`${write.from.split('#')[0]}#`)).toBe(true)
    }
    // The pre-existing blob under the canonical key is untouched.
    expect(await bytesOf((await get<Blob>(FRONT)) as Blob)).toEqual(await bytesOf(localFront))
  })

  /**
   * The crash window: photos are committed, the process dies before the state is.
   * The still-live old state must resolve to its own photos, not the imported ones.
   */
  it('leaves only harmless orphans if it dies between the photo and state writes', async () => {
    const local = populatedState()
    const { decoded, localFront } = await stage(local)
    const envelope = localStorage.getItem(STORAGE_KEY)

    // Kill the run at the first state write, and block the rollback too, so what
    // remains is exactly the on-disk situation after a crash.
    failAfterStateCommit('"r-new"')
    const outcome = await applyBackup(decoded, 'replace', true)
    expect(outcome.ok).toBe(false)

    // Reload from storage the way a fresh boot would.
    const persisted = JSON.parse(envelope ?? 'null') as { state: PersistedState }
    resetStore(persisted.state)

    const checkIn = useStore.getState().checkIns['2026-08-03']
    expect(checkIn?.frontPhotoKey).toBe(FRONT)
    // The old state still shows the *old* photo — the whole point of staging.
    expect(await bytesOf((await get<Blob>(FRONT)) as Blob)).toEqual(await bytesOf(localFront))

    // Anything the import did write is unreferenced by the live state.
    const referenced = new Set(
      Object.values(useStore.getState().checkIns).flatMap((c) =>
        [c.frontPhotoKey, c.sidePhotoKey].filter((k): k is string => Boolean(k)),
      ),
    )
    const staged = (await get<{ deleteOnRestore: string[] }>(SNAPSHOT_KEY))?.deleteOnRestore ?? []
    expect(staged.length).toBeGreaterThan(0)
    for (const key of staged) expect(referenced.has(key)).toBe(false)
  })
})

describe('rollback', () => {
  it('leaves everything untouched when the photo write fails before any state write', async () => {
    const local = populatedState()
    const { decoded, localFront } = await stage(local)
    const envelope = localStorage.getItem(STORAGE_KEY)

    hooks.failSetMany = 1
    const outcome = await applyBackup(decoded, 'replace', true)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.code).toBe('E_QUOTA')
    expect(outcome.rolledBack).toBe(true)
    expect(pickPersisted(useStore.getState())).toEqual(local)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(await bytesOf((await get<Blob>(FRONT)) as Blob)).toEqual(await bytesOf(localFront))
    expect(await get(NEW_PHOTO)).toBeUndefined()
  })

  // The regression this test exists for: applyBackup writes the in-memory store
  // *before* the canonical localStorage write, so a failure at that point leaves a
  // live store holding imported data. Rolling back storage alone is not enough.
  it('restores the in-memory store when the write fails after setState', async () => {
    const local = populatedState()
    const { decoded, localFront } = await stage(local)
    const envelope = localStorage.getItem(STORAGE_KEY)
    const { stateAtFailure } = failAfterStateCommit('"r-new"')

    const outcome = await applyBackup(decoded, 'replace', true)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.rolledBack).toBe(true)

    // The store really did hold the imported data at the moment of failure —
    // otherwise this test would pass vacuously.
    expect(stateAtFailure()).toBeDefined()
    expect(stateAtFailure()?.runLog.map((e) => e.id)).toEqual(['r-new'])
    expect(stateAtFailure()?.settings.programStartDate).toBe('2026-05-11')

    // ...and both halves of the world are back where they started.
    expect(pickPersisted(useStore.getState())).toEqual(local)
    expect(useStore.getState().runLog.map((e) => e.id)).toEqual(['r1'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(await bytesOf((await get<Blob>(FRONT)) as Blob)).toEqual(await bytesOf(localFront))
  })

  it('deletes every staged photo when it rolls back', async () => {
    const { decoded } = await stage(populatedState())
    failAfterStateCommit('"r-new"')

    const outcome = await applyBackup(decoded, 'replace', true)
    expect(outcome.ok).toBe(false)

    const snapshot = await readSnapshot()
    expect(snapshot?.deleteOnRestore.length).toBeGreaterThan(0)
    for (const key of snapshot?.deleteOnRestore ?? []) {
      expect(await get(key)).toBeUndefined()
    }
  })

  it('reports data intact when it fails before the snapshot is written', async () => {
    const local = populatedState()
    const { decoded } = await stage(local)
    const envelope = localStorage.getItem(STORAGE_KEY)
    const failure = new Error('idb unavailable')
    vi.spyOn(useStore, 'getState').mockImplementationOnce(() => {
      throw failure
    })

    const outcome = await applyBackup(decoded, 'replace', true)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.code).toBe('E_APPLY_FAILED')
    expect(outcome.rolledBack).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(await get(SNAPSHOT_KEY)).toBeUndefined()
  })
})

describe('manual rollback', () => {
  it('takes a reverse snapshot first, and the rollback is undoable', async () => {
    const local = populatedState()
    const { decoded, localFront } = await stage(local)
    const localEnvelope = localStorage.getItem(STORAGE_KEY)

    const imported = await applyBackup(decoded, 'replace', true)
    expect(imported.ok).toBe(true)
    const importedState = pickPersisted(useStore.getState())
    const importedEnvelope = localStorage.getItem(STORAGE_KEY)
    const stagedKey = importedState.checkIns['2026-08-10']?.frontPhotoKey
    expect(stagedKey).toBeDefined()
    expect(await get(stagedKey ?? '')).toBeDefined()

    const snapshot = await readSnapshot()
    expect(snapshot).toBeDefined()
    if (!snapshot) return

    // --- roll back ---
    const rolled = await applySnapshot(snapshot)
    expect(rolled.ok).toBe(true)
    expect(pickPersisted(useStore.getState())).toEqual(local)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(localEnvelope)
    expect(await bytesOf((await get<Blob>(FRONT)) as Blob)).toEqual(await bytesOf(localFront))
    expect(await get(stagedKey ?? '')).toBeUndefined()

    // --- undo the rollback ---
    const undo = await readUndoSnapshot()
    expect(undo).toBeDefined()
    expect(undo?.reason).toBe('pre-rollback')
    if (!undo) return

    const undone = await applySnapshot(undo)
    expect(undone.ok).toBe(true)
    expect(pickPersisted(useStore.getState())).toEqual(importedState)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(importedEnvelope)
    // The staged blob the rollback deleted is back.
    expect(await get(stagedKey ?? '')).toBeDefined()
  })

  it('restores the pre-rollback state when applying the snapshot fails', async () => {
    const { decoded } = await stage(populatedState())
    await applyBackup(decoded, 'replace', true)
    const importedState = pickPersisted(useStore.getState())
    const importedEnvelope = localStorage.getItem(STORAGE_KEY)

    const snapshot = await readSnapshot()
    if (!snapshot) throw new Error('expected a snapshot')

    // The reverse capture succeeds; applying the target then fails.
    failAfterStateCommit('"s1"')
    const outcome = await applySnapshot(snapshot)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.rolledBack).toBe(true)
    expect(pickPersisted(useStore.getState())).toEqual(importedState)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(importedEnvelope)
  })

  it('keeps the snapshot keys outside the photo: keyspace so photo GC cannot touch them', async () => {
    const { decoded } = await stage(populatedState())
    await applyBackup(decoded, 'replace', true)
    expect(SNAPSHOT_KEY.startsWith('photo:')).toBe(false)
    expect(UNDO_KEY.startsWith('photo:')).toBe(false)
    expect(await get(SNAPSHOT_KEY)).toBeDefined()
  })

  it('snapshots an absent envelope as null and clears it on restore', async () => {
    const { decoded } = await stage(populatedState())
    localStorage.removeItem(STORAGE_KEY)

    const outcome = await applyBackup(decoded, 'replace', true)
    expect(outcome.ok).toBe(true)

    const snapshot = await readSnapshot()
    expect(snapshot?.envelope).toBeNull()
    if (!snapshot) return

    await applySnapshot(snapshot)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
