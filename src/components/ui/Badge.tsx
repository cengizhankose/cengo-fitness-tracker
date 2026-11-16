import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'
import { TONE_SOFT } from './tones'
import type { Tone } from './tones'

export interface BadgeProps {
  /** Default 'neutral'. */
  tone?: Tone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}

/** Small tinted pill for status words and counts. */
export function Badge({ tone = 'neutral', icon: Icon, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONE_SOFT[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} aria-hidden className="shrink-0" />}
      {children}
    </span>
  )
}
