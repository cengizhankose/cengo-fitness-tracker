import { useState } from 'react'
import { Flag } from 'lucide-react'
import { SectionCard } from '@/components/SectionCard'
import { MarathonDayRow } from '@/components/MarathonDayRow'
import { toLocalISODate } from '@/lib/dates'
import { useMarathonWorkout } from '@/store/selectors'
import type { IsoDate } from '@/types/userData'

interface MarathonTodayCardProps {
  today?: IsoDate
}

/** Today's marathon row, pre-expanded, on the Today tab. Renders nothing outside the plan. */
export function MarathonTodayCard({ today = toLocalISODate() }: MarathonTodayCardProps) {
  const { workout, actual } = useMarathonWorkout(today)
  const [expanded, setExpanded] = useState(true)

  if (!workout || !actual) return null

  return (
    <SectionCard title="Marathon" icon={Flag} accent="var(--color-volt)">
      <MarathonDayRow
        workout={workout}
        actual={actual}
        today={today}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        from="today"
      />
    </SectionCard>
  )
}
