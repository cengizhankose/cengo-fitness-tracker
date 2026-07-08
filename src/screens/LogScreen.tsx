import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, Footprints, Save, Trash2, History } from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SectionCard } from '@/components/SectionCard'
import { SegmentedToggle } from '@/components/SegmentedToggle'
import { MetricInput } from '@/components/MetricInput'
import { NumberStepper } from '@/components/NumberStepper'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/Badge'
import { plan } from '@/lib/plan'
import { scheduleForDate, lastWeightForExercise } from '@/lib/derive'
import { toLocalISODate, formatShortDate } from '@/lib/dates'
import { pace } from '@/lib/format'
import { useStore } from '@/store'
import { useStrengthLog, useRunLog } from '@/store/selectors'
import { useToast } from '@/store/toast'
import type { StrengthLogEntry, RunLogEntry } from '@/types/userData'

type Tab = 'strength' | 'run'
const num = (v: number | '') => (v === '' ? undefined : v)

type Row =
  | { kind: 'strength'; e: StrengthLogEntry }
  | { kind: 'run'; e: RunLogEntry }

export function LogScreen() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const today = toLocalISODate()
  const task = scheduleForDate(plan, new Date())

  const isBenchmark = params.get('benchmark') === '1'
  const presetExercise = params.get('exercise') ?? ''
  const presetTab: Tab = isBenchmark || params.get('type') === 'run' ? 'run' : 'strength'
  const [tab, setTab] = useState<Tab>(presetTab)

  // ---- strength form ----
  const exerciseNames = useMemo(() => {
    const names = plan.weeklySchedule.flatMap((d) =>
      d.type === 'strength' ? d.exercises.map((e) => e.name) : [],
    )
    return [...new Set(names)]
  }, [])
  const strengthLog = useStrengthLog()
  const [exercise, setExercise] = useState(presetExercise || exerciseNames[0] || '')
  const [weightKg, setWeightKg] = useState<number | ''>(
    () => lastWeightForExercise(strengthLog, presetExercise || exerciseNames[0] || '') ?? '',
  )
  const [reps, setReps] = useState(8)
  const [rpe, setRpe] = useState(9)
  const [note, setNote] = useState('')

  // Prefill weight from the last logged set when the chosen exercise changes
  // (adjust-state-on-change pattern — runs during render, no effect).
  const [prevExercise, setPrevExercise] = useState(exercise)
  if (exercise !== prevExercise) {
    setPrevExercise(exercise)
    setWeightKg(lastWeightForExercise(strengthLog, exercise) ?? '')
  }

  // ---- run form ----
  const runLog = useRunLog()
  const defaultDist = isBenchmark ? 5 : task.type === 'run' ? (task.targetDistanceKm ?? '') : ''
  const [distanceKm, setDistanceKm] = useState<number | ''>(defaultDist)
  const [durationMin, setDurationMin] = useState<number | ''>('')
  const [paceStr, setPaceStr] = useState('')
  const [hrAvg, setHrAvg] = useState<number | ''>('')
  const [hrMax, setHrMax] = useState<number | ''>('')
  const [runRpe, setRunRpe] = useState(5)
  const [runNotes, setRunNotes] = useState('')

  // ---- store actions ----
  const addStrengthEntry = useStore((s) => s.addStrengthEntry)
  const addRunEntry = useStore((s) => s.addRunEntry)
  const removeStrengthEntry = useStore((s) => s.removeStrengthEntry)
  const removeRunEntry = useStore((s) => s.removeRunEntry)
  const saveBenchmark = useStore((s) => s.saveBenchmark)
  const push = useToast((s) => s.push)

  function saveStrength() {
    if (!exercise || weightKg === '' || reps <= 0) {
      push('Enter an exercise, weight and reps')
      return
    }
    addStrengthEntry({
      date: today,
      exerciseName: exercise,
      sets: [{ weightKg: Number(weightKg), reps, rpe }],
      progressionNote: note || undefined,
    })
    push(`Logged ${exercise} · ${weightKg}kg × ${reps}`, 'success')
    setNote('')
  }

  function saveRun() {
    if (distanceKm === '' || Number(distanceKm) <= 0) {
      push('Enter a distance')
      return
    }
    const dur = durationMin === '' ? undefined : Number(durationMin)
    const computedPace = paceStr || (dur ? pace(Number(distanceKm), dur) : undefined)
    addRunEntry({
      date: today,
      distanceKm: Number(distanceKm),
      durationMin: dur,
      averagePace: computedPace,
      averageHeartRate: num(hrAvg),
      maxHeartRate: num(hrMax),
      rpe: runRpe,
      notes: runNotes || undefined,
      scheduleDay: task.type === 'run' ? task.day : undefined,
    })
    if (isBenchmark && dur) {
      saveBenchmark({
        date: today,
        timeSec: Math.round(dur * 60),
        averagePace: computedPace,
        averageHeartRate: num(hrAvg),
        maxHeartRate: num(hrMax),
        notes: runNotes || undefined,
      })
    }
    push(`Logged run · ${distanceKm} km`, 'success')
    setDistanceKm('')
    setDurationMin('')
    setPaceStr('')
    setHrAvg('')
    setHrMax('')
    setRunNotes('')
    if (isBenchmark) navigate('/')
  }

  const rows: Row[] = [
    ...strengthLog.map((e): Row => ({ kind: 'strength', e })),
    ...runLog.map((e): Row => ({ kind: 'run', e })),
  ].sort((a, b) => b.e.createdAt.localeCompare(a.e.createdAt))

  return (
    <>
      <ScreenHeader title="Training Log" subtitle={isBenchmark ? '5K benchmark' : 'Log & history'} />
      <div className="space-y-4 px-4 py-4">
        <SegmentedToggle
          options={[
            { value: 'strength', label: 'Strength', icon: Dumbbell },
            { value: 'run', label: 'Run', icon: Footprints },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'strength' ? (
          <SectionCard title="Log a set" icon={Dumbbell} accent="var(--color-volt)">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Exercise
              </span>
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-3 py-3 text-text outline-none focus:border-volt"
              >
                {!exerciseNames.includes(exercise) && exercise && (
                  <option value={exercise}>{exercise}</option>
                )}
                {exerciseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <MetricInput label="Weight" unit="kg" value={weightKg} onChange={setWeightKg} />
              <div className="grid grid-cols-2 gap-3">
                <NumberStepper label="Reps" value={reps} min={1} max={50} onChange={setReps} />
                <NumberStepper label="RPE" value={rpe} min={1} max={10} onChange={setRpe} />
              </div>
            </div>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Progression note
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. +2.5kg vs last week"
                className="rounded-md border border-border bg-surface-2 px-3 py-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-volt"
              />
            </label>
            <button
              type="button"
              onClick={saveStrength}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-volt py-3 font-semibold text-on-accent active:bg-volt-dim"
            >
              <Save size={16} /> Save set
            </button>
          </SectionCard>
        ) : (
          <SectionCard title="Log a run" icon={Footprints} accent="var(--color-run)">
            <div className="grid grid-cols-2 gap-3">
              <MetricInput label="Distance" unit="km" value={distanceKm} onChange={setDistanceKm} />
              <MetricInput
                label="Duration"
                unit="min"
                inputMode="numeric"
                value={durationMin}
                onChange={setDurationMin}
              />
            </div>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Avg pace (optional)
              </span>
              <input
                value={paceStr}
                onChange={(e) => setPaceStr(e.target.value)}
                placeholder="auto from distance + duration"
                className="rounded-md border border-border bg-surface-2 px-3 py-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-volt"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MetricInput label="Avg HR" unit="bpm" inputMode="numeric" value={hrAvg} onChange={setHrAvg} />
              <MetricInput label="Max HR" unit="bpm" inputMode="numeric" value={hrMax} onChange={setHrMax} />
            </div>
            <div className="mt-3">
              <NumberStepper label="RPE" value={runRpe} min={1} max={10} onChange={setRunRpe} />
            </div>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Notes</span>
              <input
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                placeholder="how did it feel?"
                className="rounded-md border border-border bg-surface-2 px-3 py-3 text-sm text-text outline-none placeholder:text-text-faint focus:border-volt"
              />
            </label>
            <button
              type="button"
              onClick={saveRun}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-run py-3 font-semibold text-on-accent active:opacity-90"
            >
              <Save size={16} /> {isBenchmark ? 'Save benchmark' : 'Save run'}
            </button>
          </SectionCard>
        )}

        <SectionCard title="History" icon={History}>
          {rows.length === 0 ? (
            <EmptyState icon={History} title="No entries yet" hint="Logged sets and runs show up here." />
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((row) => (
                <li key={row.e.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={row.kind === 'strength' ? 'volt' : 'run'}>
                        {row.kind === 'strength' ? 'Strength' : 'Run'}
                      </Badge>
                      <span className="text-xs text-text-faint">{formatShortDate(row.e.date)}</span>
                    </div>
                    {row.kind === 'strength' ? (
                      <p className="mt-1 text-sm text-text">
                        <span className="font-medium">{row.e.exerciseName}</span>{' '}
                        <span className="tnum text-text-muted">
                          {row.e.sets.map((s) => `${s.weightKg}kg×${s.reps}`).join(', ')}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-text">
                        <span className="tnum font-medium">{row.e.distanceKm} km</span>{' '}
                        <span className="text-text-muted">
                          {row.e.averagePace ?? ''} {row.e.rpe ? `· RPE ${row.e.rpe}` : ''}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={() =>
                      row.kind === 'strength'
                        ? removeStrengthEntry(row.e.id)
                        : removeRunEntry(row.e.id)
                    }
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-faint active:bg-surface-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  )
}
