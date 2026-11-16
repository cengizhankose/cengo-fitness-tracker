import { Card, ListRow, formatDecimal } from '@/components/ui'
import { formatShortDate } from '@/lib/dates'
import type { MetricPoint } from '@/lib/weight'
import type { CheckIn, IsoDate } from '@/types/userData'

const SHOWN = 10

export interface RecentWeighInsProps {
  /** `weightSeries` (oldest first). */
  series: readonly MetricPoint[]
  checkIns: Readonly<Record<IsoDate, CheckIn>>
  onEdit: (date: IsoDate) => void
}

/** Latest weigh-ins, newest first; a row opens that day in the weigh-in sheet. */
export function RecentWeighIns({ series, checkIns, onEdit }: RecentWeighInsProps) {
  if (series.length === 0) return null
  const rows = series.slice(-SHOWN).reverse()
  return (
    <Card title="Son tartılar" flush>
      {rows.map(({ date, value }) => {
        const { waistCm, notes } = checkIns[date] ?? {}
        const extra = [waistCm != null ? `bel ${formatDecimal(waistCm, 1)} cm` : undefined, notes]
          .filter(Boolean)
          .join(' · ')
        return (
          <ListRow
            key={date}
            title={formatShortDate(date)}
            subtitle={extra || undefined}
            trailing={
              <span className="text-lg font-semibold tabular-nums">
                {formatDecimal(value, 1)} <span className="text-sm font-medium text-text-muted">kg</span>
              </span>
            }
            onClick={() => onEdit(date)}
          />
        )
      })}
    </Card>
  )
}
