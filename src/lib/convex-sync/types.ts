import type { PersistedState } from '@/store'
import type { CheckIn, RunLogEntry, BenchmarkResult } from '@/types/userData'

/** The persisted-state slices this sync layer knows how to push/pull. Settings and
 *  activeSession are deliberately excluded — see convex-sync/README notes in the report. */
export type SliceName =
  | 'checklist'
  | 'checkIns'
  | 'strengthLog'
  | 'runLog'
  | 'marathonStatus'
  | 'benchmark'

export const SLICE_NAMES: readonly SliceName[] = [
  'checklist',
  'checkIns',
  'strengthLog',
  'runLog',
  'marathonStatus',
  'benchmark',
]

/** The subset of PersistedState this layer reads from / writes back into. */
export type SyncedSlices = Pick<PersistedState, SliceName>

/** CheckIn minus the two local-only photo pointers — photos never leave the device. */
export type CheckInWire = Omit<CheckIn, 'frontPhotoKey' | 'sidePhotoKey'>

/** RunLogEntry plus the effective updatedAt the client computed (runs are immutable, so
 *  this is always createdAt) — every wire record needs one for LWW pull/merge. */
export type RunWire = RunLogEntry & { updatedAt: string }

/** BenchmarkResult plus its effective updatedAt (always createdAt — a fresh benchmark always
 *  gets a fresh createdAt, even when it overwrites a previous one). */
export type BenchmarkWire = BenchmarkResult & { updatedAt: string }
