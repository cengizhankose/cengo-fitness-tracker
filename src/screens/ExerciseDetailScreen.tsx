import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Dumbbell, SearchX } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  Screen,
  SectionTitle,
  Stat,
  StatGrid,
  TrendBadge,
  rpeWord,
} from '@/components/ui'
import { ExerciseCharts } from '@/components/exercise/ExerciseCharts'
import { ExerciseHistoryDay } from '@/components/exercise/ExerciseHistoryDay'
import { TargetCard } from '@/components/exercise/TargetCard'
import {
  formatSetWithEffort,
  placementLabel,
  planPlacements,
  setStatParts,
} from '@/components/exercise/exerciseView'
import { formatDayMonth } from '@/lib/dates'
import { REGION_LABEL, regionOf } from '@/lib/exerciseGroups'
import { exerciseSummary } from '@/lib/exerciseStats'
import type { LoggedSet } from '@/lib/exerciseStats'
import { formatNumber } from '@/lib/format'
import { canonicalExerciseName, findPlanExercise } from '@/lib/plan'
import { useStrengthLog } from '@/store/selectors'
import type { IsoDate } from '@/types/userData'

/** The route param, tolerating names that are still percent-encoded or contain a bare "%". */
function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** "16 Kas · RPE 9" under a set stat. */
function setHint(set: LoggedSet, date: IsoDate): string {
  return set.rpe != null ? `${formatDayMonth(date)} · RPE ${formatNumber(set.rpe)}` : formatDayMonth(date)
}

/** Hareket — where one exercise stands: last, best, effort, next target, charts, full history. */
export function ExerciseDetailScreen() {
  const { name: rawName = '' } = useParams()
  const name = canonicalExerciseName(decodeName(rawName))
  const strengthLog = useStrengthLog()

  const summary = useMemo(() => exerciseSummary(strengthLog, name), [strengthLog, name])
  const placements = useMemo(() => planPlacements(name), [name])
  const known = findPlanExercise(name) != null || summary.history.length > 0

  if (!known) {
    return (
      <Screen title="Hareket" back="/exercises">
        <EmptyState
          icon={SearchX}
          title="Bu hareket yok"
          hint="Planda ya da kayıtlarında bulunamadı. Listeden bir hareket seç."
          action={
            <Button to="/exercises" variant="secondary">
              Hareketlere dön
            </Button>
          }
        />
      </Screen>
    )
  }

  const { unit, last, previous, best, bestE1rm, lastRpe, trainingDays, trend, history } = summary
  const lastTop = last?.topSet

  return (
    <Screen title={name} subtitle={REGION_LABEL[regionOf(name)]} back="/exercises">
      {last && lastTop && (
        <Card title="Durum">
          <StatGrid>
            <Stat label="Son" {...setStatParts(lastTop, unit)} hint={setHint(lastTop, last.date)} />
            {best && <Stat label="En iyi" {...setStatParts(best.set, unit)} hint={setHint(best.set, best.date)} />}
            {unit === 'kg' && bestE1rm && (
              <Stat label="Tahmini 1TM" value={bestE1rm.value} unit="kg" hint={formatDayMonth(bestE1rm.date)} />
            )}
            <Stat
              label="Son efor (RPE)"
              value={lastRpe ?? '—'}
              unit={lastRpe != null ? rpeWord(lastRpe) : undefined}
            />
            <Stat label="Antrenman günü" value={trainingDays} />
            <Stat
              label="Önceki güne göre"
              value={<TrendBadge trend={trend} />}
              hint={previous?.topSet ? `önce ${formatSetWithEffort(previous.topSet, unit)}` : 'ilk gün'}
            />
          </StatGrid>
        </Card>
      )}

      <TargetCard summary={summary} placements={placements} />

      <ExerciseCharts summary={summary} />

      {placements.length > 0 && (
        <Card title="Planda">
          <ul className="flex flex-col gap-1.5">
            {placements.map((p) => (
              <li key={p.session.id}>{placementLabel(p)}</li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="exercise-history" className="flex flex-col gap-3">
        <SectionTitle id="exercise-history" aside={history.length > 0 ? `${history.length} gün` : undefined}>
          Geçmiş
        </SectionTitle>
        {history.length > 0 ? (
          history.map((day) => <ExerciseHistoryDay key={day.date} day={day} />)
        ) : (
          <EmptyState
            icon={Dumbbell}
            title="Henüz kayıt yok"
            hint="Seansta ilk setini kaydedince burada görünür."
          />
        )}
      </section>
    </Screen>
  )
}
