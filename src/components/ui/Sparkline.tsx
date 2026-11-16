import { TONE_COLOR } from './tones'
import type { Tone } from './tones'

export interface SparklineProps {
  values: readonly number[]
  /** Accessible description, e.g. "Bench Press son 8 seans: 70 → 80 kg". */
  label: string
  /** Default 96. */
  width?: number
  /** Default 32. */
  height?: number
  /** Default 'accent'. */
  tone?: Tone
}

const PAD = 3

/** Dependency-free inline SVG trend line with the last point highlighted. */
export function Sparkline({ values, label, width = 96, height = 32, tone = 'accent' }: SparklineProps) {
  const color = TONE_COLOR[tone]
  const midY = height / 2
  const n = values.length

  let line: string | undefined
  let last: { x: number; y: number } | undefined
  if (n === 1) {
    last = { x: width - PAD, y: midY }
  } else if (n > 1) {
    const min = Math.min(...values)
    const range = Math.max(...values) - min
    const points = values.map((v, i) => ({
      x: PAD + (i * (width - 2 * PAD)) / (n - 1),
      y: range === 0 ? midY : PAD + (1 - (v - min) / range) * (height - 2 * PAD),
    }))
    line = points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
    last = points[n - 1]
  }

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
    >
      {n < 2 && (
        <line
          x1={PAD}
          x2={width - PAD}
          y1={midY}
          y2={midY}
          stroke="var(--color-border-strong)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
      )}
      {line && (
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {last && <circle cx={round(last.x)} cy={round(last.y)} r={3} fill={color} />}
    </svg>
  )
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
