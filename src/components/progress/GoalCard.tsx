import { CircleAlert, CircleCheck, Scale, Trophy } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ProgressBar, Stat, StatGrid } from '@/components/ui'
import { parseLocalISODate } from '@/lib/dates'
import { formatNumber, formatRange } from '@/lib/format'
import type { GoalProgress } from '@/lib/weight'
import type { Goal } from '@/types/plan'

export interface GoalCardProps {
  goal: Goal
  progress: GoalProgress
  /** Weeks with at least one weigh-in; the on-track verdict needs two. */
  weeksWithData: number
  onAddFirst: () => void
}

/** Start → current weekly average → first milestone, with the distance done and left. */
export function GoalCard({ goal, progress, weeksWithData, onAddFirst }: GoalCardProps) {
  const deadline = parseLocalISODate(goal.milestoneDate).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const { currentKg, lostKg, toMilestoneKg, milestoneReached } = progress

  return (
    <Card title="Hedef" aside={`${formatRange(goal.milestoneKg, 'kg')} · ${deadline}`}>
      {currentKg == null || lostKg == null || toMilestoneKg == null ? (
        <EmptyState
          icon={Scale}
          title="Henüz tartı yok"
          hint={`Başlangıç ${formatNumber(goal.startKg, 1)} kg. Sabah aç karnına tartıl, buraya gir.`}
          action={
            <Button icon={Scale} onClick={onAddFirst}>
              İlk tartını gir
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <StatGrid cols={3}>
            <Stat label="Başlangıç" value={goal.startKg} unit="kg" />
            <Stat label="Şimdi" value={currentKg} unit="kg" hint="haftalık ort." />
            <Stat
              label="İlk hedef"
              value={`${formatNumber(goal.milestoneKg.min, 1)}–${formatNumber(goal.milestoneKg.max, 1)}`}
              unit="kg"
            />
          </StatGrid>
          <ProgressBar
            label="Yol"
            value={Math.round(progress.fraction * 100)}
            max={100}
            valueText={`%${Math.round(progress.fraction * 100)}`}
            tone={milestoneReached ? 'success' : 'accent'}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-text-muted">
              <span className="font-semibold text-text tabular-nums">
                {formatNumber(Math.abs(lostKg), 1)} kg
              </span>{' '}
              {lostKg < 0 ? 'aldın' : 'verdin'}
              {!milestoneReached && (
                <>
                  {' · '}
                  <span className="font-semibold text-text tabular-nums">
                    {formatNumber(toMilestoneKg, 1)} kg
                  </span>{' '}
                  kaldı
                </>
              )}
            </p>
            {milestoneReached ? (
              <Badge tone="success" icon={Trophy}>
                İlk hedef tamam
              </Badge>
            ) : (
              weeksWithData >= 2 &&
              (progress.onTrack ? (
                <Badge tone="success" icon={CircleCheck}>
                  Plandasın
                </Badge>
              ) : (
                <Badge tone="warning" icon={CircleAlert}>
                  Planın gerisinde
                </Badge>
              ))
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
