import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
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

export interface BarPoint {
  /** Monday of the week. */
  weekStart: IsoDate
  value: number
}

export interface BarChartCardProps {
  title: string
  data: readonly BarPoint[]
  /** Series name shown in the tooltip. */
  seriesLabel: string
  unit?: string
  /** Weekly target: drawn as a dashed line; bars that reach it use the tone colour. */
  target?: number
  targetLabel?: string
  /** Default 'accent'. */
  tone?: Tone
  aside?: ReactNode
  /** Shown instead of the chart when there are no weeks. Default "Henüz veri yok". */
  emptyHint?: string
  /** Screen-reader summary; generated when omitted. */
  summary?: string
  /** Default 180. */
  height?: number
}

/** Weekly bar chart in a Card with an optional target line; Turkish week ticks. */
export function BarChartCard({
  title,
  data,
  seriesLabel,
  unit,
  target,
  targetLabel,
  tone = 'accent',
  aside,
  emptyHint = 'Henüz veri yok',
  summary,
  height = DEFAULT_CHART_HEIGHT,
}: BarChartCardProps) {
  const color = TONE_COLOR[tone]
  const top = Math.max(target ?? 0, ...data.map((d) => d.value))
  const u = unit ? ` ${unit}` : ''
  const last = data.at(-1)
  const label =
    summary ??
    (last
      ? `${title}: son hafta ${formatDecimal(last.value, 1)}${u}${
          target != null ? `, hedef ${formatDecimal(target, 1)}${u}` : ''
        }, ${data.length} hafta.`
      : `${title}: veri yok.`)

  return (
    <Card title={title} aside={aside}>
      {data.length === 0 ? (
        <p className="grid place-items-center text-center text-sm text-text-muted" style={{ height }}>
          {emptyHint}
        </p>
      ) : (
        <div role="img" aria-label={label} className="-mx-2">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data as BarPoint[]} margin={CHART_MARGIN}>
              <CartesianGrid stroke={AXIS_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="weekStart"
                tickFormatter={formatTickDate}
                tick={AXIS_TICK}
                stroke={AXIS_STROKE}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={AXIS_TICK}
                stroke={AXIS_STROKE}
                width={Y_AXIS_WIDTH}
                domain={[0, Math.max(1, Math.ceil(top * 1.15))]}
              />
              <Tooltip
                content={<ChartTooltip unit={unit} />}
                cursor={{ fill: 'var(--color-raised)', fillOpacity: 0.6 }}
              />
              {target != null && (
                <ReferenceLine y={target} stroke="var(--color-text-muted)" strokeDasharray="4 4">
                  {targetLabel && (
                    <Label
                      value={targetLabel}
                      position="insideTopRight"
                      fill="var(--color-text-muted)"
                      fontSize={10}
                    />
                  )}
                </ReferenceLine>
              )}
              <Bar dataKey="value" name={seriesLabel} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell
                    key={d.weekStart}
                    fill={target == null || d.value >= target ? color : 'var(--color-border-strong)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
