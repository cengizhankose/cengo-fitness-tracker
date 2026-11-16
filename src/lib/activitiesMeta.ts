import { Footprints, Bike, Waves, Dumbbell, Activity as ActivityIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SportGroup } from '@/types/activities'

/** Icon per Garmin sport group. */
export const SPORT_ICON: Record<SportGroup, LucideIcon> = {
  run: Footprints,
  bike: Bike,
  swim: Waves,
  strength: Dumbbell,
  other: ActivityIcon,
}

/** Turkish label per Garmin sport group. */
export const SPORT_LABEL: Record<SportGroup, string> = {
  run: 'Koşu',
  bike: 'Bisiklet',
  swim: 'Yüzme',
  strength: 'Ağırlık',
  other: 'Diğer',
}

/** Accent color (CSS custom property) per Garmin sport group. */
export const SPORT_COLOR: Record<SportGroup, string> = {
  run: 'var(--color-run)',
  bike: 'var(--color-football)',
  swim: 'var(--color-active)',
  strength: 'var(--color-volt)',
  other: 'var(--color-text-muted)',
}
