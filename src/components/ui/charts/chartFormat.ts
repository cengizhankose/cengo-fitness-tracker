import { parseLocalISODate } from '@/lib/dates'
import type { IsoDate } from '@/types/userData'

/** Axis tick: "16 Kas". */
export function formatTickDate(date: IsoDate): string {
  return parseLocalISODate(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

/** Tooltip heading: "16 Kas Pzt". */
export function formatTooltipDate(date: IsoDate): string {
  return parseLocalISODate(date).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  })
}

export const AXIS_TICK = { fill: 'var(--color-text-muted)', fontSize: 11 } as const
export const AXIS_STROKE = 'var(--color-border)'
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const
export const Y_AXIS_WIDTH = 36
export const DEFAULT_CHART_HEIGHT = 180
