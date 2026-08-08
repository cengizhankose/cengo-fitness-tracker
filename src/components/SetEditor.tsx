import { Flame, Dumbbell } from 'lucide-react'
import { SegmentedToggle } from '@/components/SegmentedToggle'
import { MetricInput } from '@/components/MetricInput'
import { NumberStepper } from '@/components/NumberStepper'
import type { SetKind } from '@/types/userData'

interface SetEditorProps {
  kind: SetKind
  weightKg: number | ''
  reps: number
  rpe: number
  /** Hide the warmup/working switch for exercises the plan prescribes no warmups for. */
  showKindToggle: boolean
  onKindChange: (kind: SetKind) => void
  onWeightChange: (value: number | '') => void
  onRepsChange: (value: number) => void
  onRpeChange: (value: number) => void
}

const KIND_OPTIONS = [
  { value: 'warmup' as const, label: 'Warmup', icon: Flame },
  { value: 'working' as const, label: 'Working', icon: Dumbbell },
]

export function SetEditor({
  kind,
  weightKg,
  reps,
  rpe,
  showKindToggle,
  onKindChange,
  onWeightChange,
  onRepsChange,
  onRpeChange,
}: SetEditorProps) {
  return (
    <div className="space-y-3">
      {showKindToggle && (
        <SegmentedToggle options={KIND_OPTIONS} value={kind} onChange={onKindChange} />
      )}
      <MetricInput label="Weight" unit="kg" step={2.5} value={weightKg} onChange={onWeightChange} />
      <div className="grid grid-cols-2 gap-3">
        <NumberStepper label="Reps" value={reps} min={1} max={50} onChange={onRepsChange} />
        <NumberStepper label="RPE" value={rpe} min={1} max={10} onChange={onRpeChange} />
      </div>
    </div>
  )
}
