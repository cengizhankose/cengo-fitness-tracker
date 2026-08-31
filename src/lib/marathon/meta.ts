import type { MarathonWorkoutType, ResolvedStatus } from '@/types/marathon'
import type { BadgeTone } from '@/components/Badge'

export const MARATHON_TYPE_LABEL: Record<MarathonWorkoutType, string> = {
  REST: 'Rest',
  EASY: 'Easy',
  STRIDES: 'Strides',
  THRESHOLD: 'Threshold',
  MARATHON_PACE: 'Marathon Pace',
  LONG_RUN: 'Long Run',
  RACE: 'Race',
}

export const MARATHON_TYPE_TONE: Record<MarathonWorkoutType, BadgeTone> = {
  REST: 'muted',
  EASY: 'run',
  STRIDES: 'run',
  THRESHOLD: 'run',
  MARATHON_PACE: 'run',
  LONG_RUN: 'run',
  RACE: 'volt',
}

export const MARATHON_TYPE_COLOR: Record<MarathonWorkoutType, string> = {
  REST: 'var(--color-text-muted)',
  EASY: 'var(--color-run)',
  STRIDES: 'var(--color-run)',
  THRESHOLD: 'var(--color-run)',
  MARATHON_PACE: 'var(--color-run)',
  LONG_RUN: 'var(--color-run)',
  RACE: 'var(--color-volt)',
}

export const STATUS_LABEL: Record<ResolvedStatus, string> = {
  pending: 'Pending',
  completed: 'Done',
  skipped: 'Skipped',
}

export const STATUS_TONE: Record<ResolvedStatus, BadgeTone> = {
  pending: 'muted',
  completed: 'success',
  skipped: 'heat',
}

/** Literal Tailwind classes — the JIT scanner cannot see `text-${var}` interpolation. */
export const STATUS_TEXT_CLASS: Record<ResolvedStatus, string> = {
  pending: 'text-text-muted',
  completed: 'text-success',
  skipped: 'text-heat-soft',
}
