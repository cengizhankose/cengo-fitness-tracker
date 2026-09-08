import { ChevronDown, Heart, Flame, Gauge } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { SPORT_ICON, SPORT_COLOR, PLAN_ADHERENCE_TONE, PLAN_ADHERENCE_LABEL } from '@/lib/activitiesMeta'
import { formatActivityDuration, formatActivityDistance } from '@/lib/activities'
import { formatShortDate } from '@/lib/dates'
import type { Activity } from '@/types/activities'

interface ActivityCardProps {
  activity: Activity
  expanded: boolean
  onToggle: () => void
}

function StatRow({ activity }: { activity: Activity }) {
  const parts: string[] = []
  if (activity.distanceKm != null) parts.push(formatActivityDistance(activity.distanceKm))
  parts.push(formatActivityDuration(activity.durationMin))
  if (activity.avgHr != null) parts.push(`${activity.avgHr} bpm`)
  if (activity.calories != null) parts.push(`${activity.calories} kcal`)
  return <p className="tnum mt-1 text-sm text-text-muted">{parts.join(' · ')}</p>
}

function SplitsTable({ splits }: { splits: NonNullable<Activity['splits']> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-text-faint">
            <th className="py-1 pr-3 font-medium">#</th>
            <th className="py-1 pr-3 font-medium">Distance</th>
            <th className="py-1 pr-3 font-medium">Time</th>
            <th className="py-1 font-medium">HR</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {splits.map((split) => (
            <tr key={split.i} className="border-t border-border/60">
              <td className="py-1 pr-3 text-text-muted">{split.i}</td>
              <td className="py-1 pr-3 text-text">{Math.round(split.distanceM)} m</td>
              <td className="py-1 pr-3 text-text">{formatActivityDuration(split.sec / 60)}</td>
              <td className="py-1 text-text">{split.hr ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActivityDetail({ activity }: { activity: Activity }) {
  return (
    <div className="space-y-3">
      {(activity.aerobicTE != null || activity.anaerobicTE != null || activity.trainingLoad != null) && (
        <div className="flex flex-wrap gap-3 text-xs text-text-muted">
          {activity.aerobicTE != null && (
            <span className="flex items-center gap-1">
              <Gauge size={12} /> Aerobic TE {activity.aerobicTE.toFixed(1)}
            </span>
          )}
          {activity.anaerobicTE != null && (
            <span className="flex items-center gap-1">
              <Gauge size={12} /> Anaerobic TE {activity.anaerobicTE.toFixed(1)}
            </span>
          )}
          {activity.trainingLoad != null && (
            <span className="flex items-center gap-1">
              <Flame size={12} /> Load {activity.trainingLoad}
            </span>
          )}
        </div>
      )}

      {activity.hrZones && activity.hrZones.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-faint">HR Zones</p>
          <div className="flex flex-wrap gap-2">
            {activity.hrZones.map((z) => (
              <span
                key={z.zone}
                className="tnum rounded-md bg-surface-2 px-2 py-1 text-xs text-text-muted"
              >
                Z{z.zone} · {z.min}m
              </span>
            ))}
          </div>
        </div>
      )}

      {activity.splits && activity.splits.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-faint">Splits</p>
          <SplitsTable splits={activity.splits} />
        </div>
      )}

      {activity.strokeSummary && activity.strokeSummary.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-faint">Strokes</p>
          <ul className="tnum space-y-1 text-xs text-text-muted">
            {activity.strokeSummary.map((s) => (
              <li key={s.stroke}>
                {s.stroke} · {s.meters} m · {formatActivityDuration(s.secs / 60)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {activity.rawNotes && <p className="text-xs italic text-text-faint">{activity.rawNotes}</p>}

      <div>
        {activity.planAdherence && (
          <Badge tone={PLAN_ADHERENCE_TONE[activity.planAdherence]} className="mb-2">
            {PLAN_ADHERENCE_LABEL[activity.planAdherence]}
          </Badge>
        )}
        {activity.comment ? (
          <div className="rounded-md border border-volt/30 bg-volt/10 px-3 py-2.5 text-sm text-text">
            {activity.comment}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border bg-surface-2 px-3 py-2.5 text-sm text-text-faint">
            Yorum bekliyor
          </p>
        )}
      </div>
    </div>
  )
}

export function ActivityCard({ activity, expanded, onToggle }: ActivityCardProps) {
  const Icon = SPORT_ICON[activity.sportGroup]
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`activity-${activity.id}-panel`}
        className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-volt"
      >
        <Icon size={20} className="mt-0.5 shrink-0" style={{ color: SPORT_COLOR[activity.sportGroup] }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display font-semibold text-text">{activity.name}</p>
          </div>
          <p className="text-xs text-text-faint">{formatShortDate(activity.date)}</p>
          <StatRow activity={activity} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {activity.planAdherence && (
            <Badge tone={PLAN_ADHERENCE_TONE[activity.planAdherence]}>
              {PLAN_ADHERENCE_LABEL[activity.planAdherence]}
            </Badge>
          )}
          {activity.maxHr != null && (
            <span className="tnum flex items-center gap-1 text-xs text-text-faint">
              <Heart size={11} /> {activity.maxHr}
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`mt-0.5 shrink-0 text-text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={`activity-${activity.id}-panel`} hidden={!expanded} className="border-t border-border px-4 py-3">
        {expanded && <ActivityDetail activity={activity} />}
      </div>
    </div>
  )
}
