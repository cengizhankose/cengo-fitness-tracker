import { ChevronDown, Clock } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { TaskDetail } from '@/components/TaskDetail'
import { TYPE_TONE, TYPE_LABEL } from '@/lib/planMeta'
import type { ScheduleDay } from '@/types/plan'

interface DayCardProps {
  day: ScheduleDay
  isToday: boolean
  expanded: boolean
  onToggle: () => void
}

export function DayCard({ day, isToday, expanded, onToggle }: DayCardProps) {
  const duration = day.durationMin != null ? `${day.durationMin} min` : null
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-surface-1 transition-colors ${
        isToday ? 'border-volt/60' : 'border-border'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-text-muted">
              {day.day.slice(0, 3)}
            </span>
            {isToday && <Badge tone="volt">Today</Badge>}
          </div>
          <p className="mt-0.5 truncate font-display font-semibold text-text">{day.title}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={TYPE_TONE[day.type]}>{TYPE_LABEL[day.type]}</Badge>
          {duration && (
            <span className="flex items-center gap-1 text-xs text-text-faint">
              <Clock size={11} /> {duration}
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <TaskDetail day={day} enableLog={isToday} />
        </div>
      )}
    </div>
  )
}
