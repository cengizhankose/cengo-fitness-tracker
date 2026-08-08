import { Flame, Trophy } from 'lucide-react'
import { ProgressRing } from '@/components/ProgressRing'
import { Badge } from '@/components/Badge'

interface StreakHeaderProps {
  streak: number
  best: number
  done: number
  total: number
  weekly: { done: number; total: number }
}

export function StreakHeader({ streak, best, done, total, weekly }: StreakHeaderProps) {
  const complete = total > 0 && done >= total
  const weeklyPct = weekly.total > 0 ? Math.round((weekly.done / weekly.total) * 100) : 0

  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={done}
          max={total}
          size={104}
          accent="heat"
          ariaLabel={`${streak} day streak, ${done} of ${total} tasks done today`}
          centerSlot={
            <div className="leading-none">
              <div className="tnum font-display text-stat-lg font-bold text-text">{streak}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                <Flame size={11} className="text-heat" /> day streak
              </div>
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold uppercase tracking-wide text-text">
            {complete ? 'Today done' : "Let's move"}
          </p>
          <p className="mt-0.5 text-sm text-text-muted">
            {done}/{total} tasks today
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="active">
              <Trophy size={12} /> Best {best}
            </Badge>
            <Badge tone={weeklyPct >= 100 ? 'success' : 'muted'}>{weeklyPct}% week</Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-volt transition-[width] duration-500"
              style={{ width: `${weeklyPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
