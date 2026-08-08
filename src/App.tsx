import { Outlet, useLocation } from 'react-router-dom'
import { BottomTabBar } from '@/components/BottomTabBar'
import { ToastHost } from '@/components/ToastHost'

export function App() {
  // The workout session owns the full viewport — it has its own sticky action bar,
  // and hiding the tabs keeps the gym flow from being one mistap away from leaving it.
  const isSession = useLocation().pathname === '/session'

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
