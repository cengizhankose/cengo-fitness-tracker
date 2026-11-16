import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cx } from './cx'
import { formatDecimal } from './number'

export interface StatDelta {
  /** Signed change, e.g. -0.8. */
  value: number
  unit?: string
  /** Which direction counts as good. Default 'up'; 'none' keeps it neutral. */
  good?: 'up' | 'down' | 'none'
}

export interface StatProps {
  label: ReactNode
  /** Numbers are shown with a Turkish decimal comma (max 1 decimal). */
  value: ReactNode
  unit?: string
  delta?: StatDelta
  /** Small line under the value. */
  hint?: ReactNode
  /** md = 28 px numerals, lg = 40 px. Default 'md'. */
  size?: 'md' | 'lg'
}

function deltaTone({ value, good = 'up' }: StatDelta): string {
  if (value === 0 || good === 'none') return 'text-text-muted'
  return (value > 0) === (good === 'up') ? 'text-success' : 'text-danger'
}

/** Label + big tabular number + unit, with an optional coloured delta. */
export function Stat({ label, value, unit, delta, hint, size = 'md' }: StatProps) {
  const DeltaIcon = !delta || delta.value === 0 ? Minus : delta.value > 0 ? ArrowUp : ArrowDown
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs font-medium text-text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={cx('num', size === 'lg' ? 'text-num-lg' : 'text-num')}>
          {typeof value === 'number' ? formatDecimal(value, 1) : value}
        </span>
        {unit && <span className="text-sm font-medium text-text-muted">{unit}</span>}
      </span>
      {delta && (
        <span className={cx('flex items-center gap-0.5 text-sm font-semibold tabular-nums', deltaTone(delta))}>
          <DeltaIcon size={14} aria-hidden />
          {delta.value > 0 ? '+' : delta.value < 0 ? '−' : '±'}
          {formatDecimal(Math.abs(delta.value), 1)}
          {delta.unit ? ` ${delta.unit}` : ''}
        </span>
      )}
      {hint != null && <span className="text-xs text-text-faint">{hint}</span>}
    </div>
  )
}
