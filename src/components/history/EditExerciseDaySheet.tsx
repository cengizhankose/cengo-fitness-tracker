import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { SetFields, toStrengthSet } from '@/components/strength/SetFields'
import type { SetDraft } from '@/components/strength/SetFields'
import { Badge, Button, ConfirmDialog, DateField, IconButton, Sheet } from '@/components/ui'
import { formatShortDate, toLocalISODate } from '@/lib/dates'
import { exerciseUnit, setKind } from '@/lib/exerciseStats'
import type { ExerciseDay } from '@/lib/exerciseStats'
import { findPlanExercise } from '@/lib/plan'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'
import type { SetKind, StrengthSet } from '@/types/userData'
import { MISSING_SET_MESSAGE } from './format'

export interface EditExerciseDaySheetProps {
  /** Snapshot taken when the sheet opened; mount with a `key` per exercise-day. */
  exerciseDay: ExerciseDay
  onClose: () => void
}

/** One editable set and the log entry it is written back to. */
interface SetRow {
  key: string
  entryId: string
  /** Position in the entry's `sets`; undefined for sets added in this sheet. */
  setIndex?: number
  kind: SetKind
  draft: SetDraft
}

let addedCounter = 0

function sameSets(a: readonly StrengthSet[], b: readonly StrengthSet[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => {
      const o = b[i]
      return (
        o != null &&
        s.weightKg === o.weightKg &&
        s.reps === o.reps &&
        s.rpe === o.rpe &&
        setKind(s) === setKind(o)
      )
    })
  )
}

/**
 * Corrects one exercise on one day: edit, add or remove sets, move the day, or delete it.
 * The day can span several log entries; each set is written back to the entry it came from,
 * added sets go to the last entry and entries left without sets are removed. Entries are
 * never merged or re-created.
 */
export function EditExerciseDaySheet({ exerciseDay, onClose }: EditExerciseDaySheetProps) {
  const { exerciseName, entryIds } = exerciseDay
  const unit = exerciseUnit(exerciseName)
  const stepKg = findPlanExercise(exerciseName)?.stepKg
  const updateStrengthEntry = useStore((s) => s.updateStrengthEntry)
  const removeStrengthEntry = useStore((s) => s.removeStrengthEntry)
  const pushToast = useToast((s) => s.push)

  const [date, setDate] = useState(exerciseDay.date)
  const [rows, setRows] = useState<SetRow[]>(() =>
    exerciseDay.sets.map((s) => ({
      key: `${s.entryId}:${s.setIndex}`,
      entryId: s.entryId,
      setIndex: s.setIndex,
      kind: s.kind,
      draft: { weightKg: s.weightKg, reps: s.reps, rpe: s.rpe },
    })),
  )
  const [error, setError] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const lastEntryId = entryIds[entryIds.length - 1]

  function updateRow(key: string, draft: SetDraft) {
    setError(undefined)
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, draft } : r)))
  }

  function addRow() {
    if (!lastEntryId) return
    const last = rows[rows.length - 1]
    setRows((prev) => [
      ...prev,
      {
        key: `new-${addedCounter++}`,
        entryId: lastEntryId,
        kind: 'working',
        draft: last ? { ...last.draft } : { weightKg: '', reps: '' },
      },
    ])
  }

  function save() {
    const converted = rows.map((row) => ({ row, set: toStrengthSet(unit, row.draft, row.kind) }))
    if (converted.some((c) => c.set === undefined)) {
      setError(MISSING_SET_MESSAGE[unit])
      return
    }
    const log = useStore.getState().strengthLog
    for (const entryId of entryIds) {
      const entry = log.find((e) => e.id === entryId)
      if (!entry) continue
      const sets: StrengthSet[] = []
      for (const { row, set } of converted) {
        if (row.entryId !== entryId || !set) continue
        const raw = row.setIndex != null ? entry.sets[row.setIndex] : undefined
        if (!raw) {
          sets.push(set)
          continue
        }
        // Keep the stored set (id, kind) and only overwrite what the fields edit.
        const next: StrengthSet = { ...raw, weightKg: set.weightKg, reps: set.reps }
        if (set.rpe != null) next.rpe = set.rpe
        else delete next.rpe
        sets.push(next)
      }
      if (sets.length === 0) {
        removeStrengthEntry(entryId)
        continue
      }
      const setsChanged = !sameSets(entry.sets, sets)
      const dateChanged = entry.date !== date
      if (!setsChanged && !dateChanged) continue
      updateStrengthEntry(entryId, {
        ...(setsChanged ? { sets } : {}),
        ...(dateChanged ? { date } : {}),
      })
    }
    pushToast('Kaydedildi', 'success')
    onClose()
  }

  function deleteDay() {
    for (const entryId of entryIds) removeStrengthEntry(entryId)
    setConfirmDelete(false)
    pushToast('Silindi', 'success')
    onClose()
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={exerciseName}
        footer={
          <Button size="lg" fullWidth onClick={save}>
            Kaydet
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <DateField label="Tarih" value={date} max={toLocalISODate()} onChange={setDate} />

          {rows.map((row, i) => (
            <section
              key={row.key}
              aria-label={`Set ${i + 1}`}
              className="flex flex-col gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">Set {i + 1}</h3>
                {row.kind === 'warmup' && <Badge>Isınma</Badge>}
                <IconButton
                  icon={Trash2}
                  variant="danger"
                  aria-label={`Set ${i + 1} sil`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  className="ml-auto"
                />
              </div>
              <SetFields
                unit={unit}
                value={row.draft}
                onChange={(draft) => updateRow(row.key, draft)}
                stepKg={stepKg}
                idPrefix={`duzenle-${row.key}`}
              />
            </section>
          ))}

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <Button variant="secondary" icon={Plus} onClick={addRow}>
            Set ekle
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
            Bu günü sil
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        destructive
        title={`${exerciseName} silinsin mi?`}
        message={`${formatShortDate(exerciseDay.date)} günündeki ${exerciseDay.sets.length} set silinecek.`}
        confirmLabel="Sil"
        onConfirm={deleteDay}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
