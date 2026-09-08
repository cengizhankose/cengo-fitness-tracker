import { useState } from 'react'
import { Activity as ActivityIcon } from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { EmptyState } from '@/components/EmptyState'
import { ActivityCard } from '@/components/ActivityCard'
import { SPORT_LABEL } from '@/lib/activitiesMeta'
import { groupByRecency, RECENCY_GROUP_LABEL } from '@/lib/activities'
import { useActivitiesStore } from '@/store/activities'
import type { RecencyGroup } from '@/lib/activities'
import type { SportGroup } from '@/types/activities'

type Filter = 'all' | SportGroup

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'run', label: SPORT_LABEL.run },
  { value: 'bike', label: SPORT_LABEL.bike },
  { value: 'swim', label: SPORT_LABEL.swim },
  { value: 'strength', label: SPORT_LABEL.strength },
]

const GROUP_ORDER: RecencyGroup[] = ['today', 'thisWeek', 'older']

export function ActivitiesScreen() {
  const activities = useActivitiesStore((s) => s.activities)
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const all = Object.values(activities)
  const filtered = filter === 'all' ? all : all.filter((a) => a.sportGroup === filter)
  const groups = groupByRecency(filtered)
  const hasAny = GROUP_ORDER.some((key) => groups[key].length > 0)

  return (
    <>
      <ScreenHeader title="Activities" subtitle="Garmin sync" />
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by sport">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.value ? 'bg-volt text-on-accent' : 'bg-surface-2 text-text-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!hasAny ? (
          <EmptyState
            icon={ActivityIcon}
            title="No activities yet"
            hint="Garmin activities will show up here once synced."
          />
        ) : (
          GROUP_ORDER.map((key) => {
            const groupActivities = groups[key]
            if (groupActivities.length === 0) return null
            return (
              <section key={key}>
                <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-text-muted">
                  {RECENCY_GROUP_LABEL[key]}
                </h2>
                <div className="space-y-2.5">
                  {groupActivities.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      expanded={expandedId === activity.id}
                      onToggle={() =>
                        setExpandedId((cur) => (cur === activity.id ? null : activity.id))
                      }
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </>
  )
}
