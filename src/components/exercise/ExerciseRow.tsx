import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ListRow, Sparkline, TrendBadge } from '@/components/ui'
import type { ExerciseSummary } from '@/lib/exerciseStats'
import { formatNumber } from '@/lib/format'
import { dayMetric, lastTopSetLine, metricFor, trainingDaysOldestFirst } from './exerciseView'

/** Days plotted in a row's sparkline. */
const SPARK_DAYS = 8

export interface ExerciseRowProps {
  summary: ExerciseSummary
}

/**
 * Catalog row: name, last top set with effort and date, trend and sparkline; links to the detail.
 * The load/effort/date line never truncates: the sparkline needs 2+ training days and is dropped
 * on narrow rows (container query) before the text would be squeezed; the text wraps as a last resort.
 */
export function ExerciseRow({ summary }: ExerciseRowProps) {
  const { exerciseName, unit, trainingDays, trend } = summary
  const values = useMemo(
    () =>
      trainingDaysOldestFirst(summary)
        .slice(-SPARK_DAYS)
        .flatMap((d) => dayMetric(d) ?? []),
    [summary],
  )

  let trailing: ReactNode
  if (trainingDays > 0) {
    const showSpark = trainingDays >= 2 && values.length >= 2
    const u = metricFor(unit).unit
    const label = `${exerciseName} son ${values.length} gün: ${formatNumber(values[0] ?? 0, 2)} → ${formatNumber(values.at(-1) ?? 0, 2)} ${u}`
    trailing = (
      <>
        <TrendBadge trend={trend} />
        {showSpark && (
          <span className="hidden @[26rem]:inline-flex">
            <Sparkline values={values} label={label} width={56} height={28} />
          </span>
        )}
      </>
    )
  }

  return (
    <ListRow
      className="@container"
      to={`/exercises/${encodeURIComponent(exerciseName)}`}
      title={exerciseName}
      subtitle={<span className="whitespace-normal">{lastTopSetLine(summary)}</span>}
      trailing={trailing}
    />
  )
}
