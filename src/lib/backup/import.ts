import { delMany, get, getMany, keys, set, setMany } from 'idb-keyval'
import { SCHEMA_VERSION, STORAGE_KEY, pickPersisted, useStore } from '@/store'
import type { PersistedState } from '@/store'
import { MAX_FILE_BYTES, decodePhoto, formatBytes, newStageToken } from './format'
import type { DecodedBackup, ImportError, Result } from './format'
import { mergeState } from './merge'
import type { ImportMode, MergeReport } from './merge'
import { validateBackup } from './validate'

/**
 * Rollback points live in IndexedDB rather than localStorage: localStorage is a
 * ~5 MB origin budget shared with the live state, so putting a snapshot there
 * would risk QuotaExceededError at exactly the moment we're trying to make an
 * import safe — and it can't hold Blobs at all.
 *
 * `orphanPhotoKeys` only scans the `photo:` prefix, so these keys are safe from it.
 */
export const SNAPSHOT_KEY = 'backup:rollback'
/** Reverse snapshot written before a manual rollback, so the rollback is undoable. */
export const UNDO_KEY = 'backup:undo'

export type SnapshotReason = 'pre-import' | 'pre-rollback'

export interface RollbackSnapshot {
  createdAt: string
  reason: SnapshotReason
  /** The exact prior localStorage envelope string, or null if the key was absent. */
  envelope: string | null
  /** The prior in-memory persisted state — restoring storage alone is not enough. */
  state: PersistedState
  /** Photo keys staged after this point; applying the snapshot deletes them again. */
  deleteOnRestore: string[]
  /** Blobs to put back when applying this snapshot (used by the undo direction). */
  restorePhotos: Record<string, Blob>
}

export type ImportOutcome =
  | { ok: true; report: MergeReport }
  | {
      ok: false
      error: ImportError
      /** True when the live data is exactly as it was before the attempt. */
      rolledBack: boolean
    }

export function envelopeFor(state: PersistedState): string {
  return JSON.stringify({ state, version: SCHEMA_VERSION })
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22
  )
}

function failure(err: unknown, rolledBack: boolean): ImportOutcome {
  const intact = rolledBack
    ? 'Your data is unchanged.'
    : 'The rollback also failed — check your rollback point.'
  return {
    ok: false,
    error: {
      code: isQuotaError(err) ? 'E_QUOTA' : 'E_APPLY_FAILED',
      message: isQuotaError(err)
        ? `Ran out of storage space. ${intact}`
        : `The import failed. ${intact}`,
    },
    rolledBack,
  }
}

export async function localPhotoKeys(): Promise<Set<string>> {
  const all = await keys()
  return new Set(all.filter((k): k is string => typeof k === 'string' && k.startsWith('photo:')))
}

// ---- phase 1: read + validate + decode (zero mutation) ----

/**
 * Parse, validate and decode the whole file before anything is written. Every
 * failure here leaves localStorage and IndexedDB byte-identical.
 */
export async function readBackupFile(file: File): Promise<Result<DecodedBackup, ImportError>> {
  // Before file.text(): a multi-hundred-MB file is fatal on a phone the moment it
  // becomes a JS string, and no later check can undo that.
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: {
        code: 'E_FILE_TOO_LARGE',
        message: `That file is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_FILE_BYTES)}.`,
      },
    }
  }

  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return {
      ok: false,
      error: { code: 'E_NOT_JSON', message: "This file isn't a Cengo Cut backup." },
    }
  }

  const validated = validateBackup(raw)
  if (!validated.ok) return validated

  const photos = new Map<string, Blob>()
  for (const photo of validated.value.photos) {
    const blob = decodePhoto(photo.data, photo.mime, photo.bytes)
    if (!blob) {
      // Strict by design: a photo that doesn't decode to exactly its declared size
      // is a damaged file, not something to quietly skip.
      return {
        ok: false,
        error: {
          code: 'E_INVALID',
          message: 'This backup is damaged.',
          issues: [
            { path: `photos["${photo.key}"].data`, expected: `${photo.bytes} bytes`, got: 'undecodable' },
          ],
        },
      }
    }
    photos.set(photo.key, blob)
  }

  return {
    ok: true,
    value: {
      formatVersion: validated.value.formatVersion,
      schemaVersion: validated.value.schemaVersion,
      exportedAt: validated.value.exportedAt,
      counts: validated.value.counts,
      state: validated.value.state,
      photos,
    },
  }
}

// ---- preview (still zero mutation) ----

export interface ImportPreview {
  report: MergeReport
  next: PersistedState
}

export async function previewImport(
  decoded: DecodedBackup,
  mode: ImportMode,
  includeSettings: boolean,
): Promise<ImportPreview> {
  const existing = await localPhotoKeys()
  const { next, report } = mergeState(pickPersisted(useStore.getState()), decoded.state, {
    mode,
    includeSettings,
    localPhotoKeys: existing,
    filePhotoKeys: new Set(decoded.photos.keys()),
    stageToken: 'preview',
  })
  return { report, next }
}

// ---- snapshots ----

/**
 * Apply a snapshot: restore its blobs, drop the ones staged after it, then put
 * back both the in-memory store and the localStorage envelope. In-memory goes
 * before the envelope write because `persist` writes on every `set` — restoring
 * storage first would just be overwritten by the next action against the stale
 * in-memory state.
 */
