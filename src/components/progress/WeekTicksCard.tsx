import { Card, ProgressBar } from '@/components/ui'
import { CHECKLIST_META } from '@/lib/checklistMeta'
import type { WeekOverview } from '@/lib/week'
import type { ChecklistKey } from '@/types/plan'
import type { IsoDate } from '@/types/userData'

const KEYS: readonly ChecklistKey[] = ['hitProteinTarget', 'inBedByMidnight']

/** This week's protein and bedtime ticks out of the days elapsed so far. */
export function WeekTicksCard({ overview, today }: { overview: WeekOverview; today: IsoDate }) {
  const elapsed = overview.days.filter((d) => d.date <= today)
  return (
    <Card title="Bu hafta" aside={`${elapsed.length}. gün`}>
      <div className="flex flex-col gap-4">
        {KEYS.map((key) => {
          const done = elapsed.filter((d) => d.checklist[key]).length
          return (
            <ProgressBar
              key={key}
              label={CHECKLIST_META[key].label}
              value={done}
              max={elapsed.length}
              valueText={`${done}/${elapsed.length} gün`}
              tone={done === elapsed.length ? 'success' : 'accent'}
            />
          )
        })}
      </div>
    </Card>
  )
}
