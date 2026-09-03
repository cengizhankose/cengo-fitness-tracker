import { useStore, pickPersisted } from '@/store'
import type { DailyChecklistRecord, CheckIn, StrengthLogEntry } from '@/types/userData'
import type { MarathonStatusRecord } from '@/types/marathon'
import { runEntryFromWire, benchmarkFromWire } from './adapters'
import { getCursor, setPulledThrough } from './cursors'
import { mergePulled } from './pullMerge'
import { useSyncStatusStore } from './status'
import { SLICE_NAMES } from './types'
import type { SliceName, SyncedSlices, RunWire, BenchmarkWire } from './types'
import type { SyncClient } from './client'

function keyBy<T>(records: T[], key: (r: T) => string): Record<string, T> {
  const out: Record<string, T> = {}
  for (const r of records) out[key(r)] = r
  return out
}

function highWaterMark(records: Record<string, unknown>[], since: string | undefined): string | undefined {
  let latest = since
  for (const r of records) {
    const u = r.updatedAt
    if (typeof u === 'string' && (!latest || u > latest)) latest = u
  }
  return latest
}

/** Pulls one slice since its local cursor and maps the wire records back to the app's own
 *  types. Advances the pull cursor on success. Lets the caller decide how to handle failure. */
async function pullSlice(client: SyncClient, slice: SliceName): Promise<Partial<SyncedSlices>> {
  const since = getCursor(slice).pulledThrough
  const raw = await client.pull(slice, since)
  if (raw.length === 0) return {}

  const latest = highWaterMark(raw, since)
  if (latest) setPulledThrough(slice, latest)

  switch (slice) {
    case 'checklist':
      return { checklist: keyBy(raw as unknown as DailyChecklistRecord[], (r) => r.date) }
    case 'checkIns':
      return { checkIns: keyBy(raw as unknown as CheckIn[], (r) => r.date) }
    case 'strengthLog':
      return { strengthLog: raw as unknown as StrengthLogEntry[] }
    case 'runLog':
      return { runLog: (raw as unknown as RunWire[]).map(runEntryFromWire) }
    case 'marathonStatus':
      return { marathonStatus: keyBy(raw as unknown as MarathonStatusRecord[], (r) => r.date) }
    case 'benchmark': {
      const wires = raw as unknown as BenchmarkWire[]
      const newest = [...wires].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)
      return newest ? { benchmark: benchmarkFromWire(newest) } : {}
    }
  }
}

/**
 * Best-effort startup pull: fetches whatever changed since each slice's cursor and merges it
 * into the store with the same last-write-wins rules the outbox's writes and backup imports
 * use. Every failure mode is swallowed — an unreachable backend, a slow network, a bad
 * response — so the app always ends up in exactly the state it started in, or better.
 * `client` is undefined when sync is disabled (no backend configured); then this is a no-op.
 */
export async function pullAll(client: SyncClient | undefined): Promise<void> {
  if (!client) return

  useSyncStatusStore.getState().setConnecting()
  let anySucceeded = false
  let pulled: Partial<SyncedSlices> = {}

  for (const slice of SLICE_NAMES) {
    try {
      const part = await pullSlice(client, slice)
      pulled = { ...pulled, ...part }
      anySucceeded = true
    } catch {
      // one slice failing must never block the others or the app
    }
  }

  if (Object.keys(pulled).length > 0) {
    try {
      const local = pickPersisted(useStore.getState())
      const merged = await mergePulled(local, pulled)
      useStore.setState(merged, false)
    } catch {
      // a merge failure must never corrupt local state — leave it untouched
    }
  }

  if (anySucceeded) useSyncStatusStore.getState().setSynced(new Date().toISOString())
  else useSyncStatusStore.getState().setOffline('pull failed')
}
