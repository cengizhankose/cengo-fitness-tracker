import { useMemo, useState } from 'react'
import { Utensils } from 'lucide-react'
import { Card, ListRow, Screen } from '@/components/ui'
import { PlanDayCard } from '@/components/plan/PlanDayCard'
import { SessionSheet } from '@/components/plan/SessionSheet'
import { WeekStrip } from '@/components/plan/WeekStrip'
import { formatDayMonth, toLocalISODate } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { plan } from '@/lib/plan'
import { weekOverview } from '@/lib/week'
import { useActivitiesStore } from '@/store/activities'
import { useChecklist, useRunLog, useStrengthLog } from '@/store/selectors'
import type { SessionId } from '@/types/plan'

/** The plan week: overview strip, the seven days with their blocks, rules and the nutrition link. */
export function PlanScreen() {
  const today = toLocalISODate()
  const strengthLog = useStrengthLog()
  const runLog = useRunLog()
  const checklist = useChecklist()
  const activityMap = useActivitiesStore((s) => s.activities)
  const [openSession, setOpenSession] = useState<SessionId>()

  const overview = useMemo(
    () =>
      weekOverview(today, {
        strengthLog,
        runLog,
        activities: Object.values(activityMap),
        checklist,
      }),
    [today, strengthLog, runLog, activityMap, checklist],
  )

  const { caloriesKcal, proteinG } = plan.nutrition.targets

  return (
    <Screen
      title="Plan"
      subtitle={`Hafta ${overview.planWeek} · ${formatDayMonth(overview.weekStart)} – ${formatDayMonth(overview.weekEnd)}`}
    >
      <Card>
        <WeekStrip overview={overview} today={today} />
      </Card>

      <ol aria-label="Günler" className="flex flex-col gap-3">
        {overview.days.map((day) => (
          <PlanDayCard
            key={day.date}
            day={day}
            isToday={day.date === today}
            longRunTargetKm={overview.longRunTargetKm}
            onOpenSession={setOpenSession}
          />
        ))}
      </ol>

      <Card title="Kurallar">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm marker:text-text-faint">
          {plan.sessionRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
          <li>{plan.runRule.text}</li>
        </ul>
      </Card>

      <Card flush>
        <ListRow
          to="/nutrition"
          leading={<Utensils size={20} aria-hidden className="text-text-muted" />}
          title="Beslenme ve takviye"
          trailing={
            <span className="num text-sm text-text-muted">
              {formatNumber(caloriesKcal)} kcal · {formatNumber(proteinG)} g protein
            </span>
          }
        />
      </Card>

      <SessionSheet sessionId={openSession} onClose={() => setOpenSession(undefined)} />
    </Screen>
  )
}
