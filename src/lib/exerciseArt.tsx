import type { ReactNode } from 'react'

interface Pose {
  lines: string[]
  head: [number, number, number] // cx, cy, r
  floor?: boolean
  extra?: ReactNode
}

// Schematic side-profile stick-figure poses (64x64 viewBox, figure faces right).
// Bundled SVG → offline-safe, matches the dark/volt theme, no external image deps.
const POSES: Record<string, Pose> = {
  'Cat-Cow': {
    lines: ['16,40 16,53', '16,40 23,31', '23,31 32,26 41,31', '41,31 46,42', '46,42 41,53'],
    head: [14, 39, 4],
  },
  "World's Greatest Stretch": {
    lines: ['40,53 40,38 30,34', '30,34 16,53', '30,34 34,22', '34,24 45,12'],
    head: [33, 19, 4],
  },
  'Deep Squat Hold': {
    lines: ['24,53 22,40 32,42 42,40 40,53', '32,42 32,25', '32,29 43,28'],
    head: [32, 19, 4],
  },
  'Hip Openers': {
    lines: ['36,53 36,34', '36,34 36,21', '36,34 23,33 26,45', '36,27 29,31'],
    head: [36, 16, 4],
  },
  'Shoulder Circles': {
    lines: ['32,42 26,53', '32,42 38,53', '32,42 32,24', '32,27 23,21', '32,27 41,21'],
    head: [32, 16, 4],
    extra: (
      <path
        d="M40 22 a10 10 0 1 1 -3 -7"
        fill="none"
        stroke="var(--color-heat)"
        strokeWidth={2}
        strokeDasharray="3 3"
      />
    ),
  },
  'Couch Stretch': {
    lines: ['41,53 40,40 30,38', '30,38 30,22', '30,38 20,50 15,42'],
    head: [30, 18, 4],
  },
  'Hamstring Stretch': {
    lines: ['30,53 30,32 34,32 34,53', '32,33 44,38', '44,38 47,50'],
    head: [46, 41, 4],
  },
  'Figure 4 Stretch': {
    lines: ['28,44 30,25', '28,44 40,44 40,53', '32,44 41,41'],
    head: [31, 21, 4],
  },
  'Child Pose': {
    lines: ['20,53 40,53', '40,53 41,47 22,45', '22,45 13,53'],
    head: [18, 45, 4],
  },
  'Lat Stretch': {
    lines: ['32,42 28,53', '32,42 36,53', '32,42 31,24', '31,24 40,14 47,19'],
    head: [27, 19, 4],
  },
  'Calf Stretch': {
    lines: ['34,53 34,42 28,37', '28,37 16,53', '28,37 41,30', '41,30 50,30'],
    head: [41, 26, 4],
    extra: <line x1="51" y1="14" x2="51" y2="54" stroke="var(--color-border-strong)" strokeWidth={2} />,
  },
  'Soleus Stretch': {
    lines: ['34,53 34,42 28,37', '28,37 20,46 16,53', '28,37 41,30', '41,30 50,30'],
    head: [41, 26, 4],
    extra: <line x1="51" y1="14" x2="51" y2="54" stroke="var(--color-border-strong)" strokeWidth={2} />,
  },
  'Quad Stretch': {
    lines: ['36,53 36,34', '36,34 36,19', '36,34 33,46 41,40', '36,30 41,40'],
    head: [36, 16, 4],
  },
}

const GENERIC: Pose = {
  lines: ['32,42 27,53', '32,42 37,53', '32,42 32,24', '32,28 24,34', '32,28 40,34'],
  head: [32, 18, 4],
}

interface ExerciseArtProps {
  name: string
  size?: number
}

export function ExerciseArt({ name, size = 40 }: ExerciseArtProps) {
  const pose = POSES[name] ?? GENERIC
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="var(--color-volt)"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={name}
    >
      {pose.floor !== false && (
        <line x1="10" y1="55" x2="54" y2="55" stroke="var(--color-border)" strokeWidth={2} />
      )}
      {pose.extra}
      {pose.lines.map((pts, i) => (
        <polyline key={i} points={pts} />
      ))}
      <circle cx={pose.head[0]} cy={pose.head[1]} r={pose.head[2]} fill="var(--color-volt)" stroke="none" />
    </svg>
  )
}
