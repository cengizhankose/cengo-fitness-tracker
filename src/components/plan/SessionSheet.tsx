import { useId, useMemo } from 'react'
import { Play } from 'lucide-react'
import { Badge, Button, Sheet } from '@/components/ui'
import { useStartSession } from '@/components/session/useStartSession'
import { formatActivityDuration } from '@/lib/activities'
import { formatShortDate } from '@/lib/dates'
import { exerciseSummary, nextTarget } from '@/lib/exerciseStats'
import type { NextTarget } from '@/lib/exerciseStats'
import { formatSet, formatSetsReps, kg } from '@/lib/format'
import { sessionById, sessionExercises } from '@/lib/plan'
import { useStrengthLog } from '@/store/selectors'
import type { PlanExercise, SessionId } from '@/types/plan'
import type { StrengthLogEntry } from '@/types/userData'

export interface SessionSheetProps {
  /** Session to show; the sheet is closed while undefined. */
  sessionId?: SessionId
  onClose: () => void
}

/** Today's target as a set ("80 kg × 5", "12 tekrar", "45 sn"); undefined when no load is known yet. */
function targetText(target: NextTarget): string | undefined {
  if (target.unit === 'kg' && target.weightKg == null) return undefined
  const weightKg = target.weightKg ?? 0
  if (target.reps == null) {
    if (target.unit === 'kg') return kg(weightKg)
    return weightKg > 0 ? `+${kg(weightKg)} × max` : 'max tekrar'
  }
  return formatSet({ weightKg, reps: target.reps }, target.unit)
}

function ExerciseRow({
  exercise,
  strengthLog,
}: {
  exercise: PlanExercise
  strengthLog: readonly StrengthLogEntry[]
}) {
  const nameId = useId()
  const { summary, target } = useMemo(() => {
    const stats = exerciseSummary(strengthLog, exercise.name)
    return { summary: stats, target: nextTarget(exercise, stats) }
  }, [strengthLog, exercise])
  const top = summary.last?.topSet
  const goal = targetText(target)
  return (
    <li aria-labelledby={nameId} className="flex flex-col gap-1 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={nameId} className="min-w-0 text-base font-semibold">
          {exercise.name}
        </h3>
        <span className="num shrink-0 text-sm text-text-muted">
          {formatSetsReps(exercise.sets, exercise.reps, exercise.unit)}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-text-muted">Hedef</span>
        <span className="num font-semibold text-text">{goal ?? 'İlk seansta belirle'}</span>
        {target.hint === 'increase' && target.increaseBy != null && (
          <Badge tone="accent">
            {target.unit === 'kg'
              ? `+${kg(target.increaseBy)}`
              : `+${target.increaseBy} ${target.unit === 'seconds' ? 'sn' : 'tekrar'}`}
          </Badge>
        )}
      </p>
      <p className="text-sm text-text-muted">
        {top && summary.last ? (
          <>
            Geçen sefer <span className="num text-text">{formatSet(top, summary.unit)}</span>
            {top.rpe != null && (
              <>
                {' · '}
                <span className="num text-text">RPE {top.rpe}</span>
              </>
            )}
            {' · '}
            {formatShortDate(summary.last.date)}
          </>
        ) : (
          'Henüz kayıt yok'
        )}
      </p>
    </li>
  )
}

/**
 * A plan session at a glance: every item in order (supersets grouped), each exercise with
 * sets × reps, today's target from `nextTarget` and last time's load + RPE; the primary
 * action starts this session (any session may be started on any day).
 */
export function SessionSheet({ sessionId, onClose }: SessionSheetProps) {
  const strengthLog = useStrengthLog()
  const startSession = useStartSession()
  const session = sessionId ? sessionById(sessionId) : undefined

  if (!session) return null

  return (
    <Sheet
      open
      onClose={onClose}
      title={session.title}
      footer={
        <Button size="lg" fullWidth icon={Play} onClick={() => startSession(session.id)}>
          Bu seansı başlat
        </Button>
      }
    >
      <p className="num text-sm text-text-muted">
        {formatActivityDuration(session.durationMin)} · {sessionExercises(session).length} hareket
      </p>
      <ol aria-label="Hareketler" className="mt-1 divide-y divide-border">
        {session.items.map((item, i) => {
          if (item.kind === 'single') {
            return <ExerciseRow key={item.exercise.name} exercise={item.exercise} strengthLog={strengthLog} />
          }
          return (
            <li key={`superset-${i}`} className="py-2">
              <div className="rounded-md border-l-2 border-volt bg-raised/50 pl-3">
                <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-volt">
                  Superset · {item.exercises.length} hareket
                </p>
                <ol aria-label="Superset" className="divide-y divide-border pr-3">
                  {item.exercises.map((exercise) => (
                    <ExerciseRow key={exercise.name} exercise={exercise} strengthLog={strengthLog} />
                  ))}
                </ol>
              </div>
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}
