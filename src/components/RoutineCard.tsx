import { Clock, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { ExerciseImage } from '@/components/ExerciseImage'
import type { MorningMobility, StretchingRoutine } from '@/types/plan'

interface RoutineCardProps {
  routine: MorningMobility | StretchingRoutine
  title?: string
}

function hasName(r: MorningMobility | StretchingRoutine): r is StretchingRoutine {
  return 'name' in r
}

export function RoutineCard({ routine, title }: RoutineCardProps) {
  const heading = title ?? (hasName(routine) ? routine.name : 'Routine')
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold uppercase tracking-wide text-text">{heading}</h3>
        <Badge tone="muted">
          <Clock size={12} /> {routine.durationMin} min
        </Badge>
      </div>
      <ul className="mt-2 divide-y divide-border/50">
        {routine.items.map((item, i) => (
          <li key={i} className="flex items-center gap-3 py-2 text-sm">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
              <ExerciseImage name={item.name} />
            </span>
            <span className="flex-1 text-text-muted">{item.name}</span>
            <span className="tnum flex items-center gap-1 text-text-faint">
              {item.durationSec}s
              {item.eachSide && <RefreshCw size={12} className="text-text-faint" />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
