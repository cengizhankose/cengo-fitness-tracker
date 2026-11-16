import { Minus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from './Badge'
import type { Tone } from './tones'

export type Trend = 'up' | 'flat' | 'down' | 'new'

export interface TrendBadgeProps {
  trend: Trend
  /** Which direction is good (loads: 'up', body weight: 'down'). Default 'up'. */
  good?: 'up' | 'down'
}

const TREND: Record<Trend, { icon: LucideIcon; word: string }> = {
  up: { icon: TrendingUp, word: 'arttı' },
  flat: { icon: Minus, word: 'aynı' },
  down: { icon: TrendingDown, word: 'düştü' },
  new: { icon: Sparkles, word: 'yeni' },
}

/** Trend pill: icon + Turkish word (arttı / aynı / düştü / yeni). */
export function TrendBadge({ trend, good = 'up' }: TrendBadgeProps) {
  const tone: Tone =
    trend === 'new' ? 'info' : trend === 'flat' ? 'neutral' : trend === good ? 'success' : 'warning'
  const { icon, word } = TREND[trend]
  return (
    <Badge tone={tone} icon={icon}>
      {word}
    </Badge>
  )
}
