import type { ReactNode } from 'react'
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { IsoDate } from '@/types/userData'
import { Card } from '../Card'
import { formatDecimal } from '../number'
import { TONE_COLOR } from '../tones'
import type { Tone } from '../tones'
import { ChartTooltip } from './ChartTooltip'
import {
  AXIS_STROKE,
  AXIS_TICK,
  CHART_MARGIN,
  DEFAULT_CHART_HEIGHT,
  Y_AXIS_WIDTH,
  formatTickDate,
} from './chartFormat'

export interface LinePoint {
  date: IsoDate
  /** null = gap (line is connected across it). */
  value: number | null
  /** Second series, e.g. a weekly average. */
  value2?: number | null
}

export interface GoalBand {
  low: number
  high: number
  label?: string
}

export interface GoalLine {
  value: number
  label?: string
}

export interface LineChartCardProps {
  title: string
  data: readonly LinePoint[]
  /** Series name shown in the tooltip. */
  seriesLabel: string
  /** Enables the second series (`value2`). */
  series2Label?: string
  unit?: string
  /** Default 'accent'. */
  tone?: Tone
  goalBand?: GoalBand
  goalLine?: GoalLine
  aside?: ReactNode
  /** Shown instead of the chart when no point has a value. Default "Henüz veri yok". */
  emptyHint?: string
  /** Screen-reader summary; generated from first/last value when omitted. */
  summary?: string
  /** Default 180. */
  height?: number
}

function numbers(data: readonly LinePoint[]): number[] {
  const out: number[] = []
  for (const p of data) {
    if (p.value != null) out.push(p.value)
    if (p.value2 != null) out.push(p.value2)
  }
  return out
}

/** Date-series line chart in a Card: optional second series, goal band/line, Turkish ticks. */
export function LineChartCard({
  title,
  data,
  seriesLabel,
  series2Label,
  unit,
  tone = 'accent',
  goalBand,
  goalLine,
  aside,
  emptyHint = 'Henüz veri yok',
  summary,
  height = DEFAULT_CHART_HEIGHT,
}: LineChartCardProps) {
  const values = numbers(data)
  const bounds = [...values]
  if (goalBand) bounds.push(goalBand.low, goalBand.high)
  if (goalLine) bounds.push(goalLine.value)
  const domain: [number, number] =
    bounds.length > 0
      ? [Math.floor(Math.min(...bounds) - 1), Math.ceil(Math.max(...bounds) + 1)]
      : [0, 1]

  const main = data.filter((p) => p.value != null)
  const first = main[0]?.value
  const last = main.at(-1)?.value
  const u = unit ? ` ${unit}` : ''
  const label =
    summary ??
    (first != null && last != null
      ? `${title}: ${formatDecimal(first, 1)}${u} → ${formatDecimal(last, 1)}${u}, ${main.length} kayıt.`
      : `${title}: veri yok.`)
  const color = TONE_COLOR[tone]
  const dots = data.length <= 24

  return (
    <Card title={title} aside={aside}>
      {values.length === 0 ? (
        <p className="grid place-items-center text-center text-sm text-text-muted" style={{ height }}>
          {emptyHint}
        </p>
      ) : (
        <div role="img" aria-label={label} className="-mx-2">
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data as LinePoint[]} margin={CHART_MARGIN}>
              <CartesianGrid stroke={AXIS_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTickDate}
                tick={AXIS_TICK}
                stroke={AXIS_STROKE}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={AXIS_TICK}
                stroke={AXIS_STROKE}
                width={Y_AXIS_WIDTH}
                allowDecimals={false}
                domain={domain}
              />
              {goalBand && (
                <ReferenceArea
                  y1={goalBand.low}
                  y2={goalBand.high}
                  fill="var(--color-success)"
                  fillOpacity={0.12}
                  ifOverflow="extendDomain"
                >
                  {goalBand.label && (
                    <Label
                      value={goalBand.label}
                      position="insideTopLeft"
                      fill="var(--color-success)"
                      fontSize={10}
                    />
                  )}
                </ReferenceArea>
              )}
              {goalLine && (
                <ReferenceLine
                  y={goalLine.value}
                  stroke="var(--color-success)"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                >
                  {goalLine.label && (
                    <Label
                      value={goalLine.label}
                      position="insideBottomRight"
                      fill="var(--color-success)"
                      fontSize={10}
                    />
                  )}
                </ReferenceLine>
              )}
              <Tooltip
                content={<ChartTooltip unit={unit} />}
                cursor={{ stroke: 'var(--color-border-strong)' }}
              />
              {series2Label && (
                <Line
                  type="monotone"
                  dataKey="value2"
                  name={series2Label}
                  stroke="var(--color-text-muted)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                name={seriesLabel}
                stroke={color}
                strokeWidth={2.5}
                dot={dots ? { r: 2.5, fill: color, strokeWidth: 0 } : false}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
