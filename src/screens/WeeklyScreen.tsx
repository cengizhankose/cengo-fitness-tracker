import { useState } from 'react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { DayCard } from '@/components/DayCard'
import { Badge } from '@/components/Badge'
import { plan } from '@/lib/plan'
import { dayNameForDate } from '@/lib/derive'
import { useWeeklyCompletion } from '@/store/selectors'
import type { DayName } from '@/types/plan'

export function WeeklyScreen() {
  const todayName = dayNameForDate()
  const [openDay, setOpenDay] = useState<DayName | null>(todayName)
  const weekly = useWeeklyCompletion()
  const pct = weekly.total > 0 ? Math.round((weekly.done / weekly.total) * 100) : 0

  return (
    <>
      <ScreenHeader
        title="Weekly Plan"
        subtitle={plan.meta.planName}
        action={<Badge tone={pct >= 100 ? 'success' : 'muted'}>{pct}% week</Badge>}
      />
      <div className="space-y-2.5 px-4 py-4">
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
    </>
  )
}
