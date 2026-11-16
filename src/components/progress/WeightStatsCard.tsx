import { Card, Stat, StatGrid, TrendBadge } from '@/components/ui'
import { formatShortDate } from '@/lib/dates'
import type { MetricPoint, WeeklyAverage } from '@/lib/weight'
import { formatNumber } from '@/lib/format'

export interface WeightStatsCardProps {
  latest?: MetricPoint
  /** The current week's average, when it has a weigh-in. */
  thisWeek?: WeeklyAverage
  /** `weeklyChangeKg`: last week with weigh-ins vs the one before (negative = lost). */
  changeKg?: number
}

/** Mornings per week the plan asks for. */
export const WEIGH_INS_PER_WEEK = 3

/** Last weigh-in, this week's average and the change vs the previous weekly average. */
export function WeightStatsCard({ latest, thisWeek, changeKg }: WeightStatsCardProps) {
  return (
    <Card title="Tartı" aside={`haftada en az ${WEIGH_INS_PER_WEEK} sabah`}>
      <StatGrid cols={3}>
        <Stat
          label="Son tartı"
          value={latest?.value ?? '—'}
          unit={latest ? 'kg' : undefined}
          hint={latest ? formatShortDate(latest.date) : undefined}
        />
        <Stat
          label="Bu hafta ort."
          value={thisWeek?.avgKg ?? '—'}
          unit={thisWeek ? 'kg' : undefined}
          hint={`${thisWeek?.count ?? 0}/${WEIGH_INS_PER_WEEK} sabah`}
        />
        <Stat
          label="Haftalık fark"
          value={
            changeKg == null
              ? '—'
              : `${changeKg > 0 ? '+' : changeKg < 0 ? '−' : ''}${formatNumber(Math.abs(changeKg), 1)}`
          }
          unit={changeKg == null ? undefined : 'kg'}
          hint={
            changeKg == null ? (
              '2 hafta gerekir'
            ) : (
              <TrendBadge trend={changeKg < 0 ? 'down' : changeKg > 0 ? 'up' : 'flat'} good="down" />
            )
          }
        />
      </StatGrid>
    </Card>
  )
}
