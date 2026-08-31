import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/Badge'
import { MarathonWeekSection } from '@/components/MarathonWeekSection'
import { marathonPlan } from '@/lib/marathon/plan'
import { defaultOpenWeek } from '@/lib/marathon/derive'
import { formatShortDate, toLocalISODate } from '@/lib/dates'
import { useStore } from '@/store'
import { useMarathonSummary } from '@/store/selectors'
import type { IsoDate } from '@/types/userData'

interface MarathonTrackerProps {
  today?: IsoDate
}

const PHASE_LINE = {
  'pre-plan': (raceStart: string) => `Starts ${raceStart}`,
  'post-race': () => 'Race complete',
} as const

export function MarathonTracker({ today = toLocalISODate() }: MarathonTrackerProps) {
  const runLog = useStore((s) => s.runLog)
  const statusMap = useStore((s) => s.marathonStatus)
  const summary = useMarathonSummary(today)

  const [openWeek, setOpenWeek] = useState<number | null>(() => defaultOpenWeek(marathonPlan, today))
  const [openDay, setOpenDay] = useState<IsoDate | null>(null)

  function toggleWeek(weekNumber: number) {
    setOpenWeek((cur) => (cur === weekNumber ? null : weekNumber))
    setOpenDay(null)
  }

  const phaseLine =
    summary.phase === 'pre-plan'
      ? PHASE_LINE['pre-plan'](formatShortDate(marathonPlan.meta.startDate))
      : summary.phase === 'post-race'
        ? PHASE_LINE['post-race']()
        : `Week ${summary.currentWeek?.weekNumber} of ${marathonPlan.meta.totalWeeks} · ${summary.currentWeek?.focus}`

  return (
    <div className="space-y-2.5">
      <SectionCard icon={CalendarDays} accent="var(--color-volt)">
        <p className="font-display text-sm font-semibold text-text">
          {summary.daysToRace} days to {summary.raceName} · {formatShortDate(summary.raceDate)}
        </p>
        <p className="mt-1 text-sm text-text-muted">{phaseLine}</p>
        {summary.week && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-run"
              style={{ width: `${summary.week.completionPercent}%` }}
            />
          </div>
        )}
        {summary.nextWorkout && (
          <p className="mt-2 text-xs text-text-faint">
            Next: {formatShortDate(summary.nextWorkout.date)} · {summary.nextWorkout.title}
            {summary.nextWorkout.targetDistanceKm != null
              ? ` · ${summary.nextWorkout.targetDistanceKm} km`
              : ''}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {summary.nutritionPhase && <Badge tone="muted">{summary.nutritionPhase.label}</Badge>}
          <span className="tnum text-xs text-text-faint">
            {summary.plan.completedKm} / {summary.plan.plannedKm} km
          </span>
        </div>
      </SectionCard>

      {marathonPlan.weeks.map((week) => (
        <MarathonWeekSection
          key={week.weekNumber}
          week={week}
          runLog={runLog}
          statusMap={statusMap}
          today={today}
          open={openWeek === week.weekNumber}
          onOpenChange={() => toggleWeek(week.weekNumber)}
          openDay={openWeek === week.weekNumber ? openDay : null}
          onDayToggle={(date) => setOpenDay((cur) => (cur === date ? null : date))}
        />
      ))}
    </div>
  )
}
