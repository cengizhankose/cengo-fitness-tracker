// Imports recharts via the chart kit — only the lazily loaded detail route may import this file.
import { Card, Stat, StatGrid } from '@/components/ui'
import { LineChartCard } from '@/components/ui/charts'
import type { LinePoint } from '@/components/ui/charts'
import { formatDayMonth } from '@/lib/dates'
import { EASY_RPE } from '@/lib/exerciseStats'
import type { ExerciseSummary } from '@/lib/exerciseStats'
import { dayMetric, metricFor, trainingDaysOldestFirst } from './exerciseView'

export interface ExerciseChartsProps {
  summary: ExerciseSummary
}

/**
 * Top-set load (reps/seconds for non-kg units) and effort over time, as two charts so each
 * keeps its own scale at phone width. A series with a single point is shown as a plain number.
 */
export function ExerciseCharts({ summary }: ExerciseChartsProps) {
  const metric = metricFor(summary.unit)
  const days = trainingDaysOldestFirst(summary)
  const loadPoints: LinePoint[] = days.map((d) => ({ date: d.date, value: dayMetric(d) ?? null }))
  const rpePoints: LinePoint[] = days.flatMap((d) => (d.topRpe != null ? [{ date: d.date, value: d.topRpe }] : []))

  const lastLoad = loadPoints.at(-1)
  const lastRpe = rpePoints.at(-1)
  if (loadPoints.length < 2 && rpePoints.length < 2) {
    if (!lastLoad) return null
    return (
      <Card title="Gelişim" aside={formatDayMonth(lastLoad.date)}>
        <StatGrid>
          <Stat label={metric.series} value={lastLoad.value ?? '—'} unit={metric.unit} />
          <Stat label="Efor" value={lastRpe?.value != null ? `RPE ${lastRpe.value}` : '—'} />
        </StatGrid>
        <p className="mt-3 text-sm text-text-muted">Grafik ikinci antrenman gününden sonra çıkar.</p>
      </Card>
    )
  }

  return (
    <>
      <LineChartCard
        title={metric.title}
        data={loadPoints}
        seriesLabel={metric.series}
        unit={metric.unit}
      />
      {rpePoints.length >= 2 ? (
        <LineChartCard
          title="Efor (RPE)"
          data={rpePoints}
          seriesLabel="RPE"
          tone="warning"
          goalLine={{ value: EASY_RPE, label: 'artır' }}
          height={120}
        />
      ) : (
        lastRpe && (
          <Card title="Efor (RPE)" aside={formatDayMonth(lastRpe.date)}>
            <Stat label="Tek kayıt" value={lastRpe.value ?? '—'} />
          </Card>
        )
      )}
    </>
  )
}
