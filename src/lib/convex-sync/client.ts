import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import type { SliceName } from './types'

/** Narrow, easily-mockable surface the rest of this layer talks to. Keeps every generic
 *  FunctionReference-typed call in this one file. */
export interface SyncClient {
  pull(slice: SliceName, updatedSince: string | undefined): Promise<Record<string, unknown>[]>
  push(slice: SliceName, records: Record<string, unknown>[]): Promise<void>
  syncStateCursor(slice: SliceName): Promise<string | undefined>
}

const PULL_REF = {
  checklist: api.checklist.pull,
  checkIns: api.checkIns.pull,
  strengthLog: api.strengthLog.pull,
  runLog: api.runLog.pull,
  marathonStatus: api.marathonStatus.pull,
  benchmark: api.benchmark.pull,
}

const UPSERT_REF = {
  checklist: api.checklist.upsertBatch,
  checkIns: api.checkIns.upsertBatch,
  strengthLog: api.strengthLog.upsertBatch,
  runLog: api.runLog.upsertBatch,
  marathonStatus: api.marathonStatus.upsertBatch,
  benchmark: api.benchmark.upsertBatch,
}

/** Vite exposes only VITE_-prefixed vars to client code — never the admin key (CLI-only). */
export function getConvexUrl(): string | undefined {
  return import.meta.env.VITE_CONVEX_URL as string | undefined
}

/** The shared app-level auth secret every public function now requires. Distinct from the
 *  Convex admin key: this is a low-stakes, rotatable value meant to sit in client-bundle JS. */
export function getSyncSecret(): string | undefined {
  return import.meta.env.VITE_SYNC_SECRET as string | undefined
}

export function makeHttpSyncClient(url: string, syncSecret: string): SyncClient {
  const client = new ConvexHttpClient(url)
  return {
    async pull(slice, updatedSince) {
      return client.query(PULL_REF[slice], { updatedSince, syncSecret })
    },
    async push(slice, records) {
      // Each slice's mutation validates its own record shape server-side (convex/*.ts); this
      // dispatcher is deliberately shape-erased so one function can route to any of the six.
      await client.mutation(UPSERT_REF[slice], { records, syncSecret } as never)
    },
    async syncStateCursor(slice) {
      const cursor = await client.query(api.syncState.get, { slice, syncSecret })
      return cursor ?? undefined
    },
  }
}

/** undefined when no backend is configured, or no secret is configured — every caller must
 *  treat that as "sync disabled", same graceful-degradation contract as a missing URL. */
export function createSyncClient(): SyncClient | undefined {
  const url = getConvexUrl()
  const syncSecret = getSyncSecret()
  return url && syncSecret ? makeHttpSyncClient(url, syncSecret) : undefined
}
