import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children?: ReactNode
  /** Sticky action row at the bottom of the sheet. */
  footer?: ReactNode
  /** Element focused on open; default the sheet panel itself (no keyboard pop-up). */
  initialFocus?: RefObject<HTMLElement | null>
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Bottom-sheet modal dialog: focus trap, Escape/backdrop close, body scroll lock, focus restore. */
export function Sheet({ open, onClose, title, children, footer, initialFocus }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(initialFocus?.current ?? panelRef.current)?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      opener?.focus()
    }
  }, [open, initialFocus])

  if (!open) return null

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    e.stopPropagation()
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) {
      e.preventDefault()
      return
    }
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" onKeyDown={onKeyDown}>
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet-in relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-xl border-t border-border-strong bg-card shadow-2xl focus-visible:outline-none"
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
        <div className="flex shrink-0 items-center gap-2 py-1 pr-2 pl-gutter">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-semibold">
            {title}
          </h2>
          <IconButton icon={X} aria-label="Kapat" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-gutter pb-4">{children}</div>
        {footer != null ? (
          <div className="shrink-0 border-t border-border px-gutter pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : (
          <div aria-hidden className="pb-safe shrink-0" />
        )}
      </div>
    </div>,
    document.body,
  )
}
