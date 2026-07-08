interface MetricInputProps {
  label: string
  value: number | ''
  unit?: string
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
  step?: number
  onChange: (value: number | '') => void
}

export function MetricInput({
  label,
  value,
  unit,
  placeholder,
  inputMode = 'decimal',
  step,
  onChange,
}: MetricInputProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 focus-within:border-volt">
        <input
          type="number"
          inputMode={inputMode}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="tnum w-full bg-transparent py-3 text-right font-display text-stat-md font-semibold text-text outline-none placeholder:text-text-faint"
        />
        {unit && <span className="shrink-0 text-sm font-medium text-text-faint">{unit}</span>}
      </div>
    </label>
  )
}
