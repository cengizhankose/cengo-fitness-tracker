import { Footprints, Bike, Waves, Dumbbell, Activity as ActivityIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SportGroup, PlanAdherence } from '@/types/activities'
import type { BadgeTone } from '@/components/Badge'

export const SPORT_ICON: Record<SportGroup, LucideIcon> = {
  run: Footprints,
  bike: Bike,
  swim: Waves,
  strength: Dumbbell,
  other: ActivityIcon,
}

export const SPORT_LABEL: Record<SportGroup, string> = {
  run: 'Koşu',
  bike: 'Bisiklet',
  swim: 'Yüzme',
  strength: 'Ağırlık',
  other: 'Diğer',
}

export const SPORT_COLOR: Record<SportGroup, string> = {
  run: 'var(--color-run)',
  bike: 'var(--color-football)',
  swim: 'var(--color-active)',
  strength: 'var(--color-volt)',
  other: 'var(--color-text-muted)',
}

export const PLAN_ADHERENCE_TONE: Record<PlanAdherence, BadgeTone> = {
  on_plan: 'success',
  substitution: 'run',
  extra: 'active',
  unplanned: 'heat',
}

export const PLAN_ADHERENCE_LABEL: Record<PlanAdherence, string> = {
  on_plan: 'Plana Uygun',
  substitution: 'İkame',
  extra: 'Ek Antrenman',
  unplanned: 'Plansız',
}
