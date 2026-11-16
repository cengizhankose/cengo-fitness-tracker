import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useToast } from '@/store/toast'
import { cx } from './cx'

export interface ToastHostProps {
  /** True when the tab bar is shown (every route but `/session`). */
  aboveTabBar: boolean
}

/**
 * Renders toasts from the toast store in a polite live region above whatever bottom bar is
 * present: the tab bar and/or the current `Screen` footer (`--screen-footer-h`, published by
 * `Screen`; its height already includes the safe area when there is no tab bar).
 */
export function ToastHost({ aboveTabBar }: ToastHostProps) {
  const toasts = useToast((s) => s.toasts)
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-gutter',
        aboveTabBar
          ? 'bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+var(--screen-footer-h,0px)+0.75rem)]'
          : 'bottom-[calc(max(env(safe-area-inset-bottom),var(--screen-footer-h,0px))+0.75rem)]',
      )}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast-in flex max-w-sm items-center gap-2 rounded-lg border border-border-strong bg-raised px-4 py-3 text-sm font-medium shadow-lg"
        >
          {t.tone === 'success' && <CircleCheck size={18} aria-hidden className="shrink-0 text-success" />}
          {t.tone === 'error' && <TriangleAlert size={18} aria-hidden className="shrink-0 text-danger" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
