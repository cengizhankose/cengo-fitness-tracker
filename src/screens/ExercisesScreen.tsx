import { useId, useMemo, useState } from 'react'
import { SearchX } from 'lucide-react'
import { Card, EmptyState, FilterChips, Screen, SectionTitle, TextField } from '@/components/ui'
import type { ChipOption } from '@/components/ui'
import { ExerciseRow } from '@/components/exercise/ExerciseRow'
import { REGION_LABEL, filterGroups, groupExercises } from '@/lib/exerciseGroups'
import type { RegionKey } from '@/lib/exerciseGroups'
import { allExerciseSummaries } from '@/lib/exerciseStats'
import { useStrengthLog } from '@/store/selectors'

type RegionFilter = RegionKey | 'all'

/** Hareketler — every plan and logged exercise by region, with where it stands. */
export function ExercisesScreen() {
  const strengthLog = useStrengthLog()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<RegionFilter>('all')
  const idPrefix = useId()

  const overviews = useMemo(() => allExerciseSummaries(strengthLog), [strengthLog])
  const byName = useMemo(() => new Map(overviews.map((o) => [o.exerciseName, o])), [overviews])
  const groups = useMemo(() => groupExercises(overviews.map((o) => o.exerciseName)), [overviews])
  const logged = useMemo(() => overviews.filter((o) => o.summary.trainingDays > 0).length, [overviews])

  const chips = useMemo<ChipOption<RegionFilter>[]>(
    () => [
      { value: 'all', label: 'Tümü' },
      ...groups.map((g) => ({ value: g.region, label: REGION_LABEL[g.region], count: g.exercises.length })),
    ],
    [groups],
  )

  // Within a region, exercises with history come first; plan order is kept otherwise.
  const visible = useMemo(
    () =>
      filterGroups(groups, query)
        .filter((g) => region === 'all' || g.region === region)
        .map((g) => {
          const rows = g.exercises.flatMap((name) => byName.get(name) ?? [])
          const withHistory = rows.filter((o) => o.summary.trainingDays > 0)
          const without = rows.filter((o) => o.summary.trainingDays === 0)
          return { region: g.region, rows: [...withHistory, ...without] }
        }),
    [groups, query, region, byName],
  )

  return (
    <Screen title="Hareketler" subtitle={`${overviews.length} hareket · ${logged} kayıtlı`}>
      <TextField
        type="search"
        label="Hareket ara"
        value={query}
        onChange={setQuery}
        placeholder="ör. Bench"
        autoComplete="off"
        enterKeyHint="search"
      />
      <FilterChips label="Bölge" options={chips} value={region} onChange={setRegion} />

      {visible.length === 0 ? (
        <EmptyState icon={SearchX} title="Sonuç yok" hint="Başka bir isim dene ya da Tümü'ne dön." />
      ) : (
        visible.map((g) => {
          const headingId = `${idPrefix}-${g.region}`
          return (
            <section key={g.region} aria-labelledby={headingId} className="flex flex-col gap-2">
              <SectionTitle id={headingId} aside={g.rows.length}>
                {REGION_LABEL[g.region]}
              </SectionTitle>
              <Card as="div" flush>
                {g.rows.map((o) => (
                  <ExerciseRow key={o.exerciseName} summary={o.summary} />
                ))}
              </Card>
            </section>
          )
        })
      )}
    </Screen>
  )
}
