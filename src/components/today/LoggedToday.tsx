import { Link } from 'react-router-dom'
import { formatNumber, formatSet } from '@/lib/format'
import type { ExerciseDay } from '@/lib/exerciseStats'

export interface LoggedTodayProps {
  /** Today's exercises (canonical names, logged order) with at least one working set. */
  days: ExerciseDay[]
}

/** What was logged today, one row per exercise: every working set as load × reps with its RPE. */
export function LoggedToday({ days }: LoggedTodayProps) {
  return (
    <ul className="divide-y divide-border" aria-label="Bugün kaydedilenler">
      {days.map((day) => (
        <li key={day.exerciseName}>
          <Link
            to={`/exercises/${encodeURIComponent(day.exerciseName)}`}
            className="flex min-h-tap items-start justify-between gap-3 px-4 py-2.5 transition-colors active:bg-raised"
          >
            <span className="min-w-0 flex-1 truncate text-base font-medium">{day.exerciseName}</span>
            <ul className="shrink-0 text-right text-sm tabular-nums">
              {day.workingSets.map((set) => (
                <li key={`${set.entryId}-${set.setIndex}`}>
                  <span className="font-semibold">{formatSet(set, day.unit)}</span>
                  {set.rpe != null && <span className="text-text-muted"> · RPE {formatNumber(set.rpe)}</span>}
                </li>
              ))}
            </ul>
          </Link>
        </li>
      ))}
    </ul>
  )
}
