import type { ReactNode } from 'react'
import { cx } from './cx'
import { TONE_FILL } from './tones'
import type { Tone } from './tones'

export interface ProgressBarProps {
  value: number
  max: number
  /** Visible label and accessible name. */
  label: string
  /** Right-side text; default "value/max". */
  valueText?: ReactNode
  /** Default 'accent'. */
  tone?: Tone
}

/** Labelled horizontal progress bar (role="progressbar"). */
export function ProgressBar({ value, max, label, valueText, tone = 'accent' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const text = valueText ?? `${value}/${max}`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-text-muted">{label}</span>
        <span className="font-semibold tabular-nums">{text}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={typeof text === 'string' ? text : undefined}
        className="h-2 overflow-hidden rounded-full bg-raised"
      >
        <div className={cx('h-full rounded-full transition-[width]', TONE_FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
