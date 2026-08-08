import { useNavigate } from 'react-router-dom'
import { Check, Dumbbell, Plus } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { SectionCard } from '@/components/SectionCard'
import { TaskDetail } from '@/components/TaskDetail'
import { TYPE_COLOR, TYPE_LABEL } from '@/lib/planMeta'
import { loggedExerciseNamesToday } from '@/lib/derive'
import { toLocalISODate } from '@/lib/dates'
import { useProgramWeek, useRunLog, useStrengthLog } from '@/store/selectors'
import type { RunDay, ScheduleDay, StrengthDay } from '@/types/plan'

/** Same shape/colours as ExerciseRow's Log button, so the "+ Log" language stays identical. */
function LogPill({ logged, onClick, label }: { logged: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 shrink-0 items-center gap-1 rounded-md px-3 text-sm font-semibold ${
        logged ? 'bg-success/15 text-success' : 'bg-volt text-on-accent active:bg-volt-dim'
      }`}
    >
      {logged ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
      {logged ? 'Logged' : 'Log'}
    </button>
  )
}

function joinMeta(parts: (string | number | null | undefined)[]): string {
  return parts.filter((p) => p != null && p !== '').join(' · ')
}

function useStrengthSummary(day: StrengthDay) {
  const strengthLog = useStrengthLog()
  const logged = loggedExerciseNamesToday(strengthLog)
  const total = day.exercises.length
  const done = day.exercises.filter((e) => logged.has(e.name)).length
  const firstUnlogged = day.exercises.find((e) => !logged.has(e.name)) ?? day.exercises[0]
  return {
    done,
    total,
    firstUnlogged,
    meta: joinMeta([
      day.durationMin != null ? `${day.durationMin} min` : null,
      `${total} exercises`,
      `${done}/${total} logged`,
    ]),
  }
}

function useRunSummary(day: RunDay) {
  const week = useProgramWeek()
  if (day.progressionKmByWeek) {
    const km = day.progressionKmByWeek[week.index]
    return joinMeta([
      km != null ? `${km} km` : null,
      `week ${week.weekNumber}/${week.totalWeeks}`,
      day.intensity,
    ])
  }
  if (day.structure) {
    return joinMeta([
      day.durationMin != null ? `${day.durationMin} min` : null,
      day.targetDistanceKm != null ? `${day.targetDistanceKm} km` : null,
      day.structure.map((s) => s.segment).join(' + '),
    ])
  }
  return joinMeta([
    day.durationMin != null ? `${day.durationMin} min` : null,
    day.targetDistanceKm != null ? `${day.targetDistanceKm} km` : null,
    day.intensity,
  ])
}

interface StrengthWorkoutProps {
  day: StrengthDay
  open: boolean
  onOpenChange: (open: boolean) => void
}

function StrengthWorkout({ day, open, onOpenChange }: StrengthWorkoutProps) {
  const navigate = useNavigate()
  const { done, total, firstUnlogged, meta } = useStrengthSummary(day)
  const allLogged = total > 0 && done >= total
  return (
    <CollapsibleSection
      id="workout"
      title={`${TYPE_LABEL.strength} · ${day.title}`}
      icon={Dumbbell}
      accent={TYPE_COLOR.strength}
      summary={meta}
      open={open}
      onOpenChange={onOpenChange}
      action={
        firstUnlogged && (
          <LogPill
            logged={allLogged}
            label={allLogged ? 'All exercises logged' : `Log ${firstUnlogged.name}`}
            onClick={() =>
              navigate(`/log?type=strength&exercise=${encodeURIComponent(firstUnlogged.name)}`)
            }
          />
        )
      }
    >
      <TaskDetail day={day} enableLog />
    </CollapsibleSection>
  )
}

interface RunWorkoutProps {
  day: RunDay
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RunWorkout({ day, open, onOpenChange }: RunWorkoutProps) {
  const navigate = useNavigate()
  const runLog = useRunLog()
  const today = toLocalISODate()
  const meta = useRunSummary(day)
  const logged = runLog.some((e) => e.date === today)
  return (
    <CollapsibleSection
      id="workout"
      title={`${TYPE_LABEL.run} · ${day.title}`}
      icon={Dumbbell}
      accent={TYPE_COLOR.run}
      summary={meta}
      open={open}
      onOpenChange={onOpenChange}
      action={
        <LogPill
          logged={logged}
          label={logged ? 'Run logged' : 'Log run'}
          onClick={() => navigate('/log?type=run')}
        />
      }
    >
      <TaskDetail day={day} enableLog />
    </CollapsibleSection>
  )
}

interface TodayWorkoutCardProps {
  day: ScheduleDay
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Today's workout as a compact, action-first summary. The full exercise list — and every
 * per-exercise "+ Log" button — lives in the disclosure panel via the untouched TaskDetail.
 */
export function TodayWorkoutCard({ day, open, onOpenChange }: TodayWorkoutCardProps) {
  if (day.type === 'strength') {
    return <StrengthWorkout day={day} open={open} onOpenChange={onOpenChange} />
  }
  if (day.type === 'run') {
    return <RunWorkout day={day} open={open} onOpenChange={onOpenChange} />
  }

  // Football: the whole content is one badge — a disclosure hiding it would be noise.
  return (
    <SectionCard
      sectionId="workout"
      title={`${TYPE_LABEL.football} · ${day.title}`}
      icon={Dumbbell}
      accent={TYPE_COLOR.football}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="football">{day.rule}</Badge>
        {day.durationMin != null && <Badge tone="muted">{day.durationMin} min</Badge>}
      </div>
    </SectionCard>
  )
}
