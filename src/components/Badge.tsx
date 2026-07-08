import type { ReactNode } from 'react'

export type BadgeTone = 'volt' | 'heat' | 'success' | 'active' | 'run' | 'football' | 'muted'

const TONE_CLASS: Record<BadgeTone, string> = {
  volt: 'bg-volt/15 text-volt',
  heat: 'bg-heat/15 text-heat',
  success: 'bg-success/15 text-success',
  active: 'bg-active/15 text-active',
  run: 'bg-run/15 text-run',
  football: 'bg-football/15 text-football',
  muted: 'bg-surface-3 text-text-muted',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'muted', children, className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]} ${className ?? ''}`}
    >
      {children}
    </span>
  )
}
