import { useId } from 'react'
import type { ReactNode } from 'react'
import { NumberField, RpePicker } from '@/components/ui'
import type { ExerciseUnit } from '@/types/plan'
import type { SetDraft } from './setDraft'

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
