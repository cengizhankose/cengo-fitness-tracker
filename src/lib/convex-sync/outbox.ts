import {
  checkInToWire,
  runEntryToWire,
  strengthEntryToWire,
  benchmarkToWire,
} from './adapters'
import { getCursor, setPushedThrough } from './cursors'
import { useSyncStatusStore } from './status'
import { SLICE_NAMES } from './types'
import type { SliceName, SyncedSlices } from './types'
import type { SyncClient } from './client'

export const DEFAULT_DEBOUNCE_MS = 1500
export const INITIAL_BACKOFF_MS = 2000
export const MAX_BACKOFF_MS = 60_000

/** Records changed since `since` (exclusive), already mapped to their wire shape. Newly-created
 *  records with no cursor yet (`since` undefined) are all "changed". */
function collectPending(slice: SliceName, state: SyncedSlices, since: string | undefined): unknown[] {
  const isNew = (updatedAt: string) => !since || updatedAt > since
  switch (slice) {
    case 'checklist':
      return Object.values(state.checklist).filter((r) => isNew(r.updatedAt))
    case 'checkIns':
      return Object.values(state.checkIns)
        .filter((r) => isNew(r.updatedAt))
        .map(checkInToWire)
    case 'strengthLog':
      return state.strengthLog.map(strengthEntryToWire).filter((r) => isNew(r.updatedAt))
    case 'runLog':
      return state.runLog.map(runEntryToWire).filter((r) => isNew(r.updatedAt))
    case 'marathonStatus':
      return Object.values(state.marathonStatus).filter((r) => isNew(r.updatedAt))
    case 'benchmark': {
      if (!state.benchmark) return []
      const wire = benchmarkToWire(state.benchmark)
      return isNew(wire.updatedAt) ? [wire] : []
    }
  }
}

function latestUpdatedAt(records: unknown[], fallback: string | undefined): string | undefined {
  let latest = fallback
  for (const r of records) {
    const u = (r as { updatedAt?: unknown }).updatedAt
    if (typeof u === 'string' && (!latest || u > latest)) latest = u
  }
  return latest
}

export interface OutboxHandle {
  stop: () => void
  /** Forces an immediate flush attempt, bypassing the debounce. Best-effort; never throws. */
  flushNow: () => Promise<void>
}

export interface OutboxOptions {
  debounceMs?: number
}

/**
 * Wires a debounced, batched, best-effort push queue into the existing zustand store: any
 * store change schedules a flush; a flush pushes only what changed (per slice, per cursor) and
 * never throws — a failure just marks the status "offline" and retries with exponential backoff.
 * Never blocks a caller: `subscribe`'s listener only schedules a timer.
 */
export function startOutbox(
  client: SyncClient,
  getState: () => SyncedSlices,
  subscribe: (listener: () => void) => () => void,
  opts: OutboxOptions = {},
): OutboxHandle {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let backoffMs = INITIAL_BACKOFF_MS
  let stopped = false
  let flushing = false
  let flushAgain = false

  function scheduleFlush(delay: number): void {
    if (stopped) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => void flush(), delay)
  }

  async function flush(): Promise<void> {
    if (stopped) return
    if (flushing) {
      flushAgain = true
      return
    }
    flushing = true
    try {
      useSyncStatusStore.getState().setConnecting()
      const state = getState()
      let allOk = true
      for (const slice of SLICE_NAMES) {
        const since = getCursor(slice).pushedThrough
        const pending = collectPending(slice, state, since)
        if (pending.length === 0) continue
        try {
          // Each adapter above already produced the correctly-shaped wire record for its
          // slice; client.push's per-slice arg types are erased here for the same reason
          // client.ts's dispatcher is (see its comment) — one loop routes to any of the six.
          await client.push(slice, pending as Record<string, unknown>[])
          const latest = latestUpdatedAt(pending, since)
          if (latest) setPushedThrough(slice, latest)
        } catch {
          allOk = false
        }
      }
      if (allOk) {
        backoffMs = INITIAL_BACKOFF_MS
        useSyncStatusStore.getState().setSynced(new Date().toISOString())
      } else {
        useSyncStatusStore.getState().setOffline('push failed')
        if (retryTimer) clearTimeout(retryTimer)
        const delay = backoffMs
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
        retryTimer = setTimeout(() => void flush(), delay)
      }
    } finally {
      flushing = false
      if (flushAgain) {
        flushAgain = false
        scheduleFlush(0)
      }
    }
  }

  const unsubscribe = subscribe(() => scheduleFlush(debounceMs))

  return {
    stop() {
      stopped = true
      unsubscribe()
      if (debounceTimer) clearTimeout(debounceTimer)
      if (retryTimer) clearTimeout(retryTimer)
    },
    flushNow: flush,
  }
}
