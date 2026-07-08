import { useNavigate } from 'react-router-dom'
import { Route, Target, Gauge } from 'lucide-react'
import { ExerciseRow } from '@/components/ExerciseRow'
import { ProgressionTrack } from '@/components/ProgressionTrack'
import { Badge } from '@/components/Badge'
import type { ScheduleDay, RunDay } from '@/types/plan'
import { useProgramWeek, useStrengthLog } from '@/store/selectors'
import { lastWeightForExercise } from '@/lib/derive'
import { toLocalISODate } from '@/lib/dates'

function RunDetail({ day }: { day: RunDay }) {
  const week = useProgramWeek()
  if (day.progressionKmByWeek) {
    const km = day.progressionKmByWeek[week.index]
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <Target size={15} className="text-run" /> This week
          </span>
          <span className="tnum font-display text-stat-md font-bold text-run">{km} km</span>
        </div>
        {day.intensity && <Badge tone="run">{day.intensity}</Badge>}
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-faint">
            12-week progression · week {week.weekNumber}
          </p>
          <ProgressionTrack weeks={day.progressionKmByWeek} currentIndex={week.index} />
        </div>
      </div>
    )
  }

  if (day.structure) {
    return (
      <div className="space-y-2">
        {day.targetDistanceKm != null && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-text-muted">
              <Route size={15} className="text-run" /> Total
            </span>
            <span className="tnum font-display text-stat-md font-bold text-run">
              {day.targetDistanceKm} km
            </span>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {day.structure.map((seg, i) => (
            <li key={i} className="flex items-center justify-between py-2">
              <span className="text-sm capitalize text-text">{seg.segment}</span>
              <span className="flex items-center gap-2">
                <span className="tnum text-sm text-text-muted">{seg.distanceKm} km</span>
                {seg.pace && <Badge tone="heat">{seg.pace}</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-text-muted">
          <Target size={15} className="text-run" /> Target
        </span>
        <span className="tnum font-display text-stat-md font-bold text-run">
          {day.targetDistanceKm ?? '—'} km
        </span>
      </div>
      {day.intensity && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Gauge size={15} className="text-text-faint" /> {day.intensity}
        </p>
      )}
    </div>
  )
}

interface TaskDetailProps {
  day: ScheduleDay
  enableLog?: boolean
}

export function TaskDetail({ day, enableLog = true }: TaskDetailProps) {
  const navigate = useNavigate()
  const strengthLog = useStrengthLog()
  const today = toLocalISODate()

  if (day.type === 'strength') {
    const loggedNames = new Set(
      strengthLog.filter((e) => e.date === today).map((e) => e.exerciseName),
    )
    return (
      <div>
        {day.exercises.map((ex) => (
          <ExerciseRow
            key={ex.name}
            exercise={ex}
            lastWeightKg={lastWeightForExercise(strengthLog, ex.name)}
            loggedToday={loggedNames.has(ex.name)}
            onLog={
              enableLog
                ? (name) => navigate(`/log?type=strength&exercise=${encodeURIComponent(name)}`)
                : undefined
            }
          />
        ))}
      </div>
    )
  }

  if (day.type === 'run') {
    return <RunDetail day={day} />
  }

  // football
  return (
    <div className="flex items-center gap-2">
      <Badge tone="football">{day.rule}</Badge>
    </div>
  )
}
