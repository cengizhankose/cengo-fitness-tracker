import { Link } from 'react-router-dom'
import { Footprints, Pencil, Scale, Trash2 } from 'lucide-react'
import { ActivityCard } from '@/components/activity/ActivityCard'
import { Card, IconButton } from '@/components/ui'
import { formatActivityDistance, formatActivityDuration } from '@/lib/activities'
import { formatShortDate } from '@/lib/dates'
import { formatNumber, kg, pace } from '@/lib/format'
import type { ExerciseDay } from '@/lib/exerciseStats'
import type { TimelineDay } from '@/lib/timeline'
import type { RunLogEntry } from '@/types/userData'
import { formatSetList } from './format'

export interface HistoryDayCardProps {
  day: TimelineDay
  /** Marks the day opened via `?date=`. */
  highlighted?: boolean
  onEditExercise: (exerciseDay: ExerciseDay) => void
  onRemoveRun: (run: RunLogEntry) => void
}

/** DOM id of a day card, the scroll target of `?date=`. */
export function dayAnchorId(date: string): string {
  return `gun-${date}`
}

/** One day of the history feed: weigh-in, strength per exercise, manual runs, Garmin activities. */
export function HistoryDayCard({ day, highlighted = false, onEditExercise, onRemoveRun }: HistoryDayCardProps) {
  const weight = day.checkIn?.weightKg
  const waist = day.checkIn?.waistCm
  return (
    <div
      id={dayAnchorId(day.date)}
      tabIndex={-1}
      aria-current={highlighted ? 'date' : undefined}
      className="scroll-mt-20 rounded-lg focus-visible:outline-none"
    >
      <Card
        as="article"
        titleAs="h3"
        title={formatShortDate(day.date)}
        tone={highlighted ? 'accent' : undefined}
        className={highlighted ? 'border-volt/60' : undefined}
      >
        <div className="flex flex-col gap-3">
          {(weight != null || waist != null) && (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Scale size={16} aria-hidden className="shrink-0" />
              <span className="tabular-nums">
                {weight != null && (
                  <>
                    Tartı <span className="font-semibold text-text">{kg(weight)}</span>
                  </>
                )}
                {weight != null && waist != null && ' · '}
                {waist != null && (
                  <>
                    Bel <span className="font-semibold text-text">{formatNumber(waist)} cm</span>
                  </>
                )}
              </span>
            </p>
          )}

          {day.strength.length > 0 && (
            <ul aria-label="Kuvvet" className="-my-1 divide-y divide-border">
              {day.strength.map((ex) => (
                <StrengthRow key={ex.exerciseName} exerciseDay={ex} onEdit={() => onEditExercise(ex)} />
              ))}
            </ul>
          )}

          {day.runs.length > 0 && (
            <ul aria-label="Koşu" className="-my-1 divide-y divide-border">
              {day.runs.map((run) => (
                <RunRow key={run.id} run={run} onRemove={() => onRemoveRun(run)} />
              ))}
            </ul>
          )}

          {day.activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function StrengthRow({ exerciseDay, onEdit }: { exerciseDay: ExerciseDay; onEdit: () => void }) {
  const { exerciseName, unit, sets } = exerciseDay
  const warmups = sets.filter((s) => s.kind === 'warmup')
  const working = sets.filter((s) => s.kind === 'working')
  return (
    <li className="flex items-start gap-2 py-1">
      <div className="min-w-0 flex-1 py-1">
        <Link
          to={`/exercises/${encodeURIComponent(exerciseName)}`}
          className="inline-flex min-h-tap items-center font-semibold underline-offset-4 active:underline"
        >
          {exerciseName}
        </Link>
        {working.length > 0 && <p className="text-base tabular-nums">{formatSetList(working, unit)}</p>}
        {warmups.length > 0 && (
          <p className="text-sm text-text-muted tabular-nums">Isınma: {formatSetList(warmups, unit)}</p>
        )}
      </div>
      <IconButton icon={Pencil} aria-label={`${exerciseName} düzenle`} onClick={onEdit} />
    </li>
  )
}

function RunRow({ run, onRemove }: { run: RunLogEntry; onRemove: () => void }) {
  const parts = [formatActivityDistance(run.distanceKm)]
  if (run.durationMin) {
    parts.push(formatActivityDuration(run.durationMin), pace(run.distanceKm, run.durationMin))
  }
  if (run.averageHeartRate != null) parts.push(`Nabız ${Math.round(run.averageHeartRate)}`)
  if (run.rpe != null) parts.push(`RPE ${run.rpe}`)
  return (
    <li className="flex items-start gap-2 py-1">
      <Footprints size={20} aria-hidden className="mt-3 shrink-0 text-run" />
      <div className="min-w-0 flex-1 py-2">
        <p className="font-semibold">Koşu</p>
        <p className="text-base tabular-nums">{parts.join(' · ')}</p>
        {run.notes && <p className="text-sm text-text-muted">{run.notes}</p>}
      </div>
      <IconButton icon={Trash2} variant="danger" aria-label="Koşuyu sil" onClick={onRemove} />
    </li>
  )
}
