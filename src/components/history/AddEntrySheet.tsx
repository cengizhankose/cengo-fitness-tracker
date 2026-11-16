import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { SetFields } from '@/components/strength/SetFields'
import { toStrengthSet } from '@/components/strength/setDraft'
import type { SetDraft } from '@/components/strength/setDraft'
import {
  Button,
  DateField,
  IconButton,
  ListRow,
  NumberField,
  RpePicker,
  SegmentedControl,
  Sheet,
  TextArea,
  TextField,
} from '@/components/ui'
import { toLocalISODate } from '@/lib/dates'
import { allExerciseSummaries, exerciseUnit, lastWorkingSet } from '@/lib/exerciseStats'
import { formatSet, pace } from '@/lib/format'
import { canonicalExerciseName, findPlanExercise } from '@/lib/plan'
import { useStore } from '@/store'
import { useStrengthLog } from '@/store/selectors'
import { useToast } from '@/store/toast'
import type { IsoDate } from '@/types/userData'
import { MISSING_SET_MESSAGE } from './format'

export interface AddEntrySheetProps {
  onClose: () => void
  /** Called with the date of the saved record (the feed jumps there). */
  onSaved: (date: IsoDate) => void
}

type Mode = 'strength' | 'run'

const MODES = [
  { value: 'strength', label: 'Kuvvet' },
  { value: 'run', label: 'Koşu' },
] as const

const FORM_ID = 'gecmis-ekle'
const MAX_MATCHES = 8

