import { useNavigate } from 'react-router-dom'
import { Dumbbell, ListChecks, Apple, UtensilsCrossed, Sunrise, StretchHorizontal, Timer } from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { StreakHeader } from '@/components/StreakHeader'
import { SectionCard } from '@/components/SectionCard'
import { TaskDetail } from '@/components/TaskDetail'
import { ChecklistItem } from '@/components/ChecklistItem'
import { NutritionTargets } from '@/components/NutritionTargets'
import { MealCard } from '@/components/MealCard'
import { RoutineCard } from '@/components/RoutineCard'
import { Badge } from '@/components/Badge'
import { plan } from '@/lib/plan'
import { postWorkoutStretchFor } from '@/lib/derive'
import { TYPE_LABEL, TYPE_COLOR } from '@/lib/planMeta'
import { CHECKLIST_META } from '@/lib/checklistMeta'
import { toLocalISODate, formatShortDate } from '@/lib/dates'
import { useStore } from '@/store'
import {
  useTodayTask,
  useTodayChecklistRatio,
  useStreak,
  useWeeklyCompletion,
  useChecklistRecord,
  useBenchmark,
} from '@/store/selectors'

export function TodayScreen() {
  const navigate = useNavigate()
  const today = toLocalISODate()
  const task = useTodayTask()
  const { done, total, keys } = useTodayChecklistRatio(today)
  const streak = useStreak()
  const weekly = useWeeklyCompletion(today)
  const record = useChecklistRecord(today)
  const benchmark = useBenchmark()
  const toggle = useStore((s) => s.toggleChecklistItem)

  const stretch = postWorkoutStretchFor(plan, task)
  const morning = plan.mobility.dailyMorningMobility

  return (
    <>
      <ScreenHeader title="Today" subtitle={formatShortDate(today)} />
      <div className="space-y-4 px-4 py-4">
        <StreakHeader
          streak={streak.current}
          best={streak.best}
          done={done}
          total={total}
          weekly={weekly}
        />

        {!benchmark && (
          <SectionCard title="Benchmark" icon={Timer} accent="var(--color-active)">
            <p className="text-sm text-text-muted">{plan.benchmark.initialTask}</p>
            <p className="mt-1 text-xs text-text-faint">{plan.benchmark.effort}</p>
            <button
              type="button"
              onClick={() => navigate('/log?type=run&benchmark=1')}
              className="mt-3 w-full rounded-md bg-active py-2.5 text-sm font-semibold text-on-accent"
            >
              Log 5K result
            </button>
          </SectionCard>
        )}

        <SectionCard title={`${TYPE_LABEL[task.type]} · ${task.title}`} icon={Dumbbell} accent={TYPE_COLOR[task.type]}>
          <TaskDetail day={task} enableLog />
        </SectionCard>

        <SectionCard title="Daily Checklist" icon={ListChecks}>
          <div className="space-y-2">
            {keys.map((key) => {
              const meta = CHECKLIST_META[key]
              return (
                <ChecklistItem
                  key={key}
                  label={meta.label}
                  icon={meta.icon}
                  checked={record?.items[key] === true}
                  onToggle={() => toggle(today, key)}
                />
              )
            })}
          </div>
        </SectionCard>

        <SectionCard title="Targets" icon={Apple} accent="var(--color-volt)">
          <NutritionTargets targets={plan.nutrition.dailyTargets} />
        </SectionCard>

        <SectionCard title="Meals" icon={UtensilsCrossed}>
          <div className="space-y-2.5">
            {plan.nutrition.meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {plan.nutrition.rules.map((rule, i) => (
                <Badge key={i} tone="muted">
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Morning Mobility" icon={Sunrise} accent="var(--color-active)">
          <RoutineCard routine={morning} title={`${morning.durationMin}-min wake-up`} />
        </SectionCard>

        {stretch && (
          <SectionCard title="Post-Workout Stretch" icon={StretchHorizontal} accent="var(--color-run)">
            <RoutineCard routine={stretch} />
          </SectionCard>
        )}
      </div>
    </>
  )
}
