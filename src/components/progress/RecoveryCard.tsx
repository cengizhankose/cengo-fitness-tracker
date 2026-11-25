import type { ReactNode } from 'react'
import { Badge, Card, ProgressBar, Stat, StatGrid, TrendBadge } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { formatActivityDuration } from '@/lib/activities'
import { formatShortDate } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { ASLEEP_BY, HRV_STATUS_TR } from '@/lib/garminDaily'
import type { RecoverySummary, WeekAverage } from '@/lib/garminDaily'
import type { IsoDate } from '@/types/userData'

const HRV_STATUS_TONE: Readonly<Record<string, Tone>> = {
  BALANCED: 'success',
  UNBALANCED: 'warning',
  LOW: 'warning',
  POOR: 'danger',
}

export interface RecoveryCardProps {
  summary: RecoverySummary
  today: IsoDate
}

/**
 * Toparlanma: last night's sleep, HRV, resting HR and steps from Garmin for the most recent
 * day with data, each with its 7-day average and direction, plus how many recent nights met
 * the plan's 00:00 bedtime. Metrics Garmin has not got for that day are left out.
 */
export function RecoveryCard({ summary, today }: RecoveryCardProps) {
  const { day, week, bedtime } = summary
  const sleepWindow =
    day.sleepStartLocal && day.sleepEndLocal
      ? `${day.sleepStartLocal.slice(11, 16)}–${day.sleepEndLocal.slice(11, 16)}`
      : day.sleepStartLocal?.slice(11, 16)
  const sleepDetail = [day.sleepScore != null && `skor ${day.sleepScore}`, sleepWindow]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card title="Toparlanma" aside={day.date === today ? 'Garmin' : `Garmin · ${formatShortDate(day.date)}`}>
      <div className="flex flex-col gap-5">
        <StatGrid>
          {day.sleepMin != null && (
            <Stat
              label="Uyku"
              value={<SleepDuration min={day.sleepMin} />}
              hint={
                <Hint
                  detail={sleepDetail || undefined}
                  week={week.sleepMin}
                  formatAvg={formatActivityDuration}
                  good="up"
                />
              }
            />
          )}
          {day.hrvNightAvg != null && (
            <Stat
              label="HRV gece ort."
              value={Math.round(day.hrvNightAvg)}
              unit="ms"
              hint={
                <Hint
                  detail={
                    day.hrvStatus && (
                      <Badge tone={HRV_STATUS_TONE[day.hrvStatus] ?? 'neutral'}>
                        {HRV_STATUS_TR[day.hrvStatus] ?? day.hrvStatus}
                      </Badge>
                    )
                  }
                  week={week.hrvNightAvg}
                  formatAvg={(avg) => `${formatNumber(avg, 0)} ms`}
                  good="up"
                />
              }
            />
          )}
          {day.restingHr != null && (
            <Stat
              label="Dinlenik nabız"
              value={Math.round(day.restingHr)}
              unit="bpm"
              hint={
                <Hint week={week.restingHr} formatAvg={(avg) => `${formatNumber(avg, 0)} bpm`} good="down" />
              }
            />
          )}
          {day.steps != null && (
            <Stat
              label="Adım"
              value={formatNumber(day.steps, 0)}
              hint={<Hint week={week.steps} formatAvg={(avg) => formatNumber(avg, 0)} good="up" />}
            />
          )}
        </StatGrid>
        {bedtime && (
          <div className="flex flex-col gap-1.5">
            <ProgressBar
              label="00:00'da yatakta"
              value={bedtime.onTime}
              max={bedtime.nights}
              valueText={`${bedtime.onTime}/${bedtime.nights} gece`}
              tone={bedtime.onTime === bedtime.nights ? 'success' : 'accent'}
            />
            <p className="text-xs text-text-faint">
              Son {bedtime.nights} kayıtlı gecede {ASLEEP_BY}'dan önce uykuya dalış
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

/** "7 sa 12 dk" with the units in the Stat's small unit style. */
function SleepDuration({ min }: { min: number }) {
  const total = Math.round(min)
  const h = Math.floor(total / 60)
  const m = total % 60
  const unit = 'text-sm font-medium text-text-muted'
  return (
    <>
      {h > 0 && (
        <>
          {h} <span className={unit}>sa</span>
        </>
      )}
      {h > 0 && m > 0 && ' '}
      {(m > 0 || h === 0) && (
        <>
          {m} <span className={unit}>dk</span>
        </>
      )}
    </>
  )
}

interface HintProps {
  /** Line about the shown day itself (sleep score and window, HRV status). */
  detail?: ReactNode
  week?: WeekAverage
  formatAvg: (avg: number) => string
  good: 'up' | 'down'
}

/** Stat hint: the day's detail line, then the 7-day average with its direction. */
function Hint({ detail, week, formatAvg, good }: HintProps) {
  return (
    <span className="flex flex-col items-start gap-1">
      {detail && <span>{detail}</span>}
      {week && (
        <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
          7 gün ort. {formatAvg(week.avg)}
          {week.direction && <TrendBadge trend={week.direction} good={good} />}
        </span>
      )}
    </span>
  )
}
