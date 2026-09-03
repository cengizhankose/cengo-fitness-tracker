import { useStore } from '@/store'
import { createSyncClient } from './client'
import { pullAll } from './pull'
import { startOutbox } from './outbox'
import type { OutboxHandle } from './outbox'

export { useSyncStatusStore } from './status'
export type { SyncStatus } from './status'

let handle: OutboxHandle | undefined

/**
 * Call once at app startup. A no-op (status stays 'disabled') when VITE_CONVEX_URL isn't
 * configured — the app then behaves exactly as it did before this layer existed. Otherwise:
 * pulls whatever changed on the backend since last time, merges it in, then starts a debounced
 * outbox that pushes local changes as they happen. Every failure is best-effort and silent —
 * see pull.ts / outbox.ts.
 */
export function initConvexSync(): void {
  if (handle) return // idempotent
  const client = createSyncClient()
  if (!client) return

  void pullAll(client)
  handle = startOutbox(client, () => useStore.getState(), useStore.subscribe)
}

/** Test-only escape hatch to reset module state between test files. */
export function stopConvexSync(): void {
  handle?.stop()
  handle = undefined
}
