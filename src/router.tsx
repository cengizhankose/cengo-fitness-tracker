import { Navigate, createBrowserRouter } from 'react-router-dom'
import { App } from '@/App'
import { Splash } from '@/components/Splash'
import { TodayScreen } from '@/screens/TodayScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { NutritionScreen } from '@/screens/NutritionScreen'
import { SessionScreen } from '@/screens/SessionScreen'
import { ExercisesScreen } from '@/screens/ExercisesScreen'
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
      // The exercise detail draws charts (recharts) — lazy-split like Progress.
      {
        path: 'exercises/:name',
        lazy: async () => {
          const { ExerciseDetailScreen } = await import('@/screens/ExerciseDetailScreen')
          return { Component: ExerciseDetailScreen }
        },
      },
      { path: 'history', element: <HistoryScreen /> },
      // Progress draws charts (recharts) too — lazy-split like the exercise detail so
      // recharts stays out of the initial bundle.
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
