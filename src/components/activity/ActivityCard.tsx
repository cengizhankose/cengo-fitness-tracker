import { useId, useState } from 'react'
import { Card } from '@/components/ui'
import { formatActivityDistance, formatActivityDuration, isRunActivity } from '@/lib/activities'
import { SPORT_COLOR, SPORT_ICON, SPORT_LABEL } from '@/lib/activitiesMeta'
import { pace } from '@/lib/format'
import type { Activity } from '@/types/activities'
import { ActivityDetails } from './ActivityDetails'
import { hasActivityDetail } from './activityDetail'

/** Comment length above which compact cards clamp it behind "devamı". */
const CLAMP_CHARS = 160

export interface ActivityCardProps {
  activity: Activity
  /** Clamps the coach comment to three lines with a "devamı" toggle and hides laps, HR zones,
   *  sets and training load behind a "detaylar" toggle. */
  compact?: boolean
}

/**
 * Garmin activity: sport icon, name, distance, duration, pace (run types, from moving time),
 * average/max HR, the synced detail (training load, laps, HR zones, strength sets) and the
 * Turkish coach comment. Plan-adherence fields are never rendered: they refer to the retired
 * marathon plan.
 */
export function ActivityCard({ activity, compact = false }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const commentId = useId()
  const detailId = useId()
  const Icon = SPORT_ICON[activity.sportGroup]
  const time = activity.startTimeLocal.slice(11, 16)

  const stats: { label: string; value: string }[] = []
  if (activity.distanceKm != null && activity.distanceKm > 0) {
    stats.push({ label: 'Mesafe', value: formatActivityDistance(activity.distanceKm) })
  }
  stats.push({ label: 'Süre', value: formatActivityDuration(activity.durationMin) })
  if (isRunActivity(activity) && activity.distanceKm) {
    stats.push({
      label: 'Tempo',
      value: pace(activity.distanceKm, activity.movingDurationMin ?? activity.durationMin),
    })
  }
  if (activity.avgHr != null) {
    const avg = Math.round(activity.avgHr)
    stats.push({
      label: activity.maxHr != null ? 'Nabız ort/maks' : 'Nabız ort',
      value: activity.maxHr != null ? `${avg} / ${Math.round(activity.maxHr)}` : String(avg),
    })
  }

  // Roughly three lines at phone width; shorter comments are never clamped.
  const clampable = compact && (activity.comment?.length ?? 0) > CLAMP_CHARS
  const clamped = clampable && !expanded

  return (
    <Card
      as="article"
      titleAs="h3"
      title={
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            size={20}
            aria-hidden
            className="shrink-0"
            style={{ color: SPORT_COLOR[activity.sportGroup] }}
          />
          <span className="truncate">{activity.name}</span>
        </span>
      }
      aside={
        <span className="tabular-nums">
          {SPORT_LABEL[activity.sportGroup]}
          {time && ` · ${time}`}
        </span>
      }
    >
      <dl className="flex flex-wrap gap-x-5 gap-y-3">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs font-medium text-text-muted">{s.label}</dt>
            <dd className="num text-num-sm whitespace-nowrap">{s.value}</dd>
          </div>
        ))}
      </dl>
      {hasActivityDetail(activity) &&
        (compact ? (
          <>
            <button
              type="button"
              aria-expanded={detailOpen}
              aria-controls={detailId}
              onClick={() => setDetailOpen((v) => !v)}
              className="-mx-2 mt-1 inline-flex min-h-tap items-center rounded-sm px-2 text-sm font-semibold text-volt"
            >
              {detailOpen ? 'detayları gizle' : 'detaylar'}
            </button>
            {detailOpen && <ActivityDetails activity={activity} id={detailId} />}
          </>
        ) : (
          <ActivityDetails activity={activity} />
        ))}
      {activity.comment && (
        <div className="mt-3 rounded-md bg-raised px-3 py-2.5">
          <p id={commentId} className={clamped ? 'line-clamp-3 text-sm' : 'text-sm'}>
            {activity.comment}
          </p>
          {clampable && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={commentId}
              onClick={() => setExpanded((v) => !v)}
              className="-mx-2 mt-1 inline-flex min-h-tap items-center rounded-sm px-2 text-sm font-semibold text-volt"
            >
              {expanded ? 'kısalt' : 'devamı'}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
