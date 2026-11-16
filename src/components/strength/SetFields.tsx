import { useId } from 'react'
import type { ReactNode } from 'react'
import { NumberField, RpePicker } from '@/components/ui'
import type { ExerciseUnit } from '@/types/plan'
import type { SetKind, StrengthSet } from '@/types/userData'

/** A set being entered: '' = nothing entered yet. */
export interface SetDraft {
  weightKg: number | ''
  reps: number | ''
  rpe?: number
}

export interface SetFieldsProps {
  unit: ExerciseUnit
  value: SetDraft
  onChange: (v: SetDraft) => void
  /** Weight stepper increment. Default 2.5. */
  stepKg?: number
  /** "Geçen sefer: …" under the first field. */
  lastTime?: ReactNode
  /** Prefix for the input ids (several forms on one page). */
  idPrefix?: string
}

const DEFAULT_STEP_KG = 2.5
const SECONDS_STEP = 5

/**
 * The inputs of one strength set, by unit: kg → weight + reps; bodyweight → added load
 * (0 = bodyweight) + reps; seconds → duration only. RPE for all.
 */
export function SetFields({ unit, value, onChange, stepKg = DEFAULT_STEP_KG, lastTime, idPrefix }: SetFieldsProps) {
  const autoId = useId()
  const prefix = idPrefix ?? autoId
  const hasWeight = unit !== 'seconds'

  return (
    <div className="flex flex-col gap-4">
      {hasWeight && (
        <div className="flex flex-col gap-1">
          <NumberField
            id={`${prefix}-weight`}
            label={unit === 'bodyweight' ? 'Ek yük' : 'Ağırlık'}
            unit="kg"
            step={stepKg}
            value={value.weightKg}
            onChange={(weightKg) => onChange({ ...value, weightKg })}
            lastTime={lastTime}
          />
          {unit === 'bodyweight' && <p className="text-sm text-text-muted">0 = vücut ağırlığı</p>}
        </div>
      )}
      <NumberField
        id={`${prefix}-reps`}
        label={unit === 'seconds' ? 'Süre' : 'Tekrar'}
        unit={unit === 'seconds' ? 'sn' : 'tekrar'}
        step={unit === 'seconds' ? SECONDS_STEP : 1}
        value={value.reps}
        onChange={(reps) => onChange({ ...value, reps })}
        lastTime={hasWeight ? undefined : lastTime}
      />
      <RpePicker value={value.rpe} onChange={(rpe) => onChange({ ...value, rpe })} />
    </div>
  )
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
