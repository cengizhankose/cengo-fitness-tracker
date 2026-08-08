import { useId, type Ref } from 'react'

interface TimeInputProps {
  label: string
  value: string
  /** Shown under the field while there is no error (also announced via aria-describedby). */
  hint?: string
  error?: string
  placeholder?: string
  inputRef?: Ref<HTMLInputElement>
  onChange: (value: string) => void
}

/** Free-text "mm:ss" field — numeric keypad on mobile, but `:` stays typeable. */
export function TimeInput({
  label,
  value,
  hint,
  error,
  placeholder = '24:30',
  inputRef,
  onChange,
}: TimeInputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div
        className={`flex items-center rounded-md border bg-surface-2 px-3 ${
          error ? 'border-heat' : 'border-border focus-within:border-volt'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9:]*"
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="tnum w-full bg-transparent py-3 text-right font-display text-stat-md font-semibold text-text outline-none placeholder:text-text-faint"
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-heat">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-text-faint">
            {hint}
          </p>
        )
      )}
    </label>
  )
}
