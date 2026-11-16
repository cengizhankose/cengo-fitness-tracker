import { Check } from 'lucide-react'
import { Badge, ListRow } from '@/components/ui'
import { BLOCK_COLOR, BLOCK_ICON } from '@/lib/planMeta'
import { sessionById, sessionExercises } from '@/lib/plan'
import type { DayBlock, SessionId } from '@/types/plan'
import type { IsoDate } from '@/types/userData'
import { RUN_HR_RULE, runTargetLabel } from './todayModel'

export interface BlockRowProps {
  block: DayBlock
  date: IsoDate
  /** A matching activity is already logged for the day. */
  done?: boolean
  /** Starts a strength block's session (Saturday alternative). */
  onStart?: (sessionId: SessionId) => void
}

/** Compact row for one planned block of the day: run (target + HR rule), football, or a strength alternative. */
export function BlockRow({ block, date, done = false, onStart }: BlockRowProps) {
  const Icon = BLOCK_ICON[block.type]
  const leading = <Icon size={22} aria-hidden style={{ color: BLOCK_COLOR[block.type] }} />
  const doneBadge = done ? (
    <Badge tone="success" icon={Check}>
      Yapıldı
    </Badge>
  ) : null

  if (block.type === 'strength') {
    const session = sessionById(block.sessionId)
    if (!session) return null
    return (
      <ListRow
        leading={leading}
        title={session.title}
        subtitle={`${session.durationMin} dk · ${sessionExercises(session).length} hareket`}
        trailing={doneBadge}
        onClick={onStart ? () => onStart(block.sessionId) : undefined}
      />
    )
  }
  if (block.type === 'run') {
    const target = runTargetLabel(block, date)
    return (
      <ListRow
        leading={leading}
        title={target ? `${block.title} · ${target}` : block.title}
        subtitle={RUN_HR_RULE}
        trailing={doneBadge}
      />
    )
  }

  return <ListRow leading={leading} title={block.title} subtitle={block.when} trailing={doneBadge} />
}
