import { Minus, Plus } from 'lucide-react'

interface NumberStepperProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}

export function NumberStepper({
  label,
  value,
  min = 0,
  max = 999,
  step = 1,
  onChange,
}: NumberStepperProps) {
  const clamp = (n: number) => Math.min(Math.max(n, min), max)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-2 py-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="grid h-10 w-10 place-items-center rounded text-text-muted active:bg-surface-3"
        >
          <Minus size={18} />
        </button>
        <span className="tnum min-w-[2.5rem] text-center font-display text-stat-md font-semibold text-text">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="grid h-10 w-10 place-items-center rounded text-volt active:bg-surface-3"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}
