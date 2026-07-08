import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-border/70 bg-bg/80 backdrop-blur-md">
      <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-3">
        <div className="min-w-0">
          <h1 className="font-display text-display font-bold uppercase tracking-wide text-text">
            {title}
          </h1>
          {subtitle && <p className="truncate text-xs text-text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  )
}
