import { Card } from '@/components/ui'
import { nextTarget } from '@/lib/exerciseStats'
import type { ExerciseSummary } from '@/lib/exerciseStats'
import { targetHint, targetLoad, targetPrescription } from './exerciseView'
import type { PlanPlacement } from './exerciseView'
import type { PlanExercise } from '@/types/plan'

interface TargetSource {
  key: string
  /** Session title, shown only when the exercise is in several sessions. */
  title?: string
  planExercise?: PlanExercise
}

export interface TargetCardProps {
  summary: ExerciseSummary
  /** Plan sessions containing the exercise; empty for exercises outside the plan. */
  placements: PlanPlacement[]
}

/**
 * "Sıradaki hedef": one line per plan session (title, sets × reps, load) plus the reason in
 * one sentence. The sentence is shown once when every session gives the same one.
 */
export function TargetCard({ summary, placements }: TargetCardProps) {
  const sources: TargetSource[] =
    placements.length > 0
      ? placements.map((p) => ({
          key: p.session.id,
          title: placements.length > 1 ? p.session.title : undefined,
          planExercise: p.exercise,
        }))
      : [{ key: 'free' }]
  const lines = sources.map((s) => {
    const target = nextTarget(s.planExercise, summary)
    return {
      key: s.key,
      title: s.title,
      prescription: targetPrescription(target, s.planExercise),
      load: targetLoad(target),
      hint: targetHint(target),
    }
  })
  const sharedHint = lines.every((l) => l.hint === lines[0]?.hint) ? lines[0]?.hint : undefined

  return (
    <Card title="Sıradaki hedef" tone="accent">
      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {line.title && <p className="truncate text-sm text-text-muted">{line.title}</p>}
              <p className="num text-num-sm">{line.prescription}</p>
              {sharedHint === undefined && <p className="text-sm text-text-muted">{line.hint}</p>}
            </div>
            {line.load && <span className="num text-num-sm shrink-0 text-volt">{line.load}</span>}
          </li>
        ))}
      </ul>
      {sharedHint && <p className="mt-3 text-sm text-text-muted">{sharedHint}</p>}
    </Card>
  )
}
