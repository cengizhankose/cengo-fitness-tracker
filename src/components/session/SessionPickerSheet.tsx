import { Dumbbell, Shuffle } from 'lucide-react'
import { Badge, ListRow, Sheet } from '@/components/ui'
import { plan, sessionById, sessionExercises } from '@/lib/plan'
import { useActiveSession } from '@/store/selectors'
import type { SessionId } from '@/types/plan'
import { useStartSession } from './useStartSession'

export interface SessionPickerListProps {
  suggested?: SessionId
  /** Called with the chosen id before the session starts (e.g. to close a sheet). */
  onPick?: (id: SessionId | 'free') => void
}

/** The five plan sessions (suggested one marked) and "Serbest antrenman"; a tap starts or resumes. */
export function SessionPickerList({ suggested, onPick }: SessionPickerListProps) {
  const start = useStartSession()
  const active = useActiveSession()
  const running = active
    ? (sessionById(active.planSessionId)?.title ?? 'Serbest antrenman')
    : undefined

  function pick(id: SessionId | 'free') {
    onPick?.(id)
    start(id)
  }

  return (
    <div className="flex flex-col gap-2">
      {running && (
        <p className="text-sm text-text-muted">
          Süren seans: <span className="font-semibold text-text">{running}</span>. Seçince ona dönersin.
        </p>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {plan.sessions.map((s) => (
          <li key={s.id}>
            <ListRow
              leading={<Dumbbell size={20} aria-hidden className="text-volt" />}
              title={s.title}
              subtitle={`${sessionExercises(s).length} hareket · ${s.durationMin} dk`}
              trailing={s.id === suggested ? <Badge tone="accent">Önerilen</Badge> : undefined}
              onClick={() => pick(s.id)}
            />
          </li>
        ))}
        <li>
          <ListRow
            leading={<Shuffle size={20} aria-hidden className="text-text-muted" />}
            title="Serbest antrenman"
            subtitle="Hareketleri sen seç"
            onClick={() => pick('free')}
          />
        </li>
      </ul>
    </div>
  )
}

export interface SessionPickerSheetProps {
  open: boolean
  onClose: () => void
  suggested?: SessionId
}

/** Bottom sheet around SessionPickerList; closes as soon as a session is chosen. */
export function SessionPickerSheet({ open, onClose, suggested }: SessionPickerSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Seans seç">
      <SessionPickerList suggested={suggested} onPick={onClose} />
    </Sheet>
  )
}
