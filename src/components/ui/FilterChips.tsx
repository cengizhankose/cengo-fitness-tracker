import type { ReactNode } from 'react'
import { cx } from './cx'
import { useRovingRadio } from './useRovingRadio'

export interface ChipOption<T extends string> {
  value: T
  label: ReactNode
  /** Optional count shown after the label. */
  count?: number
}

export interface FilterChipsProps<T extends string> {
  /** Accessible name of the group (not shown). */
  label: string
  options: readonly ChipOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** Single-select pill row that scrolls horizontally past the page gutter. */
export function FilterChips<T extends string>({ label, options, value, onChange }: FilterChipsProps<T>) {
  const radio = useRovingRadio({
    values: options.map((o) => o.value),
    selected: value,
    onSelect: onChange,
  })
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="no-scrollbar -mx-gutter flex gap-2 overflow-x-auto px-gutter py-0.5"
    >
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            {...radio(i)}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
              selected
                ? 'border-volt/50 bg-volt/15 text-volt'
                : 'border-border bg-card text-text-muted active:bg-raised',
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cx('tabular-nums', selected ? 'text-volt' : 'text-text-faint')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
