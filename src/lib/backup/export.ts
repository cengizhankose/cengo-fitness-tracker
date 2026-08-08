import { getMany } from 'idb-keyval'
import { SCHEMA_VERSION, pickPersisted, useStore } from '@/store'
import type { PersistedState } from '@/store'
import { FORMAT_VERSION, MAGIC, backupFilename, blobToBase64, isSupportedPhotoMime } from './format'
import type { BackupCounts } from './format'

/** Photo keys the check-ins actually reference, in stable order. */
export function referencedPhotoKeys(state: PersistedState): string[] {
  const keys: string[] = []
  for (const date of Object.keys(state.checkIns).sort()) {
    const checkIn = state.checkIns[date]
    if (!checkIn) continue
    if (checkIn.frontPhotoKey) keys.push(checkIn.frontPhotoKey)
    if (checkIn.sidePhotoKey) keys.push(checkIn.sidePhotoKey)
  }
  return [...new Set(keys)]
}

function countsOf(state: PersistedState, photos: number): BackupCounts {
  return {
    checklist: Object.keys(state.checklist).length,
    checkIns: Object.keys(state.checkIns).length,
    strength: state.strengthLog.length,
    run: state.runLog.length,
    photos,
  }
}

export interface BuiltBackup {
  blob: Blob
  filename: string
  photoCount: number
  bytes: number
  /**
   * Photos whose stored MIME type is outside the importable allowlist. They are
   * still written out verbatim — nothing is invented or dropped — but the user is
   * told now rather than discovering it at restore time.
   */
  unsupportedPhotoKeys: string[]
}

/**
 * Assemble the backup as an array of Blob parts rather than one giant string.
 *
 * The naive route — base64-encode every photo, hold them all, JSON.stringify, then
 * Blob — peaks at many times the archive size in JS heap (base64 is UTF-16 in a JS
 * string, and stringify allocates a second full copy). On mobile Safari that is an
 * uncatchable OOM, not an exception. Encoding one photo at a time and handing each
 * straight to a Blob keeps the peak at roughly one photo.
 */
export async function buildBackup(now: Date = new Date()): Promise<BuiltBackup> {
  const state = pickPersisted(useStore.getState())
  const keys = referencedPhotoKeys(state)
  const blobs = await getMany<Blob | undefined>(keys)

  const present: Array<{ key: string; blob: Blob }> = []
  for (const [i, key] of keys.entries()) {
    const blob = blobs[i]
    if (blob instanceof Blob) present.push({ key, blob })
  }

  const header = {
    magic: MAGIC,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    counts: countsOf(state, present.length),
    state,
  }
  const headerJson = JSON.stringify(header)
  // Splice the photo array onto the header object without re-serializing anything.
  const parts: BlobPart[] = [`${headerJson.slice(0, -1)},"photos":[`]

  const unsupportedPhotoKeys: string[] = []
  for (const [i, { key, blob }] of present.entries()) {
    // A blob with no type at all is one we wrote ourselves via canvas.toBlob.
    const mime = blob.type || 'image/jpeg'
    if (!isSupportedPhotoMime(mime)) unsupportedPhotoKeys.push(key)
    const base64 = await blobToBase64(blob)
    const prefix =
      `${i ? ',' : ''}{"key":${JSON.stringify(key)},` +
      `"mime":${JSON.stringify(mime)},"bytes":${blob.size},"data":"`
    parts.push(new Blob([prefix, base64, '"}']))
    // `base64` goes out of scope here — the browser owns those bytes now.
  }
  parts.push(']}')

  const blob = new Blob(parts, { type: 'application/json' })
  return {
    blob,
    filename: backupFilename(now),
    photoCount: present.length,
    bytes: blob.size,
    unsupportedPhotoKeys,
  }
}

/**
 * Save the file. `<a download>` is unreliable inside an iOS standalone PWA (it can
 * navigate the app away), so try the share sheet first when it accepts files.
 */
export async function saveBackup(built: BuiltBackup): Promise<void> {
  const file = new File([built.blob], built.filename, { type: 'application/json' })
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: built.filename })
      return
    } catch (err) {
      // User dismissed the sheet, or the platform refused — fall through to download.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(built.blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = built.filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Give the click a tick to start the download before the URL dies.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
