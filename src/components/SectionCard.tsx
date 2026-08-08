import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface SectionCardProps {
  /** Optional anchor slug — wires up `id`/`data-section` and sticky-header scroll margin. */
  sectionId?: string
  title?: string
  icon?: LucideIcon
  accent?: string // CSS color (e.g. 'var(--color-volt)')
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({
  sectionId,
  title,
  icon: Icon,
  accent,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      id={sectionId ? `section-${sectionId}` : undefined}
      data-section={sectionId}
      className={`rounded-lg border border-border bg-surface-1 p-4 ${
        sectionId ? 'scroll-mt-24' : ''
      } ${className ?? ''}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={16} style={{ color: accent ?? 'var(--color-text-muted)' }} />}
            {title && (
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-text-muted">
                {title}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
