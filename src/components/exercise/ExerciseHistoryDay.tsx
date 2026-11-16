import { Badge, Button, Card } from '@/components/ui'
import { formatShortDate } from '@/lib/dates'
import type { ExerciseDay } from '@/lib/exerciseStats'
import { formatSetWithEffort, formatVolume } from './exerciseView'

export interface ExerciseHistoryDayProps {
  day: ExerciseDay
}

/** One training day of an exercise: every set in logged order, the day's volume and a link to the day. */
export function ExerciseHistoryDay({ day }: ExerciseHistoryDayProps) {
  const dateLabel = formatShortDate(day.date)
  return (
    <Card
      as="article"
      titleAs="h3"
      title={dateLabel}
      aside={<span className="tabular-nums">Hacim {formatVolume(day)}</span>}
      footer={
        <Button
          to={`/history?date=${day.date}`}
          variant="ghost"
          aria-label={`Günü aç: ${dateLabel}`}
        >
          Günü aç
        </Button>
      }
    >
      <ol className="flex flex-col gap-2">
        {day.sets.map((set, i) => (
          <li key={set.id ?? `${set.entryId}-${set.setIndex}`} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-sm tabular-nums text-text-faint">{i + 1}</span>
            <span className="tabular-nums">{formatSetWithEffort(set, day.unit)}</span>
            {set.kind === 'warmup' && <Badge>ısınma</Badge>}
          </li>
        ))}
      </ol>
    </Card>
  )
}
