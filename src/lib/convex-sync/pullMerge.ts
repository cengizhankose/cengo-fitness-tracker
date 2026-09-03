import { keys } from 'idb-keyval'
import { mergeState } from '@/lib/backup/merge'
import { newStageToken } from '@/lib/backup/format'
import type { PersistedState } from '@/store'
import type { SyncedSlices } from './types'

/**
 * Merges freshly-pulled records into `local` using the exact same last-write-wins rules the
 * backup import path already relies on (mergeState) — no parallel merge logic. Only the slices
 * present in `pulled` are compared; anything omitted is treated as "nothing new for this slice"
 * (mergeState's `merge` mode never removes a local record that has no incoming counterpart).
 * Settings and activeSession are never touched — they aren't synced.
 */
export async function mergePulled(
  local: PersistedState,
  pulled: Partial<SyncedSlices>,
): Promise<PersistedState> {
  const incoming: PersistedState = {
    ...local,
    checklist: pulled.checklist ?? {},
    checkIns: pulled.checkIns ?? {},
    strengthLog: pulled.strengthLog ?? [],
    runLog: pulled.runLog ?? [],
    marathonStatus: pulled.marathonStatus ?? {},
    benchmark: pulled.benchmark,
  }

  const allKeys = (await keys()) as unknown[]
  const localPhotoKeys = new Set(
    allKeys.filter((k): k is string => typeof k === 'string' && k.startsWith('photo:')),
  )

  const { next } = mergeState(local, incoming, {
    mode: 'merge',
    includeSettings: false,
    localPhotoKeys,
    filePhotoKeys: new Set(), // pulled checkIns never carry photo keys (local-only)
    stageToken: newStageToken(),
  })
  return next
}
