import { useId } from 'react'
import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cx } from './cx'

export interface CheckRowProps {
  label: ReactNode
  /** Short second line under the label. */
  hint?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Non-interactive extra on the right (e.g. a Badge). */
  trailing?: ReactNode
}

/** Large tappable tick row (role="checkbox") with label and optional hint. */
export function CheckRow({ label, hint, checked, onChange, disabled, trailing }: CheckRowProps) {
  const hintId = useId()
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-describedby={hint != null ? hintId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-tap-lg w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors active:bg-raised disabled:opacity-60"
    >
      <span
        aria-hidden
        className={cx(
          'grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors',
          checked ? 'border-volt bg-volt text-on-volt' : 'border-border-strong',
        )}
      >
        {checked && <Check size={18} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{label}</span>
        {hint != null && (
          <span id={hintId} className="block text-sm text-text-muted">
            {hint}
          </span>
        )}
      </span>
      {trailing != null && <span className="shrink-0">{trailing}</span>}
    </button>
  )
}
