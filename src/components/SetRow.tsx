import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { setKind } from '@/lib/derive'
import type { StrengthSet } from '@/types/userData'

interface SetRowProps {
  set: StrengthSet
  /** 1-based position within its own kind — "W2" is the second warmup. */
  ordinal: number
  selected?: boolean
  onEdit: () => void
  onRemove: () => void
}

export function SetRow({ set, ordinal, selected, onEdit, onRemove }: SetRowProps) {
  const kind = setKind(set)
  const label = `${kind === 'warmup' ? 'W' : 'S'}${ordinal}`
  const summary = `${set.weightKg}kg × ${set.reps}`

  return (
    <li className="flex items-center gap-2 border-b border-border/60 py-1 last:border-0">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit set ${label}, ${summary}`}
        className={`flex min-h-[44px] flex-1 items-center gap-2 rounded-md px-2 text-left ${
          selected ? 'bg-surface-2' : 'active:bg-surface-2'
        }`}
      >
        <Badge tone={kind === 'warmup' ? 'muted' : 'volt'}>{label}</Badge>
        <span className="tnum truncate text-sm font-medium text-text">{summary}</span>
        {set.rpe != null && <span className="tnum text-xs text-text-muted">RPE {set.rpe}</span>}
      </button>
      <button
        type="button"
        aria-label={`Delete set ${label}`}
        onClick={onRemove}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-text-faint active:bg-surface-2"
      >
        <Trash2 size={16} />
      </button>
    </li>
  )
}
