import { CheckCircle2 } from 'lucide-react'
import { useToast } from '@/store/toast'

export function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm font-medium text-text shadow-lg"
        >
          {t.tone === 'success' && <CheckCircle2 size={18} className="shrink-0 text-success" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
