import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronLeft, Plus, ArrowRight, Flag, Dumbbell, AlertTriangle } from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { SetRow } from '@/components/SetRow'
import { SetEditor } from '@/components/SetEditor'
import { plan } from '@/lib/plan'
import {
  sessionProgress,
  sessionSets,
  setKind,
  defaultRepsFor,
  parseIntensityRpe,
  suggestedWeight,
  lastWeightForExercise,
} from '@/lib/derive'
import { useStore } from '@/store'
import { useActiveSession, useStrengthLog } from '@/store/selectors'
import { useToast } from '@/store/toast'
import type { StrengthDay, StrengthExercise } from '@/types/plan'
import type { ActiveSession, SetKind, StrengthSet } from '@/types/userData'

const DEFAULT_RPE = 8

interface ResolvedStep {
  index: number
  name: string
  exercise: StrengthExercise
}

export function SessionScreen() {
  const navigate = useNavigate()
  const session = useActiveSession()
  const discardSession = useStore((s) => s.discardSession)
  const push = useToast((s) => s.push)

  // Deliberately not scheduleForDay() — that throws, and a persisted cursor must never
  // be able to crash the screen that is supposed to let you recover from it.
  const day = session ? plan.weeklySchedule.find((d) => d.day === session.dayName) : undefined
  const strengthDay: StrengthDay | undefined = day?.type === 'strength' ? day : undefined

  // Exercises can be renamed or dropped from plan.json while a session is persisted.
  // Skip the ones that no longer exist instead of dead-ending on them.
  const resolved: ResolvedStep[] =
    session && strengthDay
      ? session.exerciseNames.flatMap((name, index) => {
          const exercise = strengthDay.exercises.find((e) => e.name === name)
          return exercise ? [{ index, name, exercise }] : []
        })
      : []

  function discardAndLeave() {
    discardSession()
    push('Workout discarded — your logged sets are safe')
    navigate('/')
  }

  if (!session) {
    return (
      <RecoveryScreen
        title="No active workout"
        hint="Start one from the Today screen."
        actionLabel="Go to Today"
        onAction={() => navigate('/')}
      />
    )
  }

  if (!strengthDay || resolved.length === 0) {
    return (
      <RecoveryScreen
        icon={AlertTriangle}
        title="Workout plan changed"
        hint="None of this workout's exercises are in your plan any more. Sets you already logged are kept."
        actionLabel="Discard workout"
        onAction={discardAndLeave}
      />
    )
  }

  // A cursor pointing at a removed exercise lands on the next surviving one; a cursor
  // past the end of the surviving list lands on the last one, never back at the start.
  const found = resolved.findIndex((s) => s.index >= session.currentIndex)
  const position = found === -1 ? resolved.length - 1 : found
  const current = resolved[position] ?? resolved[0]!

  return (
    <ExerciseStep
      key={current.name}
      session={session}
      day={strengthDay}
      exercise={current.exercise}
      position={position}
      names={resolved.map((s) => s.name)}
      prevIndex={resolved[position - 1]?.index}
      nextIndex={resolved[position + 1]?.index}
      onDiscard={discardAndLeave}
    />
  )
}

interface RecoveryScreenProps {
  icon?: typeof Dumbbell
  title: string
  hint: string
  actionLabel: string
  onAction: () => void
}

function RecoveryScreen({
  icon = Dumbbell,
  title,
  hint,
  actionLabel,
  onAction,
}: RecoveryScreenProps) {
  return (
    <>
      <ScreenHeader title="Workout" />
      <div className="px-4 py-4">
        <EmptyState
          icon={icon}
          title={title}
          hint={hint}
          action={
            <button
              type="button"
              onClick={onAction}
              className="min-h-[44px] rounded-md bg-volt px-4 font-semibold text-on-accent active:bg-volt-dim"
            >
              {actionLabel}
            </button>
          }
        />
      </div>
    </>
  )
}

interface ExerciseStepProps {
  session: ActiveSession
  day: StrengthDay
  exercise: StrengthExercise
  /** 0-based position among the exercises that still exist in the plan. */
  position: number
  /** Names still resolvable in the plan, in session order. */
  names: string[]
  prevIndex?: number
  nextIndex?: number
  onDiscard: () => void
}

/**
 * One exercise of the session. Keyed by exercise name in the parent, so advancing
 * remounts it and the editor re-seeds from the plan + history — no effects needed.
 */
