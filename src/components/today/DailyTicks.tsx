import { Badge, Card, CheckRow } from '@/components/ui'
import { CHECKLIST_META } from '@/lib/checklistMeta'
import { plan } from '@/lib/plan'
import { useStore } from '@/store'
import { useChecklistRecord } from '@/store/selectors'
import type { IsoDate } from '@/types/userData'

export interface DailyTicksProps {
  date: IsoDate
}

/** The three daily ticks of a date. The workout tick shows when logging ticked it and stays toggleable. */
export function DailyTicks({ date }: DailyTicksProps) {
  const record = useChecklistRecord(date)
  const setChecklistItem = useStore((s) => s.setChecklistItem)
  const done = plan.dailyChecklist.filter((key) => record?.items[key] === true).length

  return (
    <Card title="Günlük" aside={<span className="tabular-nums">{done}/{plan.dailyChecklist.length}</span>}>
      <div className="-mx-3 -my-1 flex flex-col">
        {plan.dailyChecklist.map((key) => {
          const checked = record?.items[key] === true
          return (
            <CheckRow
              key={key}
              label={CHECKLIST_META[key].label}
              checked={checked}
              onChange={(value) => setChecklistItem(date, key, value)}
              trailing={
                key === 'completedWorkout' && checked && record?.autoWorkout ? (
                  <Badge>Otomatik</Badge>
                ) : undefined
              }
            />
          )
        })}
      </div>
    </Card>
  )
}
