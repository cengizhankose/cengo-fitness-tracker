import { useEffect, useState } from 'react'
import { SkipForward } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import { useStore } from '@/store'
import type { RestTimer } from '@/types/userData'
import { cancelRestAlarm, scheduleRestAlarm } from './restAlarm'
import { REST_STEP_SECONDS } from './sessionModel'

/** How long "Dinlenme bitti" stays before the panel closes itself. */
export const REST_DONE_LINGER_MS = 5000
const TICK_MS = 250

/** Wall-clock now, refreshed every tick and whenever the app comes back to the foreground. */
function useNow(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return now
}

/**
 * The rest countdown that every logged set starts, in the session footer: time left,
 * −15 / +15 and skip. It beeps at zero, says "Dinlenme bitti" and closes after a moment.
 */
export function RestTimerPanel({ rest }: { rest: RestTimer }) {
  const adjustRest = useStore((s) => s.adjustRest)
  const skipRest = useStore((s) => s.skipRest)
  const now = useNow()
  const startMs = Date.parse(rest.startedAt)
  const endMs = Date.parse(rest.endsAt)
  const remainingMs = Math.max(0, endMs - now)
  const done = remainingMs === 0
  const fraction = endMs > startMs ? remainingMs / (endMs - startMs) : 0

  useEffect(() => {
    scheduleRestAlarm(endMs)
    return cancelRestAlarm
  }, [endMs])

  useEffect(() => {
    const id = setTimeout(skipRest, Math.max(0, endMs + REST_DONE_LINGER_MS - Date.now()))
    return () => clearTimeout(id)
  }, [endMs, skipRest])

  return (
    <section aria-label="Dinlenme" className="mb-3 rounded-lg border border-volt/40 bg-card px-3 pt-2 pb-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="text-xs font-semibold tracking-wider text-volt uppercase">
            {done ? 'Dinlenme bitti' : 'Dinlenme'}
          </p>
          <p role="timer" aria-label="Kalan dinlenme" className="num text-num tabular-nums">
            {formatDuration(Math.ceil(remainingMs / 1000))}
          </p>
        </div>
        {!done && (
          <>
            <Button
              variant="secondary"
              aria-label={`${REST_STEP_SECONDS} saniye kısalt`}
              onClick={() => adjustRest(-REST_STEP_SECONDS)}
            >
              {`−${REST_STEP_SECONDS}`}
            </Button>
            <Button
              variant="secondary"
              aria-label={`${REST_STEP_SECONDS} saniye uzat`}
              onClick={() => adjustRest(REST_STEP_SECONDS)}
            >
              {`+${REST_STEP_SECONDS}`}
            </Button>
          </>
        )}
        <Button variant="secondary" icon={SkipForward} onClick={skipRest}>
          {done ? 'Kapat' : 'Atla'}
        </Button>
      </div>
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full bg-volt transition-[width] duration-300 ease-linear motion-reduce:transition-none"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </section>
  )
}
