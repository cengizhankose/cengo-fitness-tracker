import type { LucideIcon } from 'lucide-react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-surface-1 p-1">
      {options.map((opt) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-colors ${
              active ? 'bg-volt text-on-accent' : 'text-text-muted active:bg-surface-2'
            }`}
          >
            {Icon && <Icon size={16} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
