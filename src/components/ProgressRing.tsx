import type { ReactNode } from 'react'

type Accent = 'volt' | 'heat' | 'success' | 'active'

const ACCENT_VAR: Record<Accent, string> = {
  volt: 'var(--color-volt)',
  heat: 'var(--color-heat)',
  success: 'var(--color-success)',
  active: 'var(--color-active)',
}

interface ProgressRingProps {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  accent?: Accent
  centerSlot?: ReactNode
  ariaLabel: string
}

export function ProgressRing({
  value,
  max,
  size = 132,
  strokeWidth = 12,
  accent = 'heat',
  centerSlot,
  ariaLabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
  const dashOffset = circumference * (1 - ratio)
  const complete = ratio >= 1
  const color = complete ? ACCENT_VAR.success : ACCENT_VAR[accent]

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`relative inline-grid place-items-center ${complete ? 'animate-ring-pop' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 400ms ease, stroke 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{centerSlot}</div>
    </div>
  )
}
