import { Outlet } from 'react-router-dom'
import { BottomTabBar } from '@/components/BottomTabBar'
import { ToastHost } from '@/components/ToastHost'

export function App() {
  return (
    <div className="grid h-[100dvh] grid-rows-[1fr_auto] bg-bg text-text">
      <main className="overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-md">
          <Outlet />
        </div>
      </main>
      <BottomTabBar />
      <ToastHost />
    </div>
  )
}
