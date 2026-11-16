import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge, ListRow, SectionTitle, Sheet, TextField } from '@/components/ui'
import { REGION_LABEL, filterGroups, groupExercises } from '@/lib/exerciseGroups'
import { allExerciseSummaries } from '@/lib/exerciseStats'
import { canonicalExerciseName } from '@/lib/plan'
import { useStrengthLog } from '@/store/selectors'
import { formatLoggedSet } from './sessionModel'

export interface AddExerciseSheetProps {
  open: boolean
  onClose: () => void
  /** Exercises already in the session (marked, still tappable to jump to them). */
  sessionNames: readonly string[]
  /** Canonical name to add (or jump to). */
  onPick: (name: string) => void
}

/** Catalog by region with search and each exercise's last load; a typed new name can be added too. */
export function AddExerciseSheet({ open, onClose, sessionNames, onPick }: AddExerciseSheetProps) {
  const strengthLog = useStrengthLog()
  const [query, setQuery] = useState('')
  const overviews = useMemo(() => allExerciseSummaries(strengthLog), [strengthLog])
  const byName = useMemo(() => new Map(overviews.map((o) => [o.exerciseName, o])), [overviews])
  const groups = useMemo(() => groupExercises(overviews.map((o) => o.exerciseName)), [overviews])
  const shown = useMemo(() => filterGroups(groups, query), [groups, query])

  const typed = canonicalExerciseName(query.trim().replace(/\s+/g, ' '))
  // filterGroups matches folded substrings, so a hit of the same length is the same name.
  const typedIsNew =
    typed !== '' &&
    !filterGroups(groups, typed).some((g) => g.exercises.some((n) => n.length === typed.length))

  function pick(name: string) {
    setQuery('')
    onPick(name)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Hareket ekle">
      <div className="flex flex-col gap-3 pt-1">
        <TextField
          label="Hareket ara"
          type="search"
          value={query}
          onChange={setQuery}
          autoComplete="off"
          enterKeyHint="search"
        />
        {typedIsNew && (
          <div className="overflow-hidden rounded-lg border border-border bg-raised">
            <ListRow
              leading={<Plus size={20} aria-hidden className="text-volt" />}
              title={`“${typed}” ekle`}
              subtitle="Yeni hareket"
              onClick={() => pick(typed)}
            />
          </div>
        )}
        {shown.map((group) => (
          <section key={group.region} className="flex flex-col gap-1">
            <SectionTitle as="h3">{REGION_LABEL[group.region]}</SectionTitle>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {group.exercises.map((name) => {
                const summary = byName.get(name)?.summary
                const top = summary?.last?.topSet
                return (
                  <li key={name}>
                    <ListRow
                      title={name}
                      subtitle={top && summary ? formatLoggedSet(top, summary.unit) : 'Henüz kayıt yok'}
                      trailing={sessionNames.includes(name) ? <Badge tone="accent">Seansta</Badge> : undefined}
                      onClick={() => pick(name)}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
