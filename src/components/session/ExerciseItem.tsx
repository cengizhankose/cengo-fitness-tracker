import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, History } from 'lucide-react'
import { Badge, Button, CheckRow, ConfirmDialog, ListRow } from '@/components/ui'
import { cx } from '@/components/ui/cx'
import { SetFields, toStrengthSet } from '@/components/strength/SetFields'
import type { SetDraft } from '@/components/strength/SetFields'
import { formatShortDate } from '@/lib/dates'
import { nextTarget, setKind, warmupWeight } from '@/lib/exerciseStats'
import type { ExerciseSummary, NextTarget } from '@/lib/exerciseStats'
import { formatNumber, formatSetsReps, kg } from '@/lib/format'
import { scrollBehavior } from '@/lib/motion'
import { findPlanExercise } from '@/lib/plan'
import type { ExerciseUnit, PlanExercise } from '@/types/plan'
import type { StrengthSet } from '@/types/userData'
import { SetEditSheet } from './SetEditSheet'
import { formatLoggedSet } from './sessionModel'
import type { SessionExerciseRef } from './sessionModel'

export interface ExerciseItemProps {
  exercise: SessionExerciseRef
  /** Sets this session logged for the exercise (from the store). */
  sets: StrengthSet[]
  /** History WITHOUT this session's own entries. */
  summary: ExerciseSummary
  expanded: boolean
  onExpand: () => void
  /** A new set to append. */
  onLog: (set: StrengthSet) => void
  /** The full corrected set list (edit/remove). */
  onReplaceSets: (sets: StrengthSet[]) => void
}

/** "Hedef 1 × 5 · 80 kg" for an exercise of the plan session. */
function targetLine(planExercise: PlanExercise, target: NextTarget): string {
  const reps = planExercise.reps === 'max' ? 'max' : (target.reps ?? planExercise.reps)
  let line = `Hedef ${formatSetsReps(planExercise.sets, reps, planExercise.unit)}`
  if (target.weightKg != null) {
    if (planExercise.unit === 'kg') line += ` · ${kg(target.weightKg)}`
    else if (planExercise.unit === 'bodyweight' && target.weightKg > 0) line += ` · +${kg(target.weightKg)}`
  }
  return line
}

function hintText(planExercise: PlanExercise, target: NextTarget): string | undefined {
  switch (target.hint) {
    case 'first':
      if (planExercise.unit !== 'kg') return undefined
      return planExercise.startKg != null
        ? 'Şimdiki yükün'
        : 'İlk seans: hedef tekrarı RPE 8 ile çıkaran ağırlığı bul'
    case 'increase': {
      const by = formatNumber(target.increaseBy ?? 0, 2)
      const unit = target.unit === 'kg' ? 'kg' : target.unit === 'seconds' ? 'sn' : 'tekrar'
      return `Geçen sefer kolaydı, +${by} ${unit} dene`
    }
    case 'hold':
      return 'Geçen seferki yük'
  }
}

/** Collapsed-row summary: what this session logged, else the target or last time. */
function collapsedLine(
  sets: StrengthSet[],
  unit: ExerciseUnit,
  planExercise: PlanExercise | undefined,
  target: NextTarget,
  summary: ExerciseSummary,
): string {
  const working = sets.filter((s) => setKind(s) === 'working')
  if (working.length > 0) return working.map((s) => formatLoggedSet(s, unit)).join(', ')
  if (sets.length > 0) return `Isınma: ${sets.map((s) => formatLoggedSet(s, unit)).join(', ')}`
  if (planExercise) return targetLine(planExercise, target)
  const top = summary.last?.topSet
  return top ? `Geçen sefer ${formatLoggedSet(top, unit)}` : 'Henüz kayıt yok'
}

/**
 * One exercise of the running session: a disclosure row that shows what was logged (or the
 * target) when collapsed, and the target, logged sets and set entry when expanded.
 */
export function ExerciseItem({ exercise, sets, summary, expanded, onExpand, onLog, onReplaceSets }: ExerciseItemProps) {
  const { name, planExercise } = exercise
  const unit = planExercise?.unit ?? summary.unit
  const stepKg = (planExercise ?? findPlanExercise(name))?.stepKg
  const target = useMemo(() => nextTarget(planExercise, summary), [planExercise, summary])
  const workingDone = sets.filter((s) => setKind(s) === 'working').length
  const done = planExercise !== undefined && workingDone >= planExercise.sets
  const ref = useRef<HTMLDivElement>(null)
  const panelId = `exercise-panel-${exercise.index}`

  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
  }, [expanded])

  return (
    <div ref={ref} className="scroll-mt-20 scroll-mb-28">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={onExpand}
        className={cx(
          'flex min-h-tap-lg w-full items-center gap-3 px-4 py-3 text-left transition-colors',
          !expanded && 'active:bg-raised',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate font-semibold', expanded ? 'text-lg' : 'text-base')}>{name}</span>
          {!expanded && (
            <span className="block truncate text-sm text-text-muted tabular-nums">
              {collapsedLine(sets, unit, planExercise, target, summary)}
            </span>
          )}
        </span>
        {done && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-volt text-on-volt">
            <Check size={18} strokeWidth={3} aria-hidden />
            <span className="sr-only">tamam</span>
          </span>
        )}
      </button>
      {expanded && (
        <ExercisePanel
          // A fresh panel per logged-set count re-seeds the prefill from the new last set.
          key={sets.length}
          id={panelId}
          exercise={exercise}
          unit={unit}
          stepKg={stepKg}
          sets={sets}
          summary={summary}
          target={target}
          onLog={onLog}
          onReplaceSets={onReplaceSets}
        />
      )}
    </div>
  )
}

