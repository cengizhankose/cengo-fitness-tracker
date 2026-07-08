import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ChecklistItemProps {
  label: string
  icon: LucideIcon
  checked: boolean
  onToggle: () => void
}

export function ChecklistItem({ label, icon: Icon, checked, onToggle }: ChecklistItemProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
        checked
          ? 'border-success/40 bg-success/10'
          : 'border-border bg-surface-2 active:bg-surface-3'
      }`}
    >
      <Icon size={20} className={checked ? 'text-success' : 'text-text-faint'} />
      <span
        className={`flex-1 text-sm font-medium ${checked ? 'text-text' : 'text-text-muted'}`}
      >
        {label}
      </span>
      <span
        className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-colors ${
          checked ? 'border-success bg-success text-on-accent' : 'border-border-strong text-transparent'
        }`}
      >
        <Check size={16} strokeWidth={3} />
      </span>
    </button>
  )
}
