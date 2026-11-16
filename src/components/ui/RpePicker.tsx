import { useId } from 'react'
import { cx } from './cx'
import { RPE_SCALE } from './rpe'
import { useRovingRadio } from './useRovingRadio'

export interface RpePickerProps {
  /** Selected RPE (6–10) or undefined when not rated. */
  value: number | undefined
  onChange: (value: number | undefined) => void
  /** Visible group label. Default "Efor (RPE)". */
  label?: string
  disabled?: boolean
}

const VALUES = RPE_SCALE.map((s) => s.value as number)

/** RPE 6–10 chips with a Turkish word each; tap the selected chip (or Delete) to clear. */
export function RpePicker({ value, onChange, label = 'Efor (RPE)', disabled }: RpePickerProps) {
  const labelId = useId()
  const radio = useRovingRadio<number>({
    values: VALUES,
    selected: value,
    onSelect: onChange,
    onClear: () => onChange(undefined),
  })
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-text-muted">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-5 gap-1.5">
        {RPE_SCALE.map((s, i) => {
          const selected = s.value === value
          return (
            <button
              key={s.value}
              {...radio(i)}
              disabled={disabled}
              aria-label={`RPE ${s.value}, ${s.word}`}
              onClick={() => onChange(selected ? undefined : s.value)}
              className={cx(
                'flex min-h-tap-lg flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 transition-colors disabled:opacity-50',
                selected
                  ? 'border-volt/60 bg-volt/15 text-volt'
                  : 'border-border bg-raised text-text active:bg-border',
              )}
            >
              <span aria-hidden className="num text-num-sm">
                {s.value}
              </span>
              <span
                aria-hidden
                className={cx(
                  'text-[0.6875rem] leading-tight font-medium',
                  selected ? 'text-volt' : 'text-text-muted',
                )}
              >
                {s.word}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
