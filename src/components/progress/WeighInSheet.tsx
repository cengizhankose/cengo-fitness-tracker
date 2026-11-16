import { useState } from 'react'
import { Button, DateField, NumberField, Sheet, TextField } from '@/components/ui'
import { toLocalISODate } from '@/lib/dates'
import { plan } from '@/lib/plan'
import { latestWeight } from '@/lib/weight'
import { useStore } from '@/store'
import { useCheckIns } from '@/store/selectors'
import { useToast } from '@/store/toast'
import type { IsoDate } from '@/types/userData'
import { formatNumber } from '@/lib/format'

export interface WeighInSheetProps {
  open: boolean
  onClose: () => void
  /** Day to add/edit; default today. */
  date?: IsoDate
}

const WEIGHT_STEP = 0.1
const WAIST_STEP = 0.5

interface Draft {
  date: IsoDate
  weightKg: number | ''
  waistCm: number | ''
  notes: string
  /** Waist and note were loaded from a saved record (not typed for this date). */
  fromRecord: boolean
}

/** Add or edit the weigh-in of one day (default today): weight, optional waist and note. */
export function WeighInSheet({ open, onClose, date }: WeighInSheetProps) {
  if (!open) return null
  // Remounts per open/date, so every opening starts from the day's saved values.
  return <WeighInForm key={date ?? 'today'} onClose={onClose} date={date ?? toLocalISODate()} />
}

function WeighInForm({ onClose, date: initialDate }: { onClose: () => void; date: IsoDate }) {
  const checkIns = useCheckIns()
  const saveCheckIn = useStore((s) => s.saveCheckIn)
  const push = useToast((s) => s.push)
  const today = toLocalISODate()

  const [draft, setDraft] = useState<Draft>(() => {
    const record = checkIns[initialDate]
    return {
      date: initialDate,
      weightKg: record?.weightKg ?? latestWeight(checkIns)?.value ?? plan.goal.startKg,
      waistCm: record?.waistCm ?? '',
      notes: record?.notes ?? '',
      fromRecord: record != null,
    }
  })
  const existing = checkIns[draft.date]
  const canSave = draft.weightKg !== '' && draft.weightKg > 0

  function changeDate(next: IsoDate) {
    setDraft((d) => {
      const record = checkIns[next]
      if (record) {
        return {
          date: next,
          weightKg: record.weightKg ?? d.weightKg,
          waistCm: record.waistCm ?? '',
          notes: record.notes ?? '',
          fromRecord: true,
        }
      }
      // A day without a record keeps the typed weight; values loaded from another day's
      // record are not copied over.
      return d.fromRecord
        ? { date: next, weightKg: d.weightKg, waistCm: '', notes: '', fromRecord: false }
        : { ...d, date: next }
    })
  }

  function save() {
    if (draft.weightKg === '' || draft.weightKg <= 0) return
    const notes = draft.notes.trim()
    saveCheckIn({
      date: draft.date,
      weightKg: draft.weightKg,
      waistCm: draft.waistCm === '' ? undefined : draft.waistCm,
      notes: notes === '' ? undefined : notes,
    })
    push(`Tartı kaydedildi: ${formatNumber(draft.weightKg, 1)} kg`, 'success')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing?.weightKg != null ? 'Tartıyı düzenle' : 'Tartı gir'}
      footer={
        <Button fullWidth size="lg" disabled={!canSave} onClick={save}>
          Kaydet
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <DateField label="Tarih" value={draft.date} max={today} onChange={changeDate} />
        <NumberField
          label="Kilo"
          unit="kg"
          step={WEIGHT_STEP}
          min={30}
          max={300}
          value={draft.weightKg}
          onChange={(weightKg) => setDraft((d) => ({ ...d, weightKg }))}
        />
        <NumberField
          label="Bel (opsiyonel)"
          unit="cm"
          step={WAIST_STEP}
          min={40}
          max={200}
          value={draft.waistCm}
          onChange={(waistCm) => setDraft((d) => ({ ...d, waistCm }))}
        />
        <TextField
          label="Not (opsiyonel)"
          value={draft.notes}
          onChange={(notes) => setDraft((d) => ({ ...d, notes }))}
          maxLength={140}
        />
      </div>
    </Sheet>
  )
}
