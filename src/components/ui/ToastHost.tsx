import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useToast } from '@/store/toast'

/** Renders toasts from the toast store in a polite live region above the tab bar. */
export function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-gutter"
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
