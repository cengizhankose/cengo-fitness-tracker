import { formatActivityDuration } from '@/lib/activities'
import { formatNumber, formatRange } from '@/lib/format'
import { sessionById } from '@/lib/plan'
import type { WeekDayOverview } from '@/lib/week'
import type { DayBlock, Range } from '@/types/plan'

/** Whether a planned block counts as done on its day; only strength and runs are tracked. */
export function blockDone(day: WeekDayOverview, block: DayBlock): boolean {
  if (block.type === 'strength') return day.strengthDone
  if (block.type === 'run') return day.runDone
  return false
}

/**
 * Headline and detail line of a planned block: session title + duration for strength, run
 * title + duration (or this week's long-run target, "8 km" / "12–14 km"), football title +
 * time of day.
 */
export function describeBlock(
  block: DayBlock,
  longRunTargetKm: number | Range,
): { title: string; detail?: string } {
  switch (block.type) {
    case 'strength': {
      const session = sessionById(block.sessionId)
      return {
        title: session?.title ?? block.sessionId,
        detail: session && formatActivityDuration(session.durationMin),
      }
    }
    case 'run': {
      let detail: string | undefined
      if (block.longRun) {
        detail =
          typeof longRunTargetKm === 'number'
            ? `${formatNumber(longRunTargetKm)} km`
            : formatRange(longRunTargetKm, 'km')
      } else if (block.durationMin != null) {
        detail = formatActivityDuration(block.durationMin)
      }
      return { title: block.title, detail }
    }
    case 'football':
      return { title: block.title, detail: block.when }
  }
}
