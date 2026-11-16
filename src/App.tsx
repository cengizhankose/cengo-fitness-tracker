import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TabBar, ToastHost } from '@/components/ui'
import { IMPORT_RESULT_KEY } from '@/lib/backup/format'
import { useToast } from '@/store/toast'
import { cx } from '@/components/ui/cx'

export function App() {
  // The workout session owns the full viewport: no tab bar, so the gym flow is never one
  // mistap away from leaving it. Screens then pad their bottom edge for the safe area.
  const isSession = useLocation().pathname === '/session'
  const push = useToast((s) => s.push)

  // An import ends in a full reload, so its summary is handed over via sessionStorage.
  useEffect(() => {
    const raw = sessionStorage.getItem(IMPORT_RESULT_KEY)
    if (!raw) return
    sessionStorage.removeItem(IMPORT_RESULT_KEY)
    try {
      const { added, updated } = JSON.parse(raw) as { added: number; updated: number }
      push(`Yedek geri yüklendi · ${added} eklendi, ${updated} güncellendi`, 'success')
    } catch {
      push('Yedek geri yüklendi', 'success')
    }
  }, [push])

  return (
    <div className="grid h-[100dvh] grid-rows-[1fr_auto] bg-bg text-text">
      <main
        className={cx(
          'overflow-y-auto overscroll-contain',
          isSession && '[--chrome-bottom:env(safe-area-inset-bottom)]',
        )}
      >
        <div className="mx-auto flex min-h-full max-w-md flex-col">
          <Outlet />
        </div>
      </main>
      {!isSession && <TabBar />}
      <ToastHost />
    </div>
  )
}
