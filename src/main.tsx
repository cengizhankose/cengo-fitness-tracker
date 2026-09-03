import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { initConvexSync } from '@/lib/convex-sync'
import './index.css'

// Best-effort secondary sync layer — see src/lib/convex-sync. A no-op when no backend is
// configured, and never blocks or affects rendering either way.
initConvexSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
