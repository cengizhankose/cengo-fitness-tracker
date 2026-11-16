import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toLocalISODate } from '@/lib/dates'
import { sessionById, sessionExercises } from '@/lib/plan'
import { useStore } from '@/store'
import type { SessionId } from '@/types/plan'
import type { IsoDate } from '@/types/userData'

/**
 * Starts a workout session and opens `/session`. A session that is already running is
 * resumed instead — there is never a second one. Plan sessions snapshot their exercise
 * names in plan order; 'free' starts empty. `date` defaults to today (local).
 */
export function useStartSession(): (planSessionId: SessionId | 'free', date?: IsoDate) => void {
  const navigate = useNavigate()
  return useCallback(
    (planSessionId, date = toLocalISODate()) => {
      const { activeSession, startSession } = useStore.getState()
      if (!activeSession) {
        const session = planSessionId === 'free' ? undefined : sessionById(planSessionId)
        const names = session ? sessionExercises(session).map((ex) => ex.name) : []
        startSession(date, planSessionId, names)
      }
      navigate('/session')
    },
    [navigate],
  )
}
