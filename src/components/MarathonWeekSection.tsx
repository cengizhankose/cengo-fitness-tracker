import { CollapsibleSection } from '@/components/CollapsibleSection'
import { MarathonDayRow } from '@/components/MarathonDayRow'
import { weekTotals, resolveActual } from '@/lib/marathon/derive'
import { formatShortDate } from '@/lib/dates'
import type { MarathonStatusRecord, MarathonWeek } from '@/types/marathon'
import type { IsoDate, RunLogEntry } from '@/types/userData'

interface MarathonWeekSectionProps {
  week: MarathonWeek
  runLog: RunLogEntry[]
  statusMap: Record<IsoDate, MarathonStatusRecord>
  today: IsoDate
  open: boolean
  onOpenChange: (open: boolean) => void
  openDay: IsoDate | null
  onDayToggle: (date: IsoDate) => void
}

/** "31 Aug – 6 Sep" — the range badge on the week's trigger row. */
function dateRange(week: MarathonWeek): string {
  const start = formatShortDate(week.startDate).replace(/^\S+\s/, '')
  const end = formatShortDate(week.endDate).replace(/^\S+\s/, '')
  return `${start} – ${end}`
}

export function MarathonWeekSection({
  week,
  runLog,
  statusMap,
  today,
  open,
  onOpenChange,
  openDay,
  onDayToggle,
}: MarathonWeekSectionProps) {
  const totals = weekTotals(week, runLog, statusMap)
  const isRaceWeek = week.days.some((d) => d.workoutType === 'RACE')

  const summary = isRaceWeek
    ? `Race week · ${week.focus}`
    : `${week.focus} · ${totals.plannedKm} km planned · ${totals.completedKm} km done · ` +
      `${totals.sessionsCompleted}/${totals.sessionsPlanned} sessions`

  return (
    <CollapsibleSection
      id={`marathon-week-${week.weekNumber}`}
      title={`Week ${week.weekNumber} · ${dateRange(week)}`}
      open={open}
      onOpenChange={onOpenChange}
      summary={summary}
    >
      <div className="mb-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            data-week-bar={week.weekNumber}
            className="h-full rounded-full bg-run"
            style={{ width: `${totals.completionPercent}%` }}
          />
        </div>
      </div>
      <div className="space-y-2.5">
        {week.days.map((day) => (
          <MarathonDayRow
            key={day.date}
            workout={day}
            actual={resolveActual(day, runLog, statusMap)}
            today={today}
            expanded={openDay === day.date}
            onToggle={() => onDayToggle(day.date)}
            from="plan"
          />
        ))}
      </div>
    </CollapsibleSection>
  )
}