export async function restoreSnapshot(snapshot: RollbackSnapshot): Promise<void> {
  const restore = Object.entries(snapshot.restorePhotos)
  if (restore.length > 0) await setMany(restore)
  if (snapshot.deleteOnRestore.length > 0) await delMany(snapshot.deleteOnRestore)

  useStore.setState(snapshot.state, false)
  if (snapshot.envelope === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, snapshot.envelope)
}

export async function readSnapshot(): Promise<RollbackSnapshot | undefined> {
  return get<RollbackSnapshot>(SNAPSHOT_KEY)
}

export async function readUndoSnapshot(): Promise<RollbackSnapshot | undefined> {
  return get<RollbackSnapshot>(UNDO_KEY)
}

/**
 * Build the snapshot that would undo `target` — captured *before* `target` is
 * applied, and carrying copies of the blobs `target` is about to delete so the
 * undo can put them back.
 */
async function captureReverse(
  target: RollbackSnapshot,
  now: Date,
): Promise<RollbackSnapshot> {
  const blobs = await getMany<Blob | undefined>(target.deleteOnRestore)
  const restorePhotos: Record<string, Blob> = {}
  for (const [i, key] of target.deleteOnRestore.entries()) {
    const blob = blobs[i]
    if (blob instanceof Blob) restorePhotos[key] = blob
  }
  return {
    createdAt: now.toISOString(),
    reason: 'pre-rollback',
    envelope: localStorage.getItem(STORAGE_KEY),
    state: pickPersisted(useStore.getState()),
    // Undoing never has to delete anything: applying `target` only removes keys.
    deleteOnRestore: [],
    restorePhotos,
  }
}

/**
 * Apply a snapshot as a user-initiated action. Destructive — everything logged
 * since the snapshot is discarded — so a reverse snapshot is written first, both
 * to recover from a failure mid-apply and to let the user undo immediately.
 */
export async function applySnapshot(
  target: RollbackSnapshot,
  reverseKey: string = UNDO_KEY,
  now: Date = new Date(),
): Promise<ImportOutcome> {
  let reverse: RollbackSnapshot | undefined
  try {
    reverse = await captureReverse(target, now)
    await set(reverseKey, reverse)
    await restoreSnapshot(target)
    return { ok: true, report: emptyReport() }
  } catch (err) {
    if (!reverse) return failure(err, true)
    try {
      await restoreSnapshot(reverse)
      return failure(err, true)
    } catch {
      return failure(err, false)
    }
  }
}

function emptyReport(): MergeReport {
  return {
    added: 0,
    updated: 0,
    removed: 0,
    idConflicts: [],
    strippedPhotoRefs: [],
    photoWrites: [],
    settings: 'kept-local',
    benchmark: 'none',
  }
}

// ---- phase 2: apply, with rollback ----

/**
 * Apply a decoded backup.
 *
 * Photos are staged under fresh keys and written before the state. Because no
 * live blob is ever overwritten, the two writes commute: dying in between leaves
 * unreferenced staged blobs (harmless) and never a live check-in pointing at a
 * photo it didn't have. Every step — including the prerequisite reads and the
 * snapshot write — is inside the error boundary.
 */
export async function applyBackup(
  decoded: DecodedBackup,
  mode: ImportMode,
  includeSettings: boolean,
  now: Date = new Date(),
): Promise<ImportOutcome> {
  let snapshot: RollbackSnapshot | undefined
  try {
    const existing = await localPhotoKeys()
    const before = pickPersisted(useStore.getState())

    const filePhotoKeys = new Set(decoded.photos.keys())
    const runMerge = (stageToken: string) =>
      mergeState(before, decoded.state, {
        mode,
        includeSettings,
        localPhotoKeys: existing,
        filePhotoKeys,
        stageToken,
      })

    // Two independent guarantees about the staged destinations, both checked
    // before a single byte is written:
    //   - no destination may duplicate another (that would silently drop a blob),
    //   - no destination may land on a live key (that would break crash safety).
    let merged = runMerge(newStageToken())
    for (let attempt = 0; ; attempt++) {
      const destinations = merged.report.photoWrites.map((w) => w.to)
      if (new Set(destinations).size !== destinations.length) {
        throw new Error('duplicate staged photo destination')
      }
      if (!destinations.some((key) => existing.has(key))) break
      if (attempt >= 8) throw new Error('could not allocate free photo stage keys')
      merged = runMerge(newStageToken())
    }
    const { next, report } = merged

    const writes: Array<[string, Blob]> = []
    for (const stage of report.photoWrites) {
      const blob = decoded.photos.get(stage.from)
      if (blob) writes.push([stage.to, blob])
    }

    snapshot = {
      createdAt: now.toISOString(),
      reason: 'pre-import',
      envelope: localStorage.getItem(STORAGE_KEY),
      state: before,
      deleteOnRestore: writes.map(([key]) => key),
      restorePhotos: {},
    }
    await set(SNAPSHOT_KEY, snapshot)

    if (writes.length > 0) await setMany(writes)
    // In-memory first: `persist` writes on every `set`, so if storage were written
    // first, any action landing in between would serialize the stale state over it.
    useStore.setState(next, false)
    localStorage.setItem(STORAGE_KEY, envelopeFor(next))
    return { ok: true, report }
  } catch (err) {
    // No snapshot yet means nothing was written yet — the data is already intact.
    if (!snapshot) return failure(err, true)
    try {
      await restoreSnapshot(snapshot)
      return failure(err, true)
    } catch {
      return failure(err, false)
    }
  }
}
