import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Apple, UtensilsCrossed, Sunrise, StretchHorizontal, Timer } from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { StreakHeader } from '@/components/StreakHeader'
import { SectionCard } from '@/components/SectionCard'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'
import { ChecklistItem } from '@/components/ChecklistItem'
import { NutritionTargets } from '@/components/NutritionTargets'
import { MealCard } from '@/components/MealCard'
import { RoutineCard } from '@/components/RoutineCard'
import { Badge } from '@/components/Badge'
import { plan } from '@/lib/plan'
import { postWorkoutStretchFor, loggedExerciseNamesToday } from '@/lib/derive'
import { CHECKLIST_META } from '@/lib/checklistMeta'
import { toLocalISODate, formatShortDate } from '@/lib/dates'
import { formatRange } from '@/lib/format'
import { useStore } from '@/store'
import {
  useTodayTask,
  useTodayChecklistRatio,
  useStreak,
  useWeeklyCompletion,
  useChecklistRecord,
  useBenchmark,
  useStrengthLog,
} from '@/store/selectors'

/** Sections the user can collapse. The checklist is deliberately not one of them. */
type SectionId = 'workout' | 'targets' | 'meals' | 'mobility' | 'stretch'

export function TodayScreen() {
  const navigate = useNavigate()
  const today = toLocalISODate()
  const task = useTodayTask()
  const { done, total, keys } = useTodayChecklistRatio(today)
  const streak = useStreak()
  const weekly = useWeeklyCompletion(today)
  const record = useChecklistRecord(today)
  const benchmark = useBenchmark()
  const strengthLog = useStrengthLog()
  const toggle = useStore((s) => s.toggleChecklistItem)

  const stretch = postWorkoutStretchFor(plan, task)
  const morning = plan.mobility.dailyMorningMobility
  const targets = plan.nutrition.dailyTargets
  const mealKcal = plan.nutrition.meals.reduce((sum, m) => sum + m.estimatedCaloriesKcal, 0)

  // Open/closed state is intentionally ephemeral (same pattern as WeeklyScreen's openDay):
  // every visit starts from the curated hierarchy, and the persisted store is untouched.
  const [overrides, setOverrides] = useState<Partial<Record<SectionId, boolean>>>({})
  const setSection = (id: SectionId, open: boolean) =>
    setOverrides((o) => ({ ...o, [id]: open }))

  // The workout detail starts collapsed, but auto-opens mid-workout so returning from
  // /log lands back on the exercise list. Derived from the log — nothing is stored.
  const loggedNames = loggedExerciseNamesToday(strengthLog, today)
  const exTotal = task.type === 'strength' ? task.exercises.length : 0
  const exDone =
    task.type === 'strength' ? task.exercises.filter((e) => loggedNames.has(e.name)).length : 0
  const workoutOpen = overrides.workout ?? (exDone > 0 && exDone < exTotal)

  return (
    <>
      <ScreenHeader
        title="Today"
        subtitle={formatShortDate(today)}
        action={
          <Badge tone={total > 0 && done >= total ? 'success' : 'muted'}>
            {done}/{total}
          </Badge>
        }
      />
      <div className="space-y-3 px-4 py-4">
        <StreakHeader
          streak={streak.current}
          best={streak.best}
          done={done}
          total={total}
          weekly={weekly}
        />

        {!benchmark && (
          <section className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3">
            <Timer size={16} aria-hidden className="shrink-0 text-active" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{plan.benchmark.initialTask}</p>
              <p className="truncate text-xs text-text-faint">{plan.benchmark.effort}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/log?type=run&benchmark=1')}
              className="h-9 shrink-0 rounded-md bg-active px-3 text-sm font-semibold text-on-accent"
            >
              Log 5K
            </button>
          </section>
        )}

        <TodayWorkoutCard
          day={task}
          open={workoutOpen}
          onOpenChange={(open) => setSection('workout', open)}
        />

        <SectionCard sectionId="checklist" title="Daily Checklist" icon={ListChecks}>
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

        <CollapsibleSection
          id="targets"
          title="Targets"
          icon={Apple}
          accent="var(--color-volt)"
          summary={`${formatRange(targets.caloriesKcal, 'kcal')} · ${formatRange(targets.proteinG, 'g')} protein`}
          open={overrides.targets ?? false}
          onOpenChange={(open) => setSection('targets', open)}
        >
          <NutritionTargets targets={targets} />
        </CollapsibleSection>

        <CollapsibleSection
          id="meals"
          title="Meals"
          icon={UtensilsCrossed}
          summary={`${plan.nutrition.meals.length} meals · ~${mealKcal} kcal`}
          open={overrides.meals ?? false}
          onOpenChange={(open) => setSection('meals', open)}
        >
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
        </CollapsibleSection>

        <CollapsibleSection
          id="mobility"
          title="Morning Mobility"
          icon={Sunrise}
          accent="var(--color-active)"
          summary={`${morning.durationMin} min · ${morning.items.length} moves`}
          open={overrides.mobility ?? false}
          onOpenChange={(open) => setSection('mobility', open)}
        >
          <RoutineCard routine={morning} title={`${morning.durationMin}-min wake-up`} />
        </CollapsibleSection>

        {stretch && (
          <CollapsibleSection
            id="stretch"
            title="Post-Workout Stretch"
            icon={StretchHorizontal}
            accent="var(--color-run)"
            summary={`${stretch.durationMin} min · ${stretch.items.length} moves`}
            open={overrides.stretch ?? false}
            onOpenChange={(open) => setSection('stretch', open)}
          >
            <RoutineCard routine={stretch} />
          </CollapsibleSection>
        )}
      </div>
    </>
  )
}
