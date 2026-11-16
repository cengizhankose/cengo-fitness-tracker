import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  /** Default Inbox. */
  icon?: LucideIcon
  title: string
  hint?: ReactNode
  /** Usually a Button. */
  action?: ReactNode
}

/** Centred icon + short message (+ optional action) for empty lists and screens. */
export function EmptyState({ icon: Icon = Inbox, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-raised text-text-muted">
        <Icon size={26} aria-hidden />
      </span>
      <p className="text-base font-semibold">{title}</p>
      {hint != null && <p className="max-w-xs text-sm text-text-muted">{hint}</p>}
      {action != null && <div className="mt-1">{action}</div>}
    </div>
  )
}
