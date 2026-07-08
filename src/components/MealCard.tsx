import { Badge } from '@/components/Badge'
import type { Meal } from '@/types/plan'

function formatMealTime(time: string): string {
  if (time === 'after_training') return 'Post-workout'
  return time
}

interface MealCardProps {
  meal: Meal
}

export function MealCard({ meal }: MealCardProps) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="muted">{formatMealTime(meal.time)}</Badge>
          <h3 className="font-display font-semibold text-text">{meal.name}</h3>
        </div>
        <Badge tone="heat">{meal.estimatedCaloriesKcal} kcal</Badge>
      </div>
      <ul className="mt-2 space-y-1">
        {meal.items.map((item, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="text-text-muted">{item.name}</span>
            <span className="tnum text-text-faint">
              {item.amount} {item.unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
