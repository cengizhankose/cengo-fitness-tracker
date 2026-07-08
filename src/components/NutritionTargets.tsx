import type { DailyTargets } from '@/types/plan'
import { formatRange, formatMinPlus } from '@/lib/format'

interface Tile {
  label: string
  value: string
  accent?: string
}

function StatTile({ label, value, accent }: Tile) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p
        className="tnum mt-1 font-display text-lg font-bold"
        style={{ color: accent ?? 'var(--color-text)' }}
      >
        {value}
      </p>
    </div>
  )
}

interface NutritionTargetsProps {
  targets: DailyTargets
}

export function NutritionTargets({ targets }: NutritionTargetsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatTile label="Calories" value={formatRange(targets.caloriesKcal, 'kcal')} accent="var(--color-heat)" />
      <StatTile label="Protein" value={formatRange(targets.proteinG, 'g')} accent="var(--color-volt)" />
      <StatTile label="Carbs" value={formatRange(targets.carbsG, 'g')} />
      <StatTile label="Fat" value={formatRange(targets.fatG, 'g')} />
      <StatTile label="Steps" value={formatMinPlus(targets.steps.min)} accent="var(--color-run)" />
      <StatTile label="Sleep" value={formatRange(targets.sleepHours, 'h')} accent="var(--color-football)" />
    </div>
  )
}
