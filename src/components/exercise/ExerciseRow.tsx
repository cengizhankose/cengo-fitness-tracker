import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ListRow, Sparkline, TrendBadge, formatDecimal } from '@/components/ui'
import type { ExerciseSummary } from '@/lib/exerciseStats'
import { dayMetric, lastTopSetLine, metricFor, trainingDaysOldestFirst } from './exerciseView'

/** Days plotted in a row's sparkline. */
const SPARK_DAYS = 8

export interface ExerciseRowProps {
  summary: ExerciseSummary
}

/** Catalog row: name, last top set with effort and date, trend and sparkline; links to the detail. */
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
    const u = metricFor(unit).unit
    const first = values[0] ?? 0
    const last = values.at(-1) ?? 0
    const label =
      values.length > 1
        ? `${exerciseName} son ${values.length} gün: ${formatDecimal(first)} → ${formatDecimal(last)} ${u}`
        : `${exerciseName}: ${formatDecimal(last)} ${u}`
    trailing = (
      <>
        <TrendBadge trend={trend} />
        <Sparkline values={values} label={label} width={56} height={28} />
      </>
    )
  }

  return (
    <ListRow
      to={`/exercises/${encodeURIComponent(exerciseName)}`}
      title={exerciseName}
      subtitle={lastTopSetLine(summary)}
      trailing={trailing}
    />
  )
}
