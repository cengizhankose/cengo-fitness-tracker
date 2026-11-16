import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Play, Plus } from 'lucide-react'
import { Badge, Button, Card, ProgressBar, Stat } from '@/components/ui'
import { SessionPickerSheet } from '@/components/session/SessionPickerSheet'
import { useStartSession } from '@/components/session/useStartSession'
import { exerciseSummary, groupStrengthByDay, nextTarget } from '@/lib/exerciseStats'
import { blocksForDate, sessionById, sessionExercises } from '@/lib/plan'
import type { WeekDayOverview } from '@/lib/week'
import { useActiveSession, useStrengthLog } from '@/store/selectors'
import type { DayBlock, RunBlock, Session } from '@/types/plan'
import type { IsoDate } from '@/types/userData'
import { BlockRow } from './BlockRow'
import { LoggedToday } from './LoggedToday'
import {
  RUN_HR_RULE,
  activeSessionProgress,
  formatIncrease,
  formatTarget,
  runTargetLabel,
} from './todayModel'

/** Exercises previewed with today's target on the start card. */
const PREVIEW_COUNT = 3

export interface TodayTrainingProps {
  today: IsoDate
  /** Today's entry of the week overview (done flags for run/football rows). */
  day?: WeekDayOverview
}

/**
 * Today's training: the main card (start / resume / done for strength days, the run on
 * Sunday, the two alternatives on Saturday) plus compact rows for the day's other blocks.
 */
export function TodayTraining({ today, day }: TodayTrainingProps) {
  const strengthLog = useStrengthLog()
  const active = useActiveSession()
  const start = useStartSession()
  const [pickerOpen, setPickerOpen] = useState(false)

  const blocks = useMemo(() => blocksForDate(today), [today])
  const strengthBlock = blocks.find((b) => b.type === 'strength')
  const daySession =
    strengthBlock && !strengthBlock.optional ? sessionById(strengthBlock.sessionId) : undefined

  const loggedToday = useMemo(
    () => groupStrengthByDay(strengthLog).filter((d) => d.date === today && d.workingSets.length > 0),
    [strengthLog, today],
  )
  const progress = useMemo(
    () => (active ? activeSessionProgress(active, strengthLog) : undefined),
    [active, strengthLog],
  )

  const openPicker = () => setPickerOpen(true)
  const blockDone = (block: DayBlock) =>
    block.type === 'run'
      ? day?.runDone
      : block.type === 'football'
        ? day?.otherActivityDone
        : day?.strengthDone
  const otherBlocks = blocks.filter((b) => b.type !== 'strength')

  let main: ReactNode
  let rows: DayBlock[] = otherBlocks
  if (active && progress) {
    main = (
      <Card
        title={sessionById(active.planSessionId)?.title ?? 'Serbest antrenman'}
        aside={<Badge tone="accent">Sürüyor</Badge>}
        tone="accent"
      >
        <div className="flex flex-col gap-4">
          <ProgressBar label="Hareket" value={progress.done} max={progress.total} />
          <Button to="/session" size="lg" fullWidth icon={Play}>
            Devam et
          </Button>
        </div>
      </Card>
    )
  } else if (loggedToday.length > 0) {
    main = (
      <Card
        title={daySession?.title ?? 'Antrenman'}
        aside={
          <Badge tone="success" icon={Check}>
            Yapıldı
          </Badge>
        }
        tone="success"
        flush
        footer={
          <Button variant="secondary" fullWidth icon={Plus} onClick={openPicker}>
            Başka seans ekle
          </Button>
        }
      >
        <LoggedToday days={loggedToday} />
      </Card>
    )
  } else if (daySession) {
    main = <StartCard session={daySession} onStart={() => start(daySession.id)} onPick={openPicker} />
  } else if (blocks.length > 0 && blocks.every((b) => b.optional)) {
    main = (
      <Card
        title="Seçmeli gün"
        aside="Birini seç ya da dinlen"
        flush
        footer={
          <Button variant="ghost" fullWidth onClick={openPicker}>
            Başka seans seç
          </Button>
        }
      >
        {blocks.map((block, i) => (
          <BlockRow key={i} block={block} date={today} done={blockDone(block)} onStart={start} />
        ))}
      </Card>
    )
    rows = []
  } else {
    const run = blocks.find((b): b is RunBlock => b.type === 'run')
    main = run ? (
      <RunCard block={run} date={today} done={day?.runDone ?? false} onAdd={openPicker} />
    ) : (
      <Card title="Dinlenme günü">
        <Button variant="secondary" fullWidth icon={Plus} onClick={openPicker}>
          Antrenman ekle
        </Button>
      </Card>
    )
    rows = blocks.filter((b) => b !== run)
  }

  return (
    <>
      {main}
      {rows.length > 0 && (
        <Card flush>
          {rows.map((block, i) => (
            <BlockRow key={i} block={block} date={today} done={blockDone(block)} />
          ))}
        </Card>
      )}
      <SessionPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        suggested={strengthBlock?.sessionId}
      />
    </>
  )
}

interface StartCardProps {
  session: Session
  onStart: () => void
  onPick: () => void
}

/** Today's session before it starts: title, duration, exercise count, the first targets and the start button. */
function StartCard({ session, onStart, onPick }: StartCardProps) {
  const strengthLog = useStrengthLog()
  const exercises = useMemo(() => sessionExercises(session), [session])
  const preview = useMemo(
    () =>
      exercises.slice(0, PREVIEW_COUNT).map((ex) => ({
        name: ex.name,
        target: nextTarget(ex, exerciseSummary(strengthLog, ex.name)),
      })),
    [exercises, strengthLog],
  )
  const more = exercises.length - preview.length

  return (
    <Card
      title={session.title}
      aside={`${session.durationMin} dk · ${exercises.length} hareket`}
      tone="accent"
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2" aria-label="Bugünün hedefleri">
          {preview.map(({ name, target }) => {
            const increase = formatIncrease(target)
            return (
              <li key={name} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-base">{name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {increase && <Badge tone="accent">{increase}</Badge>}
                  <span className="num text-num-sm">{formatTarget(target)}</span>
                </span>
              </li>
            )
          })}
          {more > 0 && <li className="text-sm text-text-muted">+{more} hareket</li>}
        </ul>
        <div className="flex flex-col gap-1">
          <Button size="lg" fullWidth icon={Play} onClick={onStart}>
            Antrenmana başla
          </Button>
          <Button variant="ghost" fullWidth onClick={onPick}>
            Başka seans seç
          </Button>
        </div>
      </div>
    </Card>
  )
}

interface RunCardProps {
  block: RunBlock
  date: IsoDate
  done: boolean
  onAdd: () => void
}

/** A run as the day's main block (Sunday): target, HR rule, and a way to add a strength session. */
function RunCard({ block, date, done, onAdd }: RunCardProps) {
  const target = runTargetLabel(block, date)
  return (
    <Card
      title={block.title}
      aside={
        done ? (
          <Badge tone="success" icon={Check}>
            Yapıldı
          </Badge>
        ) : undefined
      }
      tone="run"
    >
      <div className="flex flex-col gap-4">
        {target && <Stat label="Hedef" value={target} size="lg" />}
        <p className="text-sm text-text-muted">{RUN_HR_RULE}</p>
        <Button variant="secondary" fullWidth icon={Plus} onClick={onAdd}>
          Antrenman ekle
        </Button>
      </div>
    </Card>
  )
}
