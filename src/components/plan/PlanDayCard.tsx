import { useId } from 'react'
import { Check } from 'lucide-react'
import { Badge, Card, ListRow } from '@/components/ui'
import { DAY_LABEL_TR, formatDayMonth } from '@/lib/dates'
import { BLOCK_COLOR, BLOCK_ICON } from '@/lib/planMeta'
import type { WeekDayOverview } from '@/lib/week'
import type { Range, SessionId } from '@/types/plan'
import { blockDone, describeBlock } from './blockText'

export interface PlanDayCardProps {
  day: WeekDayOverview
  isToday: boolean
  /** This week's Sunday long-run target. */
  longRunTargetKm: number | Range
  /** Opens the session sheet of a strength block. */
  onOpenSession: (id: SessionId) => void
}

/** One weekday of the plan: its label and every planned block; strength blocks open their session. */
export function PlanDayCard({ day, isToday, longRunTargetKm, onOpenSession }: PlanDayCardProps) {
  const titleId = useId()
  const allOptional = day.blocks.length > 0 && day.blocks.every((b) => b.optional)
  return (
    <li aria-labelledby={titleId} aria-current={isToday ? 'date' : undefined}>
      <Card
        as="div"
        titleAs="h3"
        flush
        tone={isToday ? 'accent' : undefined}
        title={
          <span id={titleId} className="flex items-baseline gap-2">
            {DAY_LABEL_TR[day.dayName]}{' '}
            <span className="num text-sm font-normal text-text-muted">{formatDayMonth(day.date)}</span>
          </span>
        }
        aside={
          isToday || allOptional ? (
            <span className="flex items-center gap-2">
              {allOptional && 'Birini seç ya da dinlen'}
              {isToday && <Badge tone="accent">Bugün</Badge>}
            </span>
          ) : undefined
        }
      >
        {day.blocks.map((block, i) => {
          const { title, detail } = describeBlock(block, longRunTargetKm)
          const Icon = BLOCK_ICON[block.type]
          const done = blockDone(day, block)
          return (
            <ListRow
              key={i}
              leading={<Icon size={20} aria-hidden style={{ color: BLOCK_COLOR[block.type] }} />}
              title={title}
              subtitle={detail}
              trailing={
                done || block.optional ? (
                  <>
                    {block.optional && <Badge>Opsiyonel</Badge>}
                    {done && (
                      <Badge tone="success" icon={Check}>
                        Yapıldı
                      </Badge>
                    )}
                  </>
                ) : undefined
              }
              onClick={block.type === 'strength' ? () => onOpenSession(block.sessionId) : undefined}
            />
          )
        })}
      </Card>
    </li>
  )
}
