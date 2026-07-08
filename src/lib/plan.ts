import planData from '@/data/plan.json'
import type { TrainingPlan } from '@/types/plan'

// Single source of truth. The JSON is copied into the repo and bundled at build
// (works offline). This cast is the ONE place we assert JSON ⟷ type agreement.
export const plan: TrainingPlan = planData as unknown as TrainingPlan

export default plan