function ExerciseStep({
  session,
  day,
  exercise,
  position,
  names,
  prevIndex,
  nextIndex,
  onDiscard,
}: ExerciseStepProps) {
  const navigate = useNavigate()
  const strengthLog = useStrengthLog()
  const upsertSessionSets = useStore((s) => s.upsertSessionSets)
  const setSessionIndex = useStore((s) => s.setSessionIndex)
  const finishSession = useStore((s) => s.finishSession)
  const push = useToast((s) => s.push)

  // Suggestions come from history only — never from this session's own sets.
  const history = { excludeSessionId: session.id }

  const saved = sessionSets(strengthLog, session.id, exercise.name)
  const warmupDone = saved.filter((s) => setKind(s) === 'warmup').length
  const workingDone = saved.length - warmupDone
  const seedKind: SetKind = exercise.warmupSets > warmupDone ? 'warmup' : 'working'

  const [kind, setKindValue] = useState<SetKind>(seedKind)
  const [weightKg, setWeightKg] = useState<number | ''>(
    () => suggestedWeight(strengthLog, exercise.name, seedKind, history) ?? '',
  )
  const [reps, setReps] = useState(() => defaultRepsFor(exercise.repRange))
  const [rpe, setRpe] = useState(() => parseIntensityRpe(exercise.intensity) ?? DEFAULT_RPE)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Whether the editor holds a row that hasn't been written yet. Seeded true on a fresh
  // exercise so a single tap on "Save & next" logs the suggested set and moves on.
  const [dirty, setDirty] = useState(saved.length === 0)

  const total = names.length
  const isLast = nextIndex == null
  const lastWeight = lastWeightForExercise(strengthLog, exercise.name, history)

  const progressByName = new Map(
    sessionProgress(day, strengthLog, session.id).map((p) => [p.exerciseName, p]),
  )
  const doneCount = names.filter((n) => progressByName.get(n)?.done).length

  // Sets logged today for this exercise outside the session (e.g. from the Log screen).
  const outsideSets = strengthLog
    .filter(
      (e) =>
        e.date === session.date && e.exerciseName === exercise.name && e.sessionId !== session.id,
    )
    .reduce((n, e) => n + e.sets.length, 0)

  function writeSets(sets: StrengthSet[]) {
    upsertSessionSets({
      sessionId: session.id,
      date: session.date,
      exerciseName: exercise.name,
      sets,
    })
  }

  /** Writes the editor row (new or edited). Returns false when the row is incomplete. */
  function commit(): boolean {
    if (weightKg === '' || reps <= 0) return false
    const row = { weightKg: Number(weightKg), reps, rpe, kind }
    writeSets(
      editingId ? saved.map((s) => (s.id === editingId ? { ...s, ...row } : s)) : [...saved, row],
    )
    return true
  }

  function changeKind(next: SetKind) {
    setKindValue(next)
    setDirty(true)
    if (editingId == null) {
      setWeightKg(suggestedWeight(strengthLog, exercise.name, next, history) ?? '')
    }
  }

  function addSet() {
    if (!commit()) {
      push('Enter a weight and reps')
      return
    }
    const addedWarmup = kind === 'warmup' && editingId == null
    setEditingId(null)
    setDirty(false)
    // Once the prescribed warmups are in, flip the editor to working sets.
    if (kind === 'warmup' && warmupDone + (addedWarmup ? 1 : 0) >= exercise.warmupSets) {
      setKindValue('working')
      setWeightKg(suggestedWeight(strengthLog, exercise.name, 'working', history) ?? '')
    }
  }

  function saveAndNext() {
    // An empty weight means "skip" — advance without writing anything.
    if (dirty && weightKg !== '' && !commit()) {
      push('Enter a weight and reps')
      return
    }
    if (nextIndex == null) {
      const completed = finishSession()
      push(
        completed ? 'Workout complete' : 'Workout ended — no working sets logged',
        completed ? 'success' : 'default',
      )
      navigate('/')
      return
    }
    setSessionIndex(nextIndex)
  }

  function editSet(s: StrengthSet) {
    if (!s.id) return
    setEditingId(s.id)
    setKindValue(setKind(s))
    setWeightKg(s.weightKg)
    setReps(s.reps)
    setRpe(s.rpe ?? DEFAULT_RPE)
    setDirty(true)
  }

  function removeSet(s: StrengthSet, index: number) {
    writeSets(saved.filter((x, i) => (s.id ? x.id !== s.id : i !== index)))
    if (editingId && editingId === s.id) {
      setEditingId(null)
      setDirty(false)
    }
  }

  let warmupOrdinal = 0
  let workingOrdinal = 0

  return (
    <>
      <ScreenHeader
        title={exercise.name}
        subtitle={`${day.title} · ${position + 1}/${total}`}
        action={
          <button
            type="button"
            aria-label="Close workout"
            onClick={() => navigate('/')}
            className="grid h-10 w-10 place-items-center rounded-md text-text-muted active:bg-surface-2"
          >
            <X size={20} />
          </button>
        }
      />

      <div className="px-4 pt-3">
        <div className="flex min-h-[40px] items-center justify-between gap-2">
          {prevIndex != null ? (
            <button
              type="button"
              onClick={() => setSessionIndex(prevIndex)}
              className="-ml-2 flex min-h-[40px] items-center gap-0.5 rounded-md px-2 text-sm font-semibold text-text-muted active:bg-surface-2"
            >
              <ChevronLeft size={16} /> Previous
            </button>
          ) : (
            <span />
          )}
          <span className="tnum text-xs text-text-muted">
            {doneCount} of {total} done
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Workout progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          className="mt-2 flex gap-1"
        >
          {names.map((name, i) => (
            <span
              key={name}
              className={`h-1.5 flex-1 rounded-full ${
                progressByName.get(name)?.done
                  ? 'bg-volt'
                  : i === position
                    ? 'bg-volt/40'
                    : 'bg-surface-3'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {exercise.warmupSets > 0 && (
            <Badge tone="muted">
              {warmupDone}/{exercise.warmupSets} warmup
            </Badge>
          )}
          <Badge tone="volt">
            {workingDone}/{exercise.workingSets} × {exercise.repRange}
          </Badge>
          <Badge tone="heat">{exercise.intensity}</Badge>
          {lastWeight != null && (
            <span className="text-xs text-text-faint">last {lastWeight}kg</span>
          )}
        </div>

        <SectionCard title="Sets" icon={Dumbbell} accent="var(--color-volt)">
          {saved.length === 0 ? (
            <p className="py-2 text-sm text-text-muted">No sets yet — log your first one below.</p>
          ) : (
            <ul>
              {saved.map((s, i) => {
                const ordinal = setKind(s) === 'warmup' ? ++warmupOrdinal : ++workingOrdinal
                return (
                  <SetRow
                    key={s.id ?? i}
                    set={s}
                    ordinal={ordinal}
                    selected={editingId != null && editingId === s.id}
                    onEdit={() => editSet(s)}
                    onRemove={() => removeSet(s, i)}
                  />
                )
              })}
            </ul>
          )}
          {outsideSets > 0 && (
            <p className="mt-2 text-xs text-text-muted">
              {outsideSets} more set{outsideSets > 1 ? 's' : ''} logged today outside this workout.
            </p>
          )}
        </SectionCard>

        <SectionCard title={editingId ? 'Edit set' : 'Next set'}>
          <SetEditor
            kind={kind}
            weightKg={weightKg}
            reps={reps}
            rpe={rpe}
            showKindToggle={exercise.warmupSets > 0}
            onKindChange={changeKind}
            onWeightChange={(v) => {
              setWeightKg(v)
              setDirty(true)
            }}
            onRepsChange={(v) => {
              setReps(v)
              setDirty(true)
            }}
            onRpeChange={(v) => {
              setRpe(v)
              setDirty(true)
            }}
          />
        </SectionCard>

        <button
          type="button"
          onClick={onDiscard}
          className="min-h-[44px] w-full rounded-md text-sm font-medium text-text-muted active:bg-surface-2"
        >
          Discard workout (keeps logged sets)
        </button>

        <div className="pb-safe sticky bottom-0 -mx-4 border-t border-border bg-bg/95 px-4 pt-3 backdrop-blur-md">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={addSet}
              className="flex min-h-[56px] w-[38%] shrink-0 items-center justify-center gap-1 rounded-md border border-border-strong text-sm font-semibold text-text active:bg-surface-2"
            >
              <Plus size={18} strokeWidth={2.5} /> {editingId ? 'Update' : 'Add set'}
            </button>
            <button
              type="button"
              onClick={saveAndNext}
              className="flex min-h-[56px] flex-1 items-center justify-center gap-1.5 rounded-md bg-volt text-sm font-semibold text-on-accent active:bg-volt-dim"
            >
              {isLast ? (
                <>
                  <Flag size={18} strokeWidth={2.5} /> Finish workout
                </>
              ) : (
                <>
                  Save &amp; next <ArrowRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
