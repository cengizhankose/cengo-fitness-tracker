import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, CheckRow, Sheet } from '@/components/ui'
import { SetFields, toStrengthSet } from '@/components/strength/SetFields'
import type { SetDraft } from '@/components/strength/SetFields'
import type { ExerciseUnit } from '@/types/plan'
import type { StrengthSet } from '@/types/userData'

export interface SetEditSheetProps {
  /** 1-based number shown in the title. */
  number: number
  set: StrengthSet
  unit: ExerciseUnit
  stepKg?: number
  onSave: (set: StrengthSet) => void
  onDelete: () => void
  onClose: () => void
}

/** Correct or remove one logged set. Mount it only while editing; the draft starts from `set`. */
export function SetEditSheet({ number, set, unit, stepKg, onSave, onDelete, onClose }: SetEditSheetProps) {
  const [draft, setDraft] = useState<SetDraft>({ weightKg: set.weightKg, reps: set.reps, rpe: set.rpe })
  const [warmup, setWarmup] = useState(set.kind === 'warmup')
  const next = toStrengthSet(unit, draft, warmup ? 'warmup' : 'working')

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${number}. seti düzenle`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="danger" size="lg" icon={Trash2} onClick={onDelete}>
            Sil
          </Button>
          <Button
            size="lg"
            disabled={!next}
            onClick={() => next && onSave(set.id ? { ...next, id: set.id } : next)}
          >
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <SetFields unit={unit} value={draft} onChange={setDraft} stepKg={stepKg} idPrefix="edit-set" />
        <CheckRow label="Isınma seti" hint="İlerlemeye sayılmaz" checked={warmup} onChange={setWarmup} />
      </div>
    </Sheet>
  )
}
