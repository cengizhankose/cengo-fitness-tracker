import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  unit?: string
  isEmpty?: boolean
  emptyHint?: string
  /** Hint shown *below* a chart that still has something worth drawing (e.g. a goal band). */
  note?: string
  children: ReactNode
}

export function ChartCard({ title, unit, isEmpty, emptyHint, note, children }: ChartCardProps) {
  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h2>
        {unit && <span className="text-xs text-text-faint">{unit}</span>}
      </div>
      {isEmpty ? (
        <div className="grid h-[160px] place-items-center text-center text-sm text-text-faint">
          {emptyHint ?? 'No data yet'}
        </div>
      ) : (
        <>
          {children}
          {note && <p className="mt-2 text-center text-sm text-text-faint">{note}</p>}
        </>
      )}
    </section>
  )
}
