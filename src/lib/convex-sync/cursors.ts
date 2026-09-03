import type { SliceName } from './types'

const STORAGE_KEY = 'cengo-convex-sync-cursors'

export interface SliceCursor {
  /** Highest updatedAt of any record this device has successfully pushed for this slice. */
  pushedThrough?: string
  /** Highest updatedAt of any record this device has successfully pulled for this slice. */
  pulledThrough?: string
}

type Cursors = Partial<Record<SliceName, SliceCursor>>

function readAll(): Cursors {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Cursors) : {}
  } catch {
    return {}
  }
}

function writeAll(cursors: Cursors): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cursors))
  } catch {
    // best-effort only (e.g. quota exceeded) — must never break sync or the app
  }
}

export function getCursor(slice: SliceName): SliceCursor {
  return readAll()[slice] ?? {}
}

export function setPushedThrough(slice: SliceName, updatedAt: string): void {
  const all = readAll()
  all[slice] = { ...all[slice], pushedThrough: updatedAt }
  writeAll(all)
}

export function setPulledThrough(slice: SliceName, updatedAt: string): void {
  const all = readAll()
  all[slice] = { ...all[slice], pulledThrough: updatedAt }
  writeAll(all)
}
