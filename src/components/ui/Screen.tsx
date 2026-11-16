import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from './IconButton'

export interface ScreenProps {
  /** Header title (the page h1). */
  title: string
  subtitle?: ReactNode
  /**
   * Shows a back button. Goes back in in-app history when there is any, otherwise
   * navigates to this parent route (deep links / cold starts).
   */
  back?: string
  /** Right-side header slot, e.g. an IconButton. */
  action?: ReactNode
  /** Sticky bottom bar holding the screen's single primary action. */
  footer?: ReactNode
  children?: ReactNode
}

/**
 * Height of the mounted screen's sticky footer, published on `<html>` so `ToastHost` can sit
 * above it. Unset when the current screen has no footer.
 */
const FOOTER_HEIGHT_VAR = '--screen-footer-h'

/** Page wrapper: sticky header, gutter-padded body, optional sticky primary-action footer. */
export function Screen({ title, subtitle, back, action, footer, children }: ScreenProps) {
  const navigate = useNavigate()
  const footerRef = useRef<HTMLDivElement>(null)
  const hasFooter = footer != null

  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const root = document.documentElement.style
    const publish = () => root.setProperty(FOOTER_HEIGHT_VAR, `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.removeProperty(FOOTER_HEIGHT_VAR)
    }
  }, [hasFooter])

  function goBack() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else if (back) navigate(back)
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b border-border/60 bg-bg/90 backdrop-blur-md">
        <div className="flex min-h-14 items-center gap-1 px-gutter py-1.5">
          {back !== undefined && (
            <IconButton icon={ChevronLeft} aria-label="Geri" onClick={goBack} className="-ml-2.5" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
            {subtitle != null && (
              <p className="truncate text-sm text-text-muted">{subtitle}</p>
            )}
          </div>
          {action != null && <div className="-mr-2 flex shrink-0 items-center gap-1">{action}</div>}
        </div>
      </header>

      <div
        className={
          footer != null
            ? 'flex flex-1 flex-col gap-4 px-gutter pt-4 pb-4'
            : 'flex flex-1 flex-col gap-4 px-gutter pt-4 pb-[calc(1.5rem+var(--chrome-bottom,0px))]'
        }
      >
        {children}
      </div>

      {footer != null && (
        <div
          ref={footerRef}
          className="sticky bottom-0 z-20 border-t border-border/60 bg-bg/95 px-gutter pt-3 pb-[calc(0.75rem+var(--chrome-bottom,0px))] backdrop-blur-md"
        >
          {footer}
        </div>
      )}
    </div>
  )
}
