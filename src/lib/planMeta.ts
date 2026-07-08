import type { WorkoutType } from '@/types/plan'
import type { BadgeTone } from '@/components/Badge'

export const TYPE_TONE: Record<WorkoutType, BadgeTone> = {
  strength: 'volt',
  run: 'run',
  football: 'football',
}

export const TYPE_COLOR: Record<WorkoutType, string> = {
  strength: 'var(--color-volt)',
  run: 'var(--color-run)',
  football: 'var(--color-football)',
}

export const TYPE_LABEL: Record<WorkoutType, string> = {
  strength: 'Strength',
  run: 'Run',
  football: 'Football',
}
