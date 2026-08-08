import type { PersistedState } from '@/store'

/** File identity — anything else is rejected outright, never heuristically imported. */
export const MAGIC = 'cengo-cut-backup'
/** Version of the *backup file layout*. Import requires an exact match. */
export const FORMAT_VERSION = 1

// ---- hard input limits ----
// Every one of these is checked before a single byte is written, and the file-size
// cap is checked before the file is even read into a string: a phone has to survive
// a hostile or corrupt file, and `file.text()` on a 500 MB file is already fatal.

/** Checked against `file.size` before `file.text()`. */
export const MAX_FILE_BYTES = 64 * 1024 * 1024
export const MAX_PHOTOS = 200
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const MAX_TOTAL_PHOTO_BYTES = 48 * 1024 * 1024
export const MAX_MAP_ENTRIES = 20_000
export const MAX_LOG_ENTRIES = 50_000
export const MAX_SETS_PER_ENTRY = 200
export const MAX_NOTES_CHARS = 10_000
export const MAX_NAME_CHARS = 200
export const MAX_ID_CHARS = 128

export const SUPPORTED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type PhotoMime = (typeof SUPPORTED_PHOTO_MIMES)[number]

export function isSupportedPhotoMime(v: unknown): v is PhotoMime {
  return typeof v === 'string' && (SUPPORTED_PHOTO_MIMES as readonly string[]).includes(v)
}

/**
 * Photo keys are `photo:<date>:<slot>`, optionally with a `#token-index` suffix
 * added when an import stages a blob. Both forms are accepted; nothing else is.
 */
export const PHOTO_KEY_RE = /^photo:(\d{4}-\d{2}-\d{2}):(front|side)(?:#([0-9a-z][0-9a-z-]{0,39}))?$/

export type PhotoSlot = 'front' | 'side'

export function isPhotoKey(v: unknown): v is string {
  return typeof v === 'string' && PHOTO_KEY_RE.test(v)
}

/** The date and slot a photo key claims to belong to. */
export function parsePhotoKey(key: string): { date: string; slot: PhotoSlot } | undefined {
  const match = PHOTO_KEY_RE.exec(key)
  if (!match?.[1] || !match[2]) return undefined
  return { date: match[1], slot: match[2] as PhotoSlot }
}

/**
 * Strip any existing stage token, then attach this import's token plus a
 * per-source index.
 *
 * The index is what makes the destination unique: without it, two distinct
 * accepted sources that differ only by their existing `#token`
 * (`photo:D:front` and `photo:D:front#abc`) would both reduce to the same base
 * and collide, and one blob would silently overwrite the other mid-import.
 */
export function stagedPhotoKey(key: string, token: string, index: number): string {
  const suffix = `${token}-${index}`
  const match = PHOTO_KEY_RE.exec(key)
  if (!match) return `${key}#${suffix}`
  return `photo:${match[1]}:${match[2]}#${suffix}`
}

export function newStageToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
}

export interface BackupPhoto {
  key: string
  mime: PhotoMime
  bytes: number
  /** Raw base64 — no `data:` URL prefix. */
  data: string
}

export interface BackupCounts {
  checklist: number
  checkIns: number
  strength: number
  run: number
  photos: number
}

export interface BackupFile {
  magic: typeof MAGIC
  formatVersion: number
  schemaVersion: number
  exportedAt: string
  counts: BackupCounts
  state: PersistedState
  photos: BackupPhoto[]
}

/** A validated + decoded backup, held in memory. Photos are real Blobs by now. */
export interface DecodedBackup {
  formatVersion: number
  schemaVersion: number
  exportedAt: string
  counts: BackupCounts
  state: PersistedState
  photos: Map<string, Blob>
}

export type ImportErrorCode =
  | 'E_NOT_JSON'
  | 'E_BAD_MAGIC'
  | 'E_FORMAT_NEWER'
  | 'E_FORMAT_UNSUPPORTED'
  | 'E_SCHEMA_MISMATCH'
  | 'E_FILE_TOO_LARGE'
  | 'E_TOO_LARGE'
  | 'E_INVALID'
  | 'E_QUOTA'
  | 'E_APPLY_FAILED'

export interface ImportError {
  code: ImportErrorCode
  message: string
  /** Up to 5 offending JSON paths, for E_INVALID. */
  issues?: ValidationIssue[]
}

export interface ValidationIssue {
  path: string
  expected: string
  got: string
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

/** Survives the post-import reload so the app can toast the summary once. */
export const IMPORT_RESULT_KEY = 'cengo-import-result'

/** `cengo-cut-backup-2026-08-08-1642.json` — local wall-clock, matching toLocalISODate(). */
export function backupFilename(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}`
  return `cengo-cut-backup-${stamp}.json`
}

/** Canonical `new Date().toISOString()` output — the only timestamp form this app writes. */
export function isIsoTimestamp(v: unknown): v is string {
  if (typeof v !== 'string' || v.length !== 24) return false
  const d = new Date(v)
  return !Number.isNaN(d.getTime()) && d.toISOString() === v
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

/** Byte length a base64 string decodes to, or undefined if it isn't valid base64. */
export function base64DecodedLength(data: string): number | undefined {
  if (data.length === 0 || data.length % 4 !== 0 || !BASE64_RE.test(data)) return undefined
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
  return (data.length / 4) * 3 - padding
}

/**
 * Blob → raw base64. Uses FileReader rather than
 * `btoa(String.fromCharCode(...bytes))`, which blows the call stack on a
 * 250 KB array (spread → 250k arguments).
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const url = String(reader.result)
      const comma = url.indexOf(',')
      resolve(comma === -1 ? '' : url.slice(comma + 1))
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Raw base64 → Blob, only if it decodes to exactly `expectedBytes`. Decodes in
 * chunks so a large photo never builds one huge intermediate array, and refuses
 * to allocate at all when the declared length already disagrees.
 */
export function decodePhoto(
  data: string,
  mime: PhotoMime,
  expectedBytes: number,
): Blob | undefined {
  if (base64DecodedLength(data) !== expectedBytes) return undefined
  let binary: string
  try {
    binary = atob(data)
  } catch {
    return undefined
  }
  if (binary.length !== expectedBytes) return undefined
  const CHUNK = 8192
  const parts: Uint8Array[] = []
  for (let offset = 0; offset < binary.length; offset += CHUNK) {
    const slice = binary.slice(offset, offset + CHUNK)
    const bytes = new Uint8Array(slice.length)
    for (let i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i)
    parts.push(bytes)
  }
  const blob = new Blob(parts as BlobPart[], { type: mime })
  return blob.size === expectedBytes ? blob : undefined
}

/** Human-readable size for the UI ("9.1 MB"). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
