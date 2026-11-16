import type { ReactNode } from 'react'
import { cx } from './cx'
import { useRovingRadio } from './useRovingRadio'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group (not shown). */
  label: string
  /** 2–4 options. */
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** 2–4 option single-select switch (radiogroup; arrow keys move the selection). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const radio = useRovingRadio({
    values: options.map((o) => o.value),
    selected: value,
    onSelect: onChange,
  })
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'grid auto-cols-fr grid-flow-col gap-1 rounded-md border border-border bg-card p-1',
        className,
      )}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          {...radio(i)}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-tap rounded-sm px-2 text-sm font-semibold transition-colors',
            o.value === value ? 'bg-volt/15 text-volt' : 'text-text-muted active:bg-raised',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
