import { createBrowserRouter } from 'react-router-dom'
import { App } from '@/App'
import { TodayScreen } from '@/screens/TodayScreen'
import { WeeklyScreen } from '@/screens/WeeklyScreen'
import { LogScreen } from '@/screens/LogScreen'
import { Splash } from '@/components/Splash'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    HydrateFallback: Splash,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'weekly', element: <WeeklyScreen /> },
      // Progress pulls in recharts — lazy-split so it stays out of the
      // initial bundle (keeps the after-workout Today/Log screens fast).
      {
        path: 'progress',
        lazy: async () => {
          const { ProgressScreen } = await import('@/screens/ProgressScreen')
          return { Component: ProgressScreen }
        },
      },
      { path: 'log', element: <LogScreen /> },
    ],
  },
])
