import marathonData from '@/data/marathon.json'
import type { MarathonPlan, PlannedWorkout } from '@/types/marathon'

// Single source of truth. The JSON is copied into the repo and bundled at build
// (works offline). This cast is the ONE place we assert JSON ⟷ type agreement,
// mirroring src/lib/plan.ts.
export const marathonPlan: MarathonPlan = marathonData as unknown as MarathonPlan

export function allPlannedWorkouts(plan: MarathonPlan): PlannedWorkout[] {
  return plan.weeks.flatMap((week) => week.days)
}

export default marathonPlan
