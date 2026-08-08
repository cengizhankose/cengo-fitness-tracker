import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, Footprints, Save, Trash2, History } from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SectionCard } from '@/components/SectionCard'
import { SegmentedToggle } from '@/components/SegmentedToggle'
import { MetricInput } from '@/components/MetricInput'
import { TimeInput } from '@/components/TimeInput'
import { NumberStepper } from '@/components/NumberStepper'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/Badge'
import { plan } from '@/lib/plan'
import { scheduleForDate, lastWeightForExercise } from '@/lib/derive'
import { toLocalISODate, formatShortDate } from '@/lib/dates'
import { formatDuration, pace } from '@/lib/format'
import { BENCHMARK_DISTANCE_KM, parseBenchmarkTime } from '@/lib/benchmark'
import { useStore } from '@/store'
import { useStrengthLog, useRunLog, useActiveSession } from '@/store/selectors'
import { useToast } from '@/store/toast'
import type { StrengthLogEntry, RunLogEntry } from '@/types/userData'

type Tab = 'strength' | 'run'
const num = (v: number | '') => (v === '' ? undefined : v)

const MAX_DISTANCE_KM = 100
const MIN_HR = 30
const MAX_HR = 250
const DISTANCE_ERROR = `Enter a distance between 0 and ${MAX_DISTANCE_KM} km`
const HR_ERROR = `Heart rate must be between ${MIN_HR} and ${MAX_HR}`

