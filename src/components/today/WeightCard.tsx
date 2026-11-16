import { useMemo, useState } from 'react'
import { Scale } from 'lucide-react'
import { Button, Card, ListRow, Stat, StatGrid } from '@/components/ui'
import { WeighInSheet } from '@/components/progress/WeighInSheet'
import { formatShortDate, mondayOf } from '@/lib/dates'
import { kg } from '@/lib/format'
import { plan } from '@/lib/plan'
import { latestWeight, weeklyAverages } from '@/lib/weight'
import { useCheckIns } from '@/store/selectors'
import type { IsoDate } from '@/types/userData'

export interface WeightCardProps {
  today: IsoDate
}

/** Latest weigh-in and this week's average, with the weigh-in sheet; an inviting row before the first one. */
export function WeightCard({ today }: WeightCardProps) {
  const checkIns = useCheckIns()
  const [open, setOpen] = useState(false)
  const latest = useMemo(() => latestWeight(checkIns), [checkIns])
  const weekAvg = useMemo(
    () => weeklyAverages(checkIns).find((w) => w.weekStart === mondayOf(today)),
    [checkIns, today],
  )

  return (
    <>
      {latest ? (
        <Card
          title="Kilo"
          aside={
            <Button variant="secondary" icon={Scale} onClick={() => setOpen(true)}>
              Tartı gir
            </Button>
          }
        >
          <StatGrid>
            <Stat
              label="Son tartı"
              value={latest.value}
              unit="kg"
              hint={latest.date === today ? 'Bugün' : formatShortDate(latest.date)}
            />
            <Stat
              label="Bu hafta ort."
              value={weekAvg?.avgKg ?? '—'}
              unit={weekAvg ? 'kg' : undefined}
              hint={weekAvg ? `${weekAvg.count} tartı` : undefined}
            />
          </StatGrid>
        </Card>
      ) : (
        <Card flush>
          <ListRow
            leading={<Scale size={22} aria-hidden className="text-volt" />}
            title="Tartı gir"
            subtitle={`Başlangıç ${kg(plan.goal.startKg)}`}
            onClick={() => setOpen(true)}
          />
        </Card>
      )}
      <WeighInSheet open={open} onClose={() => setOpen(false)} date={today} />
    </>
  )
}