/** Back-fills a past workout: a strength exercise with its sets, or a run. Mount while open. */
export function AddEntrySheet({ onClose, onSaved }: AddEntrySheetProps) {
  const [mode, setMode] = useState<Mode>('strength')
  const pushToast = useToast((s) => s.push)

  function saved(date: IsoDate) {
    pushToast('Kaydedildi', 'success')
    onSaved(date)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Kayıt ekle"
      footer={
        <Button type="submit" form={FORM_ID} size="lg" fullWidth>
          Kaydet
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl label="Kayıt türü" options={MODES} value={mode} onChange={setMode} />
        {mode === 'strength' ? <StrengthForm onSaved={saved} /> : <RunForm onSaved={saved} />}
      </div>
    </Sheet>
  )
}

interface DraftRow {
  key: number
  draft: SetDraft
}

function StrengthForm({ onSaved }: { onSaved: (date: IsoDate) => void }) {
  const strengthLog = useStrengthLog()
  const addStrengthEntry = useStore((s) => s.addStrengthEntry)
  const today = toLocalISODate()

  const [date, setDate] = useState<IsoDate>(today)
  const [query, setQuery] = useState('')
  const [exerciseName, setExerciseName] = useState<string>()
  const [rows, setRows] = useState<DraftRow[]>([])
  const [nextKey, setNextKey] = useState(0)
  const [error, setError] = useState<string>()

  const catalog = useMemo(
    () => allExerciseSummaries(strengthLog).map((o) => o.exerciseName),
    [strengthLog],
  )
  const { typed, matches, isKnown } = useMemo(() => {
    const typed = query.trim()
    const needle = typed.toLocaleLowerCase('tr-TR')
    const found = needle ? catalog.filter((n) => n.toLocaleLowerCase('tr-TR').includes(needle)) : catalog
    return {
      typed,
      matches: found.slice(0, MAX_MATCHES),
      isKnown:
        catalog.some((n) => n.toLocaleLowerCase('tr-TR') === needle) || canonicalExerciseName(typed) !== typed,
    }
  }, [catalog, query])

  const unit = exerciseName ? exerciseUnit(exerciseName) : 'kg'
  const last = useMemo(
    () => (exerciseName ? lastWorkingSet(strengthLog, exerciseName) : undefined),
    [strengthLog, exerciseName],
  )

  function choose(name: string) {
    const canonical = canonicalExerciseName(name)
    const chosenUnit = exerciseUnit(canonical)
    const prev = lastWorkingSet(strengthLog, canonical)
    const planned = findPlanExercise(canonical)
    const plannedReps = typeof planned?.reps === 'number' ? planned.reps : ''
    setExerciseName(canonical)
    setError(undefined)
    setRows([
      {
        key: nextKey,
        draft: {
          weightKg: prev?.weightKg ?? (chosenUnit === 'kg' ? (planned?.startKg ?? '') : 0),
          reps: prev?.reps ?? plannedReps,
        },
      },
    ])
    setNextKey((k) => k + 1)
  }

  function addRow() {
    const lastRow = rows[rows.length - 1]
    setRows((prev) => [
      ...prev,
      { key: nextKey, draft: lastRow ? { ...lastRow.draft } : { weightKg: '', reps: '' } },
    ])
    setNextKey((k) => k + 1)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!exerciseName) {
      setError('Bir hareket seç.')
      return
    }
    const sets = rows.map((r) => toStrengthSet(unit, r.draft, 'working'))
    if (sets.length === 0 || sets.some((s) => s === undefined)) {
      setError(MISSING_SET_MESSAGE[unit])
      return
    }
    addStrengthEntry({ date, exerciseName, sets: sets.filter((s) => s !== undefined) })
    onSaved(date)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DateField label="Tarih" value={date} max={today} onChange={setDate} />

      {exerciseName ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-raised px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-muted">Hareket</p>
            <p className="truncate text-base font-semibold">{exerciseName}</p>
          </div>
          <Button variant="ghost" onClick={() => setExerciseName(undefined)}>
            Değiştir
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <TextField
            type="search"
            label="Hareket"
            placeholder="Ara ya da yeni ad yaz"
            value={query}
            onChange={setQuery}
            autoComplete="off"
          />
          <ul aria-label="Hareket seç" className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {matches.map((name) => (
              <li key={name}>
                <ListRow title={name} chevron={false} onClick={() => choose(name)} />
              </li>
            ))}
            {typed && !isKnown && (
              <li>
                <ListRow
                  title={`“${typed}” ekle`}
                  subtitle="Yeni hareket"
                  leading={<Plus size={20} aria-hidden className="text-volt" />}
                  chevron={false}
                  onClick={() => choose(typed)}
                />
              </li>
            )}
          </ul>
        </div>
      )}

      {exerciseName &&
        rows.map((row, i) => (
          <section
            key={row.key}
            aria-label={`Set ${i + 1}`}
            className="flex flex-col gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Set {i + 1}</h3>
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
              onChange={(draft) => {
                setError(undefined)
                setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, draft } : r)))
              }}
              stepKg={findPlanExercise(exerciseName)?.stepKg}
              lastTime={
                i === 0 && last
                  ? `${formatSet(last, unit)}${last.rpe != null ? ` · RPE ${last.rpe}` : ''}`
                  : undefined
              }
              idPrefix={`ekle-${row.key}`}
            />
          </section>
        ))}

      {exerciseName && (
        <Button variant="secondary" icon={Plus} onClick={addRow}>
          Set ekle
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

function RunForm({ onSaved }: { onSaved: (date: IsoDate) => void }) {
  const addRunEntry = useStore((s) => s.addRunEntry)
  const today = toLocalISODate()

  const [date, setDate] = useState<IsoDate>(today)
  const [distanceKm, setDistanceKm] = useState<number | ''>('')
  const [durationMin, setDurationMin] = useState<number | ''>('')
  const [heartRate, setHeartRate] = useState<number | ''>('')
  const [rpe, setRpe] = useState<number>()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string>()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!distanceKm || !durationMin) {
      setError('Mesafe ve süre gir.')
      return
    }
    const note = notes.trim()
    addRunEntry({
      date,
      distanceKm,
      durationMin,
      ...(heartRate ? { averageHeartRate: heartRate } : {}),
      ...(rpe != null ? { rpe } : {}),
      ...(note ? { notes: note } : {}),
    })
    onSaved(date)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DateField label="Tarih" value={date} max={today} onChange={setDate} />
      <NumberField
        label="Mesafe"
        unit="km"
        step={0.1}
        value={distanceKm}
        onChange={(v) => {
          setError(undefined)
          setDistanceKm(v)
        }}
      />
      <NumberField
        label="Süre"
        unit="dk"
        step={1}
        value={durationMin}
        onChange={(v) => {
          setError(undefined)
          setDurationMin(v)
        }}
      />
      {distanceKm && durationMin ? (
        <p className="text-sm text-text-muted">
          Tempo <span className="font-semibold text-text tabular-nums">{pace(distanceKm, durationMin)}</span>
        </p>
      ) : null}
      <NumberField label="Ortalama nabız" unit="bpm" step={1} max={230} value={heartRate} onChange={setHeartRate} />
      <RpePicker value={rpe} onChange={setRpe} />
      <TextArea label="Not" value={notes} onChange={setNotes} rows={2} />
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
