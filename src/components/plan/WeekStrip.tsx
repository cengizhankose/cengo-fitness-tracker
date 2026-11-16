import { Check } from 'lucide-react'
import { DAY_LABEL_TR, DAY_SHORT_TR, parseLocalISODate } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { BLOCK_COLOR, BLOCK_ICON, BLOCK_LABEL } from '@/lib/planMeta'
import type { WeekOverview } from '@/lib/week'
import type { IsoDate } from '@/types/userData'
import { blockDone } from './blockText'

export interface WeekStripProps {
  overview: WeekOverview
  today: IsoDate
}

/**
 * Monday–Sunday row: short day label, one glyph per planned block (filled with a check when
 * the strength/run of that day is done, faded when optional), today marked; then the week's
 * total ("3/5 seans · 12 km").
 */
export function WeekStrip({ overview, today }: WeekStripProps) {
  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Hafta özeti" className="grid grid-cols-7 gap-1">
        {overview.days.map((day) => {
          const isToday = day.date === today
          const blockWords = day.blocks.map((block) => {
            const words = [BLOCK_LABEL[block.type]]
            if (block.optional) words.push('opsiyonel')
            if (blockDone(day, block)) words.push('yapıldı')
            return words.join(' ')
          })
          const label = `${DAY_LABEL_TR[day.dayName]}${isToday ? ', bugün' : ''}: ${
            blockWords.length > 0 ? blockWords.join(', ') : 'dinlenme'
          }`
          return (
            <li
              key={day.date}
              aria-label={label}
              aria-current={isToday ? 'date' : undefined}
              className={
                isToday
                  ? 'flex flex-col items-center gap-1 rounded-md border border-volt bg-volt/10 py-2'
                  : 'flex flex-col items-center gap-1 rounded-md border border-transparent py-2'
              }
            >
              <span
                aria-hidden
                className={isToday ? 'text-xs font-semibold text-volt' : 'text-xs font-medium text-text-muted'}
              >
                {DAY_SHORT_TR[day.dayName]}
              </span>
              <span aria-hidden className="num text-sm">
                {parseLocalISODate(day.date).getDate()}
              </span>
              <span aria-hidden className="flex flex-col items-center gap-1">
                {day.blocks.map((block, i) => {
                  const color = BLOCK_COLOR[block.type]
                  const Icon = BLOCK_ICON[block.type]
                  if (blockDone(day, block)) {
                    return (
                      <span
                        key={i}
                        className="grid size-6 place-items-center rounded-full text-on-volt"
                        style={{ backgroundColor: color }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )
                  }
                  return (
                    <span
                      key={i}
                      className={
                        block.optional
                          ? 'grid size-6 place-items-center rounded-full border border-dashed opacity-60'
                          : 'grid size-6 place-items-center rounded-full border'
                      }
                      style={{ color, borderColor: color }}
                    >
                      <Icon size={13} />
                    </span>
                  )
                })}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="num px-1 text-sm text-text-muted">
        {overview.strengthDays.done}/{overview.strengthDays.planned} seans · {formatNumber(overview.runKm)} km
      </p>
    </div>
  )
}
