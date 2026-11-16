import { Dumbbell, Beef, Moon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ChecklistKey } from '@/types/plan'

interface ChecklistMeta {
  label: string
  icon: LucideIcon
}

/** Turkish labels/icons for the three daily ticks (order: plan.dailyChecklist). */
export const CHECKLIST_META: Record<ChecklistKey, ChecklistMeta> = {
  completedWorkout: { label: 'Antrenman yapıldı', icon: Dumbbell },
  hitProteinTarget: { label: 'Protein tuttu', icon: Beef },
  inBedByMidnight: { label: "00:00'dan önce yatak", icon: Moon },
}
