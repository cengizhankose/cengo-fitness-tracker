import { Navigate, createBrowserRouter } from 'react-router-dom'
import { App } from '@/App'
import { Splash } from '@/components/Splash'
import { TodayScreen } from '@/screens/TodayScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { NutritionScreen } from '@/screens/NutritionScreen'
import { SessionScreen } from '@/screens/SessionScreen'
import { ExercisesScreen } from '@/screens/ExercisesScreen'
import { ExerciseDetailScreen } from '@/screens/ExerciseDetailScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    HydrateFallback: Splash,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'plan', element: <PlanScreen /> },
      { path: 'nutrition', element: <NutritionScreen /> },
      { path: 'session', element: <SessionScreen /> },
      { path: 'exercises', element: <ExercisesScreen /> },
      { path: 'exercises/:name', element: <ExerciseDetailScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      // Progress is the only screen that pulls in recharts — lazy-split so it stays out
      // of the initial bundle.
      {
        path: 'progress',
        lazy: async () => {
          const { ProgressScreen } = await import('@/screens/ProgressScreen')
          return { Component: ProgressScreen }
        },
      },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