/** Inline field errors for the run form — the key doubles as the focus order. */
type RunErrors = { time?: string; distance?: string; hrAvg?: string; hrMax?: string }
const hasErrors = (e: RunErrors) => Object.values(e).some(Boolean)

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
  const activeSession = useActiveSession()
  // Prefill from history only: a workout in progress (and any warmup set) must not seed it.
  const history = { excludeSessionId: activeSession?.id }
  const [exercise, setExercise] = useState(presetExercise || exerciseNames[0] || '')
  const [weightKg, setWeightKg] = useState<number | ''>(
    () =>
      lastWeightForExercise(strengthLog, presetExercise || exerciseNames[0] || '', history) ?? '',
  )
  const [reps, setReps] = useState(8)
  const [rpe, setRpe] = useState(9)
  const [note, setNote] = useState('')

  // Prefill weight from the last logged set when the chosen exercise changes
  // (adjust-state-on-change pattern — runs during render, no effect).
  const [prevExercise, setPrevExercise] = useState(exercise)
  if (exercise !== prevExercise) {
    setPrevExercise(exercise)
    setWeightKg(lastWeightForExercise(strengthLog, exercise, history) ?? '')
  }

  // ---- run form ----
  const runLog = useRunLog()
  const defaultDist = isBenchmark ? 5 : task.type === 'run' ? (task.targetDistanceKm ?? '') : ''
  const [distanceKm, setDistanceKm] = useState<number | ''>(defaultDist)
  const [durationMin, setDurationMin] = useState<number | ''>('')
  const [benchmarkTime, setBenchmarkTime] = useState('')
  const [paceStr, setPaceStr] = useState('')
  const [hrAvg, setHrAvg] = useState<number | ''>('')
  const [hrMax, setHrMax] = useState<number | ''>('')
  const [runRpe, setRunRpe] = useState(5)
  const [runNotes, setRunNotes] = useState('')
  const [errors, setErrors] = useState<RunErrors>({})

  const timeRef = useRef<HTMLInputElement>(null)
  const distanceRef = useRef<HTMLInputElement>(null)
  const hrAvgRef = useRef<HTMLInputElement>(null)
  const hrMaxRef = useRef<HTMLInputElement>(null)

  function clearError(key: keyof RunErrors) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  /** Move focus to the first invalid field, in DOM order. */
  function focusFirstInvalid(next: RunErrors) {
    const order: [keyof RunErrors, typeof timeRef][] = [
      ['time', timeRef],
      ['distance', distanceRef],
      ['hrAvg', hrAvgRef],
      ['hrMax', hrMaxRef],
    ]
    order.find(([key]) => next[key])?.[1].current?.focus()
  }

  // ---- store actions ----
  const addStrengthEntry = useStore((s) => s.addStrengthEntry)
  const addRunEntry = useStore((s) => s.addRunEntry)
  const removeStrengthEntry = useStore((s) => s.removeStrengthEntry)
  const removeRunEntry = useStore((s) => s.removeRunEntry)
  const logBenchmarkRun = useStore((s) => s.logBenchmarkRun)
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

  /** Heart rate is optional in both modes, but must be plausible when given. */
  function validateHeartRates(next: RunErrors) {
    if (hrAvg !== '' && (hrAvg < MIN_HR || hrAvg > MAX_HR)) next.hrAvg = HR_ERROR
    if (hrMax !== '' && (hrMax < MIN_HR || hrMax > MAX_HR)) next.hrMax = HR_ERROR
  }

  function reject(next: RunErrors) {
    setErrors(next)
    focusFirstInvalid(next)
  }

  function resetRunForm() {
    setDistanceKm('')
    setDurationMin('')
    setBenchmarkTime('')
    setPaceStr('')
    setHrAvg('')
    setHrMax('')
    setRunNotes('')
    setErrors({})
  }

  function saveRun() {
    const next: RunErrors = {}
    const dist = distanceKm === '' ? NaN : Number(distanceKm)
    if (!Number.isFinite(dist) || dist <= 0 || dist > MAX_DISTANCE_KM) next.distance = DISTANCE_ERROR
    validateHeartRates(next)
    if (hasErrors(next)) return reject(next)

    const dur = durationMin === '' ? undefined : Number(durationMin)
    addRunEntry({
      date: today,
      distanceKm: Number(distanceKm),
      durationMin: dur,
      averagePace: paceStr || (dur ? pace(Number(distanceKm), dur) : undefined),
      averageHeartRate: num(hrAvg),
      maxHeartRate: num(hrMax),
      rpe: runRpe,
      notes: runNotes || undefined,
      scheduleDay: task.type === 'run' ? task.day : undefined,
    })
    push(`Logged run · ${distanceKm} km`, 'success')
    resetRunForm()
  }

  /**
   * Benchmark mode is all-or-nothing: the store writes the benchmark and its run
   * entry in a single transition, so there is no success toast and no navigation
   * unless both actually persisted. The distance is fixed at 5 km and the pace is
   * derived from it inside the store.
   */
  function saveBenchmarkRun() {
    const next: RunErrors = {}
    validateHeartRates(next)
    const parsed = parseBenchmarkTime(benchmarkTime)
    if (!parsed.ok) {
      next.time = parsed.error
      return reject(next)
    }
    if (hasErrors(next)) return reject(next)

    const saved = logBenchmarkRun({
      date: today,
      timeSec: parsed.sec,
      distanceKm: BENCHMARK_DISTANCE_KM,
      averageHeartRate: num(hrAvg),
      maxHeartRate: num(hrMax),
      rpe: runRpe,
      notes: runNotes || undefined,
      scheduleDay: task.type === 'run' ? task.day : undefined,
    })
    if (!saved) {
      return reject({ time: 'Could not save the benchmark — check the time and try again' })
    }

    push(`Benchmark saved · ${formatDuration(parsed.sec)}`, 'success')
    resetRunForm()
    navigate('/')
  }

  function handleRunSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isBenchmark) saveBenchmarkRun()
    else saveRun()
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
            <form onSubmit={handleRunSubmit} noValidate>
              {isBenchmark ? (
                <div className="space-y-3">
                  <TimeInput
                    label="Time"
                    hint="mm:ss — e.g. 24:30"
                    value={benchmarkTime}
                    error={errors.time}
                    inputRef={timeRef}
                    onChange={(v) => {
                      setBenchmarkTime(v)
                      clearError('time')
                    }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                      Distance
                    </span>
                    <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-3">
                      <span className="text-xs text-text-faint">Fixed for the 5K benchmark</span>
                      <span className="tnum font-display text-stat-md font-semibold text-text">
                        {BENCHMARK_DISTANCE_KM}{' '}
                        <span className="text-sm font-medium text-text-faint">km</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <MetricInput
                    label="Distance"
                    unit="km"
                    value={distanceKm}
                    error={errors.distance}
                    inputRef={distanceRef}
                    onChange={(v) => {
                      setDistanceKm(v)
                      clearError('distance')
                    }}
                  />
                  <MetricInput
                    label="Duration"
                    unit="min"
                    inputMode="numeric"
                    value={durationMin}
                    onChange={setDurationMin}
                  />
                </div>
              )}
              {/* Benchmark pace is always derived from 5 km — no manual override. */}
              {!isBenchmark && (
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
              )}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MetricInput
                  label="Avg HR"
                  unit="bpm"
                  inputMode="numeric"
                  value={hrAvg}
                  error={errors.hrAvg}
                  inputRef={hrAvgRef}
                  onChange={(v) => {
                    setHrAvg(v)
                    clearError('hrAvg')
                  }}
                />
                <MetricInput
                  label="Max HR"
                  unit="bpm"
                  inputMode="numeric"
                  value={hrMax}
                  error={errors.hrMax}
                  inputRef={hrMaxRef}
                  onChange={(v) => {
                    setHrMax(v)
                    clearError('hrMax')
                  }}
                />
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
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-run py-3 font-semibold text-on-accent active:opacity-90"
              >
                <Save size={16} /> {isBenchmark ? 'Save benchmark' : 'Save run'}
              </button>
            </form>
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
