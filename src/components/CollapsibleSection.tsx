import { useRef } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { scrollBehavior } from '@/lib/motion'

interface CollapsibleSectionProps {
  /** Stable slug — drives the id/aria wiring and the `data-section` hook. */
  id: string
  title: string
  icon?: LucideIcon
  accent?: string // CSS color (e.g. 'var(--color-volt)') — same convention as SectionCard
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Second trigger line: the facts worth seeing while collapsed. Omit to keep the row at 56px. */
  summary?: ReactNode
  /** Interactive slot rendered *outside* the trigger — a nested button is invalid HTML. */
  action?: ReactNode
  children: ReactNode
}

/**
 * WAI-ARIA disclosure: a button inside the section heading toggles the panel below it.
 * Matches DayCard's existing expand/collapse look (chevron rotate, no height animation).
 */
export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  accent,
  open,
  onOpenChange,
  summary,
  action,
  children,
}: CollapsibleSectionProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    const next = !open
    onOpenChange(next)
    // Collapsing can push the trigger off-screen, and scroll anchoring inside an
    // overflow-y-auto container is inconsistent across browsers. 'nearest' is a
    // no-op while the trigger is still visible, so this only fires when it isn't.
    if (!next) {
      requestAnimationFrame(() =>
        triggerRef.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() }),
      )
    }
  }

  return (
    <section
      id={`section-${id}`}
      data-section={id}
      className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-surface-1"
    >
      <div className="flex items-stretch">
        <h2 className="min-w-0 flex-1">
          <button
            ref={triggerRef}
            id={`${id}-trigger`}
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            onClick={toggle}
            className="flex min-h-[56px] w-full items-center gap-2.5 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-volt"
          >
            {Icon && (
              <Icon
                size={16}
                aria-hidden
                className="shrink-0"
                style={{ color: accent ?? 'var(--color-text-muted)' }}
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-sm font-semibold uppercase tracking-wider text-text-muted">
                {title}
              </span>
              {summary && (
                <span className="mt-0.5 block truncate text-xs text-text-faint">{summary}</span>
              )}
            </span>
            <ChevronDown
              size={18}
              aria-hidden
              className={`shrink-0 text-text-faint transition-transform motion-reduce:transition-none ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </h2>
        {action && <div className="flex shrink-0 items-center pl-1 pr-3">{action}</div>}
      </div>

      {/* The panel element always exists so aria-controls always resolves; children only
          mount while open, so a collapsed section costs nothing to render. */}
      <div id={`${id}-panel`} hidden={!open} className="border-t border-border px-4 pb-4 pt-3">
        {open && children}
      </div>
    </section>
  )
}
