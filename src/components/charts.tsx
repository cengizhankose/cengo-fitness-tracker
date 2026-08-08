import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Label,
} from 'recharts'
import type { MetricPoint, WeeklyAgg } from '@/lib/derive'
import type { WeightGoal } from '@/lib/derive'
import { hasWeightBand, weightChartDomain } from '@/lib/derive'
import { formatDayMonth } from '@/lib/dates'

const HEIGHT = 170

const TOOLTIP_STYLE = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 12,
  color: 'var(--color-text)',
  fontSize: 12,
} as const

const AXIS_TICK = { fill: 'var(--color-text-muted)', fontSize: 11 } as const
const AXIS_STROKE = 'var(--color-border)'
const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const
const Y_AXIS_WIDTH = 36
const METRIC_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor(min - 1),
  (max) => Math.ceil(max + 1),
]

export function WeightChart({ data, goal }: { data: MetricPoint[]; goal?: WeightGoal }) {
  const domain = weightChartDomain(data, goal)
  const showBand = goal != null && hasWeightBand(goal)
  const first = data[0]?.value
  const last = data.at(-1)?.value
  const summary = [
    first != null && last != null
      ? `Weight trend, ${first} to ${last} kg over ${data.length} check-ins.`
      : 'Weight trend, no check-ins yet.',
    showBand ? `Target band ${goal.targetLow}–${goal.targetHigh} kg.` : '',
    goal ? `Start ${goal.start} kg.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="grad-weight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-volt)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-volt)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={AXIS_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayMonth}
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            width={Y_AXIS_WIDTH}
            allowDecimals={false}
            domain={domain}
          />
          {showBand && (
            <ReferenceArea
              y1={goal.targetLow}
              y2={goal.targetHigh}
              fill="var(--color-success)"
              fillOpacity={0.12}
            >
              <Label
                value={`Target ${goal.targetLow}–${goal.targetHigh} kg`}
                position="insideLeft"
                fill="var(--color-success)"
                fontSize={10}
              />
            </ReferenceArea>
          )}
          {goal && <ReferenceLine y={goal.start} stroke="var(--color-heat)" strokeDasharray="4 4" />}
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => formatDayMonth(String(v))} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-volt)"
            strokeWidth={2}
            fill="url(#grad-weight)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WaistChart({ data }: { data: MetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid stroke={AXIS_STROKE} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDayMonth}
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          width={Y_AXIS_WIDTH}
          allowDecimals={false}
          domain={METRIC_DOMAIN}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => formatDayMonth(String(v))} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-heat)"
          strokeWidth={2}
          dot={{ r: 2, fill: 'var(--color-heat)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function WorkoutsChart({ data }: { data: WeeklyAgg[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid stroke={AXIS_STROKE} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickFormatter={formatDayMonth}
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          width={Y_AXIS_WIDTH}
          domain={[0, 7]}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--color-surface-3)', fillOpacity: 0.4 }}
          labelFormatter={(v) => formatDayMonth(String(v))}
        />
        <Bar dataKey="value" fill="var(--color-volt)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RunKmChart({ data }: { data: WeeklyAgg[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <AreaChart data={data} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="grad-runkm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-run)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-run)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={AXIS_STROKE} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickFormatter={formatDayMonth}
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          width={Y_AXIS_WIDTH}
          allowDecimals={false}
          domain={[0, (max: number) => Math.ceil(max + 4)]}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => formatDayMonth(String(v))} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-run)"
          strokeWidth={2}
          fill="url(#grad-runkm)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
