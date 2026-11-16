import type { ExerciseUnit } from '@/types/plan'
import type { SetKind, StrengthSet } from '@/types/userData'

/** A set being entered: '' = nothing entered yet. */
export interface SetDraft {
  weightKg: number | ''
  reps: number | ''
  rpe?: number
}

/**
 * The set to store for a draft, or undefined when it can't be logged yet: reps (seconds)
 * must be > 0 and a kg exercise needs a weight. Bodyweight without a load logs 0 kg;
 * timed sets always log 0 kg.
 */
export function toStrengthSet(unit: ExerciseUnit, draft: SetDraft, kind: SetKind = 'working'): StrengthSet | undefined {
  if (draft.reps === '' || draft.reps <= 0) return undefined
  let weightKg: number
  if (unit === 'seconds') weightKg = 0
  else if (draft.weightKg === '') {
    if (unit === 'kg') return undefined
    weightKg = 0
  } else weightKg = draft.weightKg
  const set: StrengthSet = { weightKg, reps: draft.reps, kind }
  if (draft.rpe != null) set.rpe = draft.rpe
  return set
}
