import {
  Dumbbell,
  Sunrise,
  StretchHorizontal,
  Beef,
  Flame,
  Footprints,
  Moon,
  Ban,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ChecklistKey } from '@/types/plan'

interface ChecklistMeta {
  label: string
  icon: LucideIcon
}

/** Presentational labels/icons for the checklist keys defined in the plan JSON. */
export const CHECKLIST_META: Record<ChecklistKey, ChecklistMeta> = {
  completedWorkout: { label: 'Workout done', icon: Dumbbell },
  completedMorningMobility: { label: 'Morning mobility', icon: Sunrise },
  completedStretching: { label: 'Post-workout stretch', icon: StretchHorizontal },
  hitProteinTarget: { label: 'Protein target', icon: Beef },
  hitCalorieTarget: { label: 'Calorie target', icon: Flame },
  steps10000Plus: { label: '10k+ steps', icon: Footprints },
  sleep75Plus: { label: '7.5h+ sleep', icon: Moon },
  noAlcohol: { label: 'No alcohol', icon: Ban },
}
