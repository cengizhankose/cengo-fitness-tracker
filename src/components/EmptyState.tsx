import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-1/50 px-6 py-10 text-center">
      <Icon size={32} className="text-text-faint" />
      <div>
        <p className="font-display font-semibold uppercase tracking-wide text-text">{title}</p>
        {hint && <p className="mt-1 text-sm text-text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}
