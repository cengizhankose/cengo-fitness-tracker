import { useMemo } from 'react'
import { Settings, UtensilsCrossed } from 'lucide-react'
import { Button, Card, IconButton, ListRow, Screen, SectionTitle, formatDecimal } from '@/components/ui'
import { SyncStatusBadge } from '@/components/SyncStatusBadge'
import { ActivityCard } from '@/components/activity/ActivityCard'
import { WeekStrip } from '@/components/plan/WeekStrip'
import { DailyTicks } from '@/components/today/DailyTicks'
import { TodayTraining } from '@/components/today/TodayTraining'
import { WeightCard } from '@/components/today/WeightCard'
import { recentActivity } from '@/components/today/todayModel'
import { formatLongDate, toLocalISODate } from '@/lib/dates'
import { plan, planWeekNumber } from '@/lib/plan'
import { weekOverview } from '@/lib/week'
import { useActivitiesStore } from '@/store/activities'
import { useChecklist, useRunLog, useStrengthLog } from '@/store/selectors'

const { caloriesKcal, proteinG } = plan.nutrition.targets

/** Bugün: today's training and whether it's done, daily ticks, the week, weight, food and the latest Garmin activity. */
export function TodayScreen() {
  const today = toLocalISODate()
  const strengthLog = useStrengthLog()
  const runLog = useRunLog()
  const checklist = useChecklist()
  const activityMap = useActivitiesStore((s) => s.activities)
  const activities = useMemo(() => Object.values(activityMap), [activityMap])

  const overview = useMemo(
    () => weekOverview(today, { strengthLog, runLog, activities, checklist }),
    [today, strengthLog, runLog, activities, checklist],
  )
  const todayOverview = overview.days.find((d) => d.date === today)
  const latestActivity = useMemo(() => recentActivity(activities, today), [activities, today])

  return (
    <Screen
      title="Bugün"
      subtitle={`${formatLongDate(today)} · Hafta ${planWeekNumber(today)}`}
      action={
        <>
          <SyncStatusBadge />
          <IconButton icon={Settings} aria-label="Ayarlar" to="/settings" />
        </>
      }
    >
      <TodayTraining today={today} day={todayOverview} />

      <DailyTicks date={today} />

      <Card title="Bu hafta">
        <WeekStrip overview={overview} today={today} />
      </Card>

      <WeightCard today={today} />

      <Card flush>
        <ListRow
          to="/nutrition"
          leading={<UtensilsCrossed size={22} aria-hidden className="text-volt" />}
          title={`${formatDecimal(caloriesKcal)} kcal · ${formatDecimal(proteinG)} g protein`}
        />
      </Card>

      {latestActivity && (
        <section aria-labelledby="today-activity" className="flex flex-col gap-2">
          <SectionTitle
            id="today-activity"
            aside={
              <Button variant="ghost" to="/history">
                Geçmiş
              </Button>
            }
          >
            Son aktivite
          </SectionTitle>
          <ActivityCard activity={latestActivity} compact />
        </section>
      )}
    </Screen>
  )
}
