import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { formatShortDate } from '@/lib/dates'
import { paceForZone } from '@/lib/marathon/zones'
import {
  MARATHON_TYPE_LABEL,
  MARATHON_TYPE_TONE,
  STATUS_LABEL,
  STATUS_TEXT_CLASS,
} from '@/lib/marathon/meta'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'
import type { PlannedWorkout, WorkoutActual } from '@/types/marathon'

interface MarathonDayRowProps {
  workout: PlannedWorkout
  actual: WorkoutActual
  today: string
  expanded: boolean
  onToggle: () => void
  /** Where the run-log CTA should return to after a successful save. */
  from?: 'plan' | 'today'
}

function joinMeta(parts: Array<string | null>): string {
  return parts.filter((p): p is string => Boolean(p)).join(' · ')
}

export function MarathonDayRow({
  workout,
  actual,
  today,
  expanded,
  onToggle,
  from = 'plan',
}: MarathonDayRowProps) {
  const navigate = useNavigate()
  const setMarathonStatus = useStore((s) => s.setMarathonStatus)
  const clearMarathonStatus = useStore((s) => s.clearMarathonStatus)
  const push = useToast((s) => s.push)

  const isRest = workout.workoutType === 'REST'
  const isToday = workout.date === today
  const isPastPending = workout.date < today && actual.status === 'pending'
  const dateLabel = formatShortDate(workout.date)
  const hasRun = actual.loggedRunsOnDate > 0

  const collapsedMeta = isRest
    ? ''
    : joinMeta([
        workout.targetDistanceKm != null ? `${workout.targetDistanceKm} km` : null,
        workout.targetDurationMin != null ? `${workout.targetDurationMin} min` : null,
        workout.paceZone ? `${workout.paceZone} zone` : null,
      ])

  const plannedLine = isRest
    ? ''
    : `${joinMeta([
        workout.targetDistanceKm != null ? `${workout.targetDistanceKm} km` : null,
        workout.targetDurationMin != null ? `${workout.targetDurationMin} min work` : null,
        workout.paceZone ? `${workout.paceZone} zone` : null,
      ])} · Pace ${paceForZone(workout.paceZone) ?? '—'}`

  const actualLine = joinMeta([
    actual.actualDistanceKm != null ? `${actual.actualDistanceKm} km` : null,
    actual.actualDurationMin != null ? `${actual.actualDurationMin} min` : null,
    actual.actualPace,
  ])

  function goLog() {
    navigate(`/log?type=run&date=${workout.date}&from=${from}`)
  }
  function markDone() {
    setMarathonStatus(workout.date, 'completed')
    push(`Marked ${dateLabel} complete`, 'success')
  }
  function skip() {
    setMarathonStatus(workout.date, 'skipped')
    push('Skipped')
  }
  function undo() {
    clearMarathonStatus(workout.date)
    push('Status cleared — your logged run is untouched')
  }

  return (
    <div
      data-testid={`marathon-day-${workout.date}`}
      className={`overflow-hidden rounded-lg border bg-surface-1 transition-colors ${
        isToday ? 'border-volt/60' : 'border-border'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`marathon-day-${workout.date}-panel`}
        aria-label={`${dateLabel} — ${workout.title}, ${STATUS_LABEL[actual.status]}`}
        className={`flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-volt ${
          isToday ? 'border-volt/60' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <span className="font-display text-sm font-bold uppercase tracking-wide text-text-muted">
            {dateLabel}
          </span>
          <p className="mt-0.5 truncate font-display font-semibold text-text">{workout.title}</p>
          {collapsedMeta && <p className="mt-0.5 truncate text-xs text-text-faint">{collapsedMeta}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={MARATHON_TYPE_TONE[workout.workoutType]}>
            {MARATHON_TYPE_LABEL[workout.workoutType]}
          </Badge>
          <span
            className={`text-xs font-semibold ${
              isPastPending ? 'text-heat-soft' : STATUS_TEXT_CLASS[actual.status]
            }`}
          >
            {STATUS_LABEL[actual.status]}
            {actual.status === 'completed' && !isRest && actual.actualDistanceKm != null
              ? ` ${actual.actualDistanceKm} km`
              : ''}
          </span>
        </div>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 text-text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id={`marathon-day-${workout.date}-panel`}
        hidden={!expanded}
        className="border-t border-border px-4 py-3"
      >
        {expanded && (
          <div className="space-y-3 text-sm">
            {!isRest && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Planned</p>
                <p className="text-text">{plannedLine}</p>
                <p className="mt-0.5 text-text-muted">{workout.description}</p>
              </div>
            )}

            {!isRest && (actual.status === 'completed' || hasRun) && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Actual</p>
                <p className="text-text">{actualLine || '—'}</p>
                {actual.notes && <p className="mt-0.5 italic text-text-muted">"{actual.notes}"</p>}
              </div>
            )}

            {isRest && (
              <div>
                {actual.notes && <p className="text-text-muted italic">"{actual.notes}"</p>}
                {hasRun && (
                  <p className="text-xs text-text-faint">You logged a run on this date</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {actual.isOverride ? (
                <button
                  type="button"
                  onClick={undo}
                  aria-label={`Undo ${dateLabel} — ${workout.title}`}
                  className="min-h-[48px] flex-1 rounded-md border border-border-strong text-sm font-semibold text-text active:bg-surface-2"
                >
                  Undo
                </button>
              ) : isRest ? (
                <>
                  <button
                    type="button"
                    onClick={markDone}
                    aria-label={`Mark done ${dateLabel} — ${workout.title}`}
                    className="min-h-[48px] flex-1 rounded-md bg-volt text-sm font-semibold text-on-accent active:bg-volt-dim"
                  >
                    Mark done
                  </button>
                  <button
                    type="button"
                    onClick={skip}
                    aria-label={`Skip ${dateLabel} — ${workout.title}`}
                    className="min-h-[48px] flex-1 rounded-md border border-border-strong text-sm font-semibold text-text active:bg-surface-2"
                  >
                    Skip
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={goLog}
                    className="min-h-[48px] flex-1 rounded-md bg-run text-sm font-semibold text-on-accent active:opacity-90"
                  >
                    {hasRun ? 'Log another' : 'Log run'}
                  </button>
                  <button
                    type="button"
                    onClick={skip}
                    aria-label={`Skip ${dateLabel} — ${workout.title}`}
                    className="min-h-[48px] flex-1 rounded-md border border-border-strong text-sm font-semibold text-text active:bg-surface-2"
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
