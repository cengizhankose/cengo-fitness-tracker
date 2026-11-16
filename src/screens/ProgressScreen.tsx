import { useMemo, useState } from 'react'
import { Scale } from 'lucide-react'
import { BodyCard } from '@/components/progress/BodyCard'
import { GoalCard } from '@/components/progress/GoalCard'
import { RecentWeighIns } from '@/components/progress/RecentWeighIns'
import { WeekTicksCard } from '@/components/progress/WeekTicksCard'
import { WeighInSheet } from '@/components/progress/WeighInSheet'
import { WeightStatsCard } from '@/components/progress/WeightStatsCard'
import { recentWeeks } from '@/components/progress/recentWeeks'
import { Button, Screen, formatDecimal } from '@/components/ui'
import { BarChartCard, LineChartCard } from '@/components/ui/charts'
import { mondayOf, toLocalISODate } from '@/lib/dates'
import { PLANNED_STRENGTH_DAYS_PER_WEEK, plan } from '@/lib/plan'
import { runKmPerWeek, strengthDaysPerWeek, weekOverview } from '@/lib/week'
import { goalProgress, latestWeight, weeklyAverages, weeklyChangeKg, weightSeries } from '@/lib/weight'
import { useActivitiesStore } from '@/store/activities'
import { useCheckIns, useChecklist, useRunLog, useStrengthLog } from '@/store/selectors'
import type { IsoDate } from '@/types/userData'

const CREATINE_NOTE = plan.supplements.items.find((s) => s.name.startsWith('Kreatin'))?.note

/** İlerleme: weight vs the first milestone, weekly averages, training consistency. */
export function ProgressScreen() {
  const checkIns = useCheckIns()
  const strengthLog = useStrengthLog()
  const runLog = useRunLog()
  const checklist = useChecklist()
  const activityMap = useActivitiesStore((s) => s.activities)
  const today = toLocalISODate()
  /** Day open in the weigh-in sheet; null = closed. */
  const [sheetDate, setSheetDate] = useState<IsoDate | null>(null)

  const weight = useMemo(() => {
    const series = weightSeries(checkIns)
    const weeks = weeklyAverages(checkIns)
    const avgByWeek = new Map(weeks.map((w) => [w.weekStart, w.avgKg]))
    return {
      series,
      weeks,
      latest: latestWeight(checkIns),
      thisWeek: weeks.find((w) => w.weekStart === mondayOf(today)),
      changeKg: weeklyChangeKg(checkIns),
      progress: goalProgress(plan.goal, checkIns, today),
      chart: series.map((p) => ({
        date: p.date,
        value: p.value,
        value2: avgByWeek.get(mondayOf(p.date)) ?? null,
      })),
    }
  }, [checkIns, today])

  const training = useMemo(() => {
    const activities = Object.values(activityMap)
    return {
      overview: weekOverview(today, { strengthLog, runLog, activities, checklist }),
      strengthWeeks: recentWeeks(strengthDaysPerWeek(strengthLog), today),
      runWeeks: recentWeeks(runKmPerWeek(runLog, activities), today),
    }
  }, [activityMap, strengthLog, runLog, checklist, today])

  const hasWeighIns = weight.series.length > 0
  const { overview } = training

  return (
    <Screen
      title="İlerleme"
      footer={
        hasWeighIns ? (
          <Button fullWidth size="lg" icon={Scale} onClick={() => setSheetDate(today)}>
            Tartı gir
          </Button>
        ) : undefined
      }
    >
      <GoalCard
        goal={plan.goal}
        progress={weight.progress}
        weeksWithData={weight.weeks.length}
        onAddFirst={() => setSheetDate(today)}
      />

      {hasWeighIns && (
        <>
          <WeightStatsCard latest={weight.latest} thisWeek={weight.thisWeek} changeKg={weight.changeKg} />
          <LineChartCard
            title="Kilo"
            data={weight.chart}
            seriesLabel="Tartı"
            series2Label="Haftalık ort."
            unit="kg"
            goalBand={{
              low: plan.goal.milestoneKg.min,
              high: plan.goal.milestoneKg.max,
              label: 'İlk hedef',
            }}
            height={170}
          />
          {CREATINE_NOTE && <p className="-mt-2 px-1 text-sm text-text-muted">Kreatin: {CREATINE_NOTE}</p>}
        </>
      )}

      <BarChartCard
        title="Güç antrenmanı"
        data={training.strengthWeeks}
        seriesLabel="Antrenman günü"
        unit="gün"
        target={PLANNED_STRENGTH_DAYS_PER_WEEK}
        targetLabel={`hedef ${PLANNED_STRENGTH_DAYS_PER_WEEK}`}
        aside={`bu hafta ${overview.strengthDays.done}/${overview.strengthDays.planned}`}
        emptyHint="İlk seansını kaydet, haftalık gün sayın burada çıkar"
        height={150}
      />
      <BarChartCard
        title="Koşu"
        data={training.runWeeks}
        seriesLabel="Mesafe"
        unit="km"
        tone="run"
        aside={`bu hafta ${formatDecimal(overview.runKm, 1)} km`}
        emptyHint="Koşu kaydı ya da Garmin aktivitesi gelince burada görünür"
        height={150}
      />

      <WeekTicksCard overview={overview} today={today} />

      <RecentWeighIns series={weight.series} checkIns={checkIns} onEdit={setSheetDate} />

      <BodyCard checkIns={checkIns} today={today} />

      <WeighInSheet
        open={sheetDate !== null}
        onClose={() => setSheetDate(null)}
        date={sheetDate ?? undefined}
      />
    </Screen>
  )
}
