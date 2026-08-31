import { useState } from 'react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { DayCard } from '@/components/DayCard'
import { Badge } from '@/components/Badge'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { MarathonTracker } from '@/components/MarathonTracker'
import { plan } from '@/lib/plan'
import { dayNameForDate } from '@/lib/derive'
import { useWeeklyCompletion } from '@/store/selectors'
import { useMarathonSummary } from '@/store/selectors'
import { formatShortDate } from '@/lib/dates'
import type { DayName } from '@/types/plan'

export function WeeklyScreen() {
  const todayName = dayNameForDate()
  const [openDay, setOpenDay] = useState<DayName | null>(todayName)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const weekly = useWeeklyCompletion()
  const summary = useMarathonSummary()
  const pct = weekly.total > 0 ? Math.round((weekly.done / weekly.total) * 100) : 0

  return (
    <>
      <ScreenHeader
        title="Plan"
        subtitle={`${summary.raceName} · ${formatShortDate(summary.raceDate)}`}
        action={<Badge tone={summary.phase === 'post-race' ? 'success' : 'muted'}>{summary.daysToRace} days</Badge>}
      />
      <div className="space-y-2.5 px-4 py-4">
        <MarathonTracker />

        <CollapsibleSection
          id="legacy-plan"
          title="Strength & Football Week"
          open={legacyOpen}
          onOpenChange={setLegacyOpen}
          summary={`Repeating weekly template · ${pct}% week`}
        >
          <div className="space-y-2.5">
            {plan.weeklySchedule.map((day) => (
              <DayCard
                key={day.day}
                day={day}
                isToday={day.day === todayName}
                expanded={openDay === day.day}
                onToggle={() => setOpenDay((cur) => (cur === day.day ? null : day.day))}
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </>
  )
}
