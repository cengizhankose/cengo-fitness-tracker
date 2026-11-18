import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { initConvexSync } from '@/lib/convex-sync'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Best-effort secondary sync layer — see src/lib/convex-sync. A no-op when no backend is
// configured, and never blocks or affects rendering either way.
initConvexSync()

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      if (location.pathname === '/session') return
      if (document.activeElement?.matches('input, textarea, select')) return
      void registration.update().catch(() => { /* Retry when connectivity returns. */ })
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    window.setInterval(check, 60_000)
    check()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