interface ExercisePanelProps {
  id: string
  exercise: SessionExerciseRef
  unit: ExerciseUnit
  stepKg?: number
  sets: StrengthSet[]
  summary: ExerciseSummary
  target: NextTarget
  onLog: (set: StrengthSet) => void
  onReplaceSets: (sets: StrengthSet[]) => void
}

function ExercisePanel({ id, exercise, unit, stepKg, sets, summary, target, onLog, onReplaceSets }: ExercisePanelProps) {
  const { name, planExercise } = exercise
  const lastTop = summary.last?.topSet
  const lastWorking = sets.filter((s) => setKind(s) === 'working').at(-1)
  const prefillWeight = lastWorking?.weightKg ?? target.weightKg ?? ''
  const prefillReps =
    typeof planExercise?.reps === 'number' ? (target.reps ?? planExercise.reps) : (lastTop?.reps ?? '')

  const [draft, setDraft] = useState<SetDraft>({ weightKg: prefillWeight, reps: prefillReps })
  const [warmup, setWarmup] = useState(false)
  const [editing, setEditing] = useState<number>()
  const [deleting, setDeleting] = useState<number>()
  const next = toStrengthSet(unit, draft, warmup ? 'warmup' : 'working')
  const hint = planExercise ? hintText(planExercise, target) : undefined

  function toggleWarmup(on: boolean) {
    setWarmup(on)
    // Swap an untouched working load for a warmup load and back.
    if (unit !== 'kg' || prefillWeight === '' || prefillWeight <= 0) return
    const light = warmupWeight(prefillWeight)
    if (on && draft.weightKg === prefillWeight) setDraft({ ...draft, weightKg: light })
    if (!on && draft.weightKg === light) setDraft({ ...draft, weightKg: prefillWeight })
  }

  const editingSet = editing !== undefined ? sets[editing] : undefined
  const deletingSet = deleting !== undefined ? sets[deleting] : undefined

  return (
    <div id={id} className="flex flex-col gap-4 px-4 pb-4">
      {planExercise && (
        <div>
          <p className="num text-num-sm">{targetLine(planExercise, target)}</p>
          {hint && <p className="text-sm text-text-muted">{hint}</p>}
        </div>
      )}

      {sets.length > 0 && (
        <ul aria-label="Bu seansın setleri" className="-mx-4 divide-y divide-border border-y border-border">
          {sets.map((s, i) => (
            <li key={s.id ?? i}>
              <ListRow
                leading={<span className="num w-5 text-text-muted">{i + 1}</span>}
                title={formatLoggedSet(s, unit)}
                trailing={setKind(s) === 'warmup' ? <Badge>Isınma</Badge> : undefined}
                onClick={() => setEditing(i)}
              />
            </li>
          ))}
        </ul>
      )}

      <SetFields
        unit={unit}
        value={draft}
        onChange={setDraft}
        stepKg={stepKg}
        idPrefix={`set-${exercise.index}`}
        lastTime={lastTop && summary.last ? `${formatShortDate(summary.last.date)} · ${formatLoggedSet(lastTop, unit)}` : undefined}
      />
      <CheckRow label="Isınma seti" hint="İlerlemeye sayılmaz" checked={warmup} onChange={toggleWarmup} />
      <Button size="lg" fullWidth disabled={!next} onClick={() => next && onLog(next)}>
        Seti kaydet
      </Button>
      <Button variant="ghost" icon={History} to={`/exercises/${encodeURIComponent(name)}`}>
        Geçmişi gör
      </Button>

      {editingSet && editing !== undefined && (
        <SetEditSheet
          number={editing + 1}
          set={editingSet}
          unit={unit}
          stepKg={stepKg}
          onClose={() => setEditing(undefined)}
          onSave={(updated) => {
            setEditing(undefined)
            onReplaceSets(sets.map((s, i) => (i === editing ? updated : s)))
          }}
          onDelete={() => {
            setEditing(undefined)
            setDeleting(editing)
          }}
        />
      )}
      <ConfirmDialog
        open={deletingSet !== undefined}
        destructive
        title="Set silinsin mi?"
        message={deletingSet ? formatLoggedSet(deletingSet, unit) : undefined}
        confirmLabel="Sil"
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          setDeleting(undefined)
          onReplaceSets(sets.filter((_, i) => i !== deleting))
        }}
      />
    </div>
  )
}
