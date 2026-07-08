import { Check, Plus } from 'lucide-react'
import { Badge } from '@/components/Badge'
import type { StrengthExercise } from '@/types/plan'

interface ExerciseRowProps {
  exercise: StrengthExercise
  lastWeightKg?: number
  loggedToday?: boolean
  onLog?: (exerciseName: string) => void
}

export function ExerciseRow({ exercise, lastWeightKg, loggedToday, onLog }: ExerciseRowProps) {
  const { name, warmupSets, workingSets, repRange, intensity } = exercise
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-text">{name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {warmupSets > 0 && <Badge tone="muted">{warmupSets} warmup</Badge>}
          <Badge tone="volt">
            {workingSets} × {repRange}
          </Badge>
          <Badge tone="heat">{intensity}</Badge>
          {lastWeightKg != null && (
            <span className="text-xs text-text-faint">last {lastWeightKg}kg</span>
          )}
        </div>
      </div>
      {onLog && (
        <button
          type="button"
          onClick={() => onLog(name)}
          className={`flex h-9 shrink-0 items-center gap-1 rounded-md px-3 text-sm font-semibold ${
            loggedToday
              ? 'bg-success/15 text-success'
              : 'bg-volt text-on-accent active:bg-volt-dim'
          }`}
        >
          {loggedToday ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
          {loggedToday ? 'Logged' : 'Log'}
        </button>
      )}
    </div>
  )
}
