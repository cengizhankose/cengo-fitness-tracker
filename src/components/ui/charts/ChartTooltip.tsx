import type { TooltipProps } from 'recharts'
import { formatDecimal } from '../number'
import { formatTooltipDate } from './chartFormat'

export interface ChartTooltipProps extends TooltipProps<number, string> {
  unit?: string
}

/** Recharts tooltip body: Turkish date heading + one tabular row per series. */
export function ChartTooltip({ active, payload, label, unit }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border-strong bg-raised px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-text-muted">{formatTooltipDate(String(label))}</p>
      {payload.map((p) =>
        typeof p.value === 'number' ? (
          <p key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-muted">
              <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-text tabular-nums">
              {formatDecimal(p.value, 1)}
              {unit ? ` ${unit}` : ''}
            </span>
          </p>
        ) : null,
      )}
    </div>
  )
}
