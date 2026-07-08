import { useState } from 'react'
import { Target, ClipboardCheck, Images, Save } from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SectionCard } from '@/components/SectionCard'
import { MetricInput } from '@/components/MetricInput'
import { PhotoUpload } from '@/components/PhotoUpload'
import { ChartCard } from '@/components/ChartCard'
import { WeightChart, WaistChart, WorkoutsChart, RunKmChart } from '@/components/charts'
import { plan } from '@/lib/plan'
import {
  parseWeightGoal,
  weightGoalProgress,
  metricSeries,
  workoutsPerWeek,
  runningKmPerWeek,
} from '@/lib/derive'
import { mondayOf, toLocalISODate, formatShortDate, formatDayMonth } from '@/lib/dates'
import { usePhotoUrl } from '@/lib/usePhotoUrl'
import { useStore } from '@/store'
import { useCheckIns, useRunLog, useChecklist } from '@/store/selectors'
import { useToast } from '@/store/toast'

const num = (v: number | '') => (v === '' ? undefined : v)

function PhotoCompare({ label, photoKey }: { label: string; photoKey?: string }) {
  const url = usePhotoUrl(photoKey)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-md border border-border bg-surface-2">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-text-faint">—</span>
        )}
      </div>
    </div>
  )
}

export function ProgressScreen() {
  const today = toLocalISODate()
  const checkInDate = mondayOf(today)
  const checkIns = useCheckIns()
  const runLog = useRunLog()
  const checklist = useChecklist()
  const saveCheckIn = useStore((s) => s.saveCheckIn)
  const push = useToast((s) => s.push)
  const current = checkIns[checkInDate]

  const [weight, setWeight] = useState<number | ''>(current?.weightKg ?? '')
  const [waist, setWaist] = useState<number | ''>(current?.waistCm ?? '')
  const [chest, setChest] = useState<number | ''>(current?.chestCm ?? '')
  const [hip, setHip] = useState<number | ''>(current?.hipCm ?? '')

  const goal = parseWeightGoal(plan)
  const weightData = metricSeries(checkIns, 'weightKg')
  const waistData = metricSeries(checkIns, 'waistCm')
  const workouts = workoutsPerWeek(checklist)
  const runKm = runningKmPerWeek(runLog)

  const latestWeight = weightData.at(-1)?.value
  const progress = goal && latestWeight != null ? weightGoalProgress(goal, latestWeight) : 0
  const toGo =
    goal && latestWeight != null ? Math.max(0, Math.round((latestWeight - goal.targetHigh) * 10) / 10) : null

  const withFront = Object.values(checkIns)
    .filter((c) => c.frontPhotoKey)
    .sort((a, b) => a.date.localeCompare(b.date))
  const firstFront = withFront[0]
  const lastFront = withFront.at(-1)

  function handleSave() {
    saveCheckIn({
      date: checkInDate,
      weightKg: num(weight),
      waistCm: num(waist),
      chestCm: num(chest),
      hipCm: num(hip),
    })
    push('Check-in saved', 'success')
  }

  return (
    <>
      <ScreenHeader title="Progress" subtitle="Weekly check-in & trends" />
      <div className="space-y-4 px-4 py-4">
        {goal && (
          <SectionCard title="Goal" icon={Target} accent="var(--color-volt)">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Current</p>
                <p className="tnum font-display text-stat-md font-bold text-text">
                  {latestWeight ?? goal.start} kg
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-text-muted">Target</p>
                <p className="tnum font-display text-stat-md font-bold text-volt">
                  {goal.targetLow}–{goal.targetHigh} kg
                </p>
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-volt transition-[width] duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            {toGo != null && (
              <p className="mt-2 text-sm text-text-muted">
                {toGo > 0 ? `${toGo} kg to target` : 'Target reached'}
              </p>
            )}
          </SectionCard>
        )}

        <SectionCard
          title={`Check-in · ${formatShortDate(checkInDate)}`}
          icon={ClipboardCheck}
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricInput label="Weight" unit="kg" value={weight} onChange={setWeight} />
            <MetricInput label="Waist" unit="cm" value={waist} onChange={setWaist} />
            <MetricInput label="Chest" unit="cm" value={chest} onChange={setChest} />
            <MetricInput label="Hip" unit="cm" value={hip} onChange={setHip} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PhotoUpload label="Front" date={checkInDate} slot="front" photoKey={current?.frontPhotoKey} />
            <PhotoUpload label="Side" date={checkInDate} slot="side" photoKey={current?.sidePhotoKey} />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-volt py-3 font-semibold text-on-accent active:bg-volt-dim"
          >
            <Save size={16} /> Save check-in
          </button>
        </SectionCard>

        <ChartCard title="Weight" unit="kg" isEmpty={weightData.length === 0} emptyHint="Log a check-in to start the trend">
          <WeightChart data={weightData} goal={goal} />
        </ChartCard>
        <ChartCard title="Waist" unit="cm" isEmpty={waistData.length === 0} emptyHint="Log a check-in to start the trend">
          <WaistChart data={waistData} />
        </ChartCard>
        <ChartCard title="Workouts / week" isEmpty={workouts.length === 0} emptyHint="Complete workouts to see weekly volume">
          <WorkoutsChart data={workouts} />
        </ChartCard>
        <ChartCard title="Running / week" unit="km" isEmpty={runKm.length === 0} emptyHint="Log runs to track weekly distance">
          <RunKmChart data={runKm} />
        </ChartCard>

        <SectionCard title="Progress Photos" icon={Images}>
          {withFront.length === 0 ? (
            <p className="text-sm text-text-faint">Add front photos in your check-ins to compare over time.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <PhotoCompare
                label={firstFront ? `First · ${formatDayMonth(firstFront.date)}` : 'First'}
                photoKey={firstFront?.frontPhotoKey}
              />
              <PhotoCompare
                label={lastFront ? `Latest · ${formatDayMonth(lastFront.date)}` : 'Latest'}
                photoKey={lastFront?.frontPhotoKey}
              />
            </div>
          )}
        </SectionCard>
      </div>
    </>
  )
}
