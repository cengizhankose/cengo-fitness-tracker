/** Semantic colour tones shared by Badge, Card stripes, ProgressBar, Sparkline and charts. */
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'run' | 'football'

/** Tinted pill/background with readable foreground (Badge). */
export const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-raised text-text-muted',
  accent: 'bg-volt/15 text-volt',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  run: 'bg-run/15 text-run',
  football: 'bg-football/15 text-football',
}

/** Solid fill (stripes, bar fills). */
export const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-text-faint',
  accent: 'bg-volt',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  run: 'bg-run',
  football: 'bg-football',
}

/** CSS colour value for SVG strokes/fills. */
export const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--color-text-muted)',
  accent: 'var(--color-volt)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  run: 'var(--color-run)',
  football: 'var(--color-football)',
}
