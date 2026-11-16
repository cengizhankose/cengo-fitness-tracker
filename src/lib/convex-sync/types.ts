import type { PersistedState } from '@/store'
import type { CheckIn, RunLogEntry } from '@/types/userData'

/** The persisted-state slices this sync layer knows how to push/pull. Settings and
 *  activeSession are deliberately excluded — they are device-local. */
export type SliceName = 'checklist' | 'checkIns' | 'strengthLog' | 'runLog'

export const SLICE_NAMES: readonly SliceName[] = ['checklist', 'checkIns', 'strengthLog', 'runLog']

/** The subset of PersistedState this layer reads from / writes back into. */
export type SyncedSlices = Pick<PersistedState, SliceName>

/** CheckIn minus the two local-only photo pointers — photos never leave the device. */
export type CheckInWire = Omit<CheckIn, 'frontPhotoKey' | 'sidePhotoKey'>

/** RunLogEntry plus the effective updatedAt the client computed (runs are immutable, so
 *  this is always createdAt) — every wire record needs one for LWW pull/merge. */
export type RunWire = RunLogEntry & { updatedAt: string }
