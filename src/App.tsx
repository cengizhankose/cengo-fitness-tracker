import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomTabBar } from '@/components/BottomTabBar'
import { ToastHost } from '@/components/ToastHost'
import { IMPORT_RESULT_KEY } from '@/lib/backup/format'
import { useToast } from '@/store/toast'

export function App() {
  // The workout session owns the full viewport — it has its own sticky action bar,
  // and hiding the tabs keeps the gym flow from being one mistap away from leaving it.
  const isSession = useLocation().pathname === '/session'
  const push = useToast((s) => s.push)

  // An import ends in a full reload, so its summary is handed over via sessionStorage.
  useEffect(() => {
    const raw = sessionStorage.getItem(IMPORT_RESULT_KEY)
    if (!raw) return
    sessionStorage.removeItem(IMPORT_RESULT_KEY)
    try {
      const { added, updated } = JSON.parse(raw) as { added: number; updated: number }
      push(`Backup restored · ${added} added, ${updated} updated`, 'success')
    } catch {
      push('Backup restored', 'success')
    }
  }, [push])

  return (
    <div className="grid h-[100dvh] grid-rows-[1fr_auto] bg-bg text-text">
      <main className="overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-md">
          <Outlet />
        </div>
      </main>
      {!isSession && <BottomTabBar />}
      <ToastHost />
    </div>
  )
}
