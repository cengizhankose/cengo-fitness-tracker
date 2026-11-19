import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Info, Plus, X } from 'lucide-react'
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Screen, Sheet } from '@/components/ui'
import { AddExerciseSheet } from '@/components/session/AddExerciseSheet'
import { ExerciseItem } from '@/components/session/ExerciseItem'
import { RestTimerPanel } from '@/components/session/RestTimerPanel'
import { primeRestAlarm } from '@/components/session/restAlarm'
import { SessionPickerList } from '@/components/session/SessionPickerSheet'
import {
  formatLoggedSet,
  groupMembers,
  nextExerciseIndex,
  REST_SECONDS,
  planExercisesByName,
  sessionLayout,
  supersetRounds,
} from '@/components/session/sessionModel'
import { useStartSession } from '@/components/session/useStartSession'
import { toLocalISODate } from '@/lib/dates'
import { exerciseSummary, exerciseUnit, sessionEntries, sessionProgress, setKind } from '@/lib/exerciseStats'
import { defaultSessionForDate, plan, sessionById } from '@/lib/plan'
import { useStore } from '@/store'
import { useActiveSession, useStrengthLog } from '@/store/selectors'
import { useToast } from '@/store/toast'
import type { ActiveSession, StrengthSet } from '@/types/userData'

/** Working sets in a set list (warmups never count toward progress). */
function workingDoneIn(sets: readonly StrengthSet[] | undefined): number {
  return sets?.filter((s) => setKind(s) === 'working').length ?? 0
}

/** `/session`: the running workout, or the session picker when none runs. */
export function SessionScreen() {
  const active = useActiveSession()
  return active ? <RunningSession active={active} /> : <PickSession />
}

function PickSession() {
  const start = useStartSession()
  const suggested = defaultSessionForDate(toLocalISODate())
  const suggestedSession = suggested ? sessionById(suggested) : undefined

  return (
    <Screen
      title="Antrenman"
      subtitle="Bir seans seç"
      back="/"
      footer={
        suggestedSession && (
          <Button size="lg" fullWidth icon={Dumbbell} onClick={() => start(suggestedSession.id)}>
            {`${suggestedSession.title} başlat`}
          </Button>
        )
      }
    >
      <SessionPickerList suggested={suggested} />
    </Screen>
  )
}

function RunningSession({ active }: { active: ActiveSession }) {
  const navigate = useNavigate()
  const strengthLog = useStrengthLog()
  const pushToast = useToast((s) => s.push)
  const setSessionIndex = useStore((s) => s.setSessionIndex)
  const upsertSessionSets = useStore((s) => s.upsertSessionSets)
  const addSessionExercise = useStore((s) => s.addSessionExercise)
  const finishSession = useStore((s) => s.finishSession)
  const discardSession = useStore((s) => s.discardSession)
  const startRest = useStore((s) => s.startRest)

  const [exitOpen, setExitOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const session = sessionById(active.planSessionId)
  const names = active.exerciseNames
  const groups = useMemo(() => sessionLayout(names, session), [names, session])
  const planByName = useMemo(() => planExercisesByName(session), [session])

  /** This session's sets per exercise — read from the store, never kept locally. */
  const setsByName = useMemo(
    () =>
      new Map(
        names.map((name) => [name, sessionEntries(strengthLog, active.id, name).flatMap((e) => e.sets)]),
      ),
    [strengthLog, active.id, names],
  )
  /** "Last time" excludes this session, so a light set logged now never becomes the target. */
  const summaries = useMemo(() => {
    const history = strengthLog.filter((e) => e.sessionId !== active.id)
    return new Map(names.map((name) => [name, exerciseSummary(history, name)]))
  }, [strengthLog, active.id, names])

  const { progressText, planComplete } = useMemo(() => {
    if (session) {
      const { exercises, complete } = sessionProgress(session, strengthLog, active.id)
      const doneCount = exercises.filter((e) => e.done).length
      return { progressText: `${doneCount}/${exercises.length} hareket`, planComplete: complete }
    }
    const logged = names.filter((n) => workingDoneIn(setsByName.get(n)) > 0).length
    return { progressText: `${logged} hareket`, planComplete: false }
  }, [session, strengthLog, active.id, names, setsByName])
  // One primary action at a time: "Seti kaydet" in the open exercise while there is work
  // left, "Seansı bitir" once the plan is done (free sessions: when no exercise is open).
  const finishIsPrimary = session ? planComplete : names.length === 0

  function writeSets(name: string, sets: StrengthSet[]) {
    upsertSessionSets({ sessionId: active.id, date: active.date, exerciseName: name, sets })
  }

  function logSet(name: string, set: StrengthSet) {
    writeSets(name, [...(setsByName.get(name) ?? []), set])
    pushToast(`Kaydedildi · ${formatLoggedSet(set, planByName.get(name)?.unit ?? exerciseUnit(name))}`, 'success')
    // Inside the "Seti kaydet" tap: the only moment iOS lets the page arm the end-of-rest beep.
    primeRestAlarm()
    startRest(REST_SECONDS[setKind(set)])
    if (setKind(set) !== 'working') return
    const log = useStore.getState().strengthLog
    const next = nextExerciseIndex(
      groups,
      (n) => workingDoneIn(sessionEntries(log, active.id, n).flatMap((e) => e.sets)),
      name,
    )
    if (next !== undefined) setSessionIndex(next)
  }

  function addExercise(name: string) {
    setAddOpen(false)
    addSessionExercise(name)
    const index = useStore.getState().activeSession?.exerciseNames.indexOf(name) ?? -1
    if (index >= 0) setSessionIndex(index)
  }

  function finish() {
    const counted = finishSession()
    pushToast(counted ? 'Antrenman kaydedildi' : 'Kayıt yok, seans kapatıldı', counted ? 'success' : 'default')
    navigate('/')
  }

  function leave() {
    discardSession()
    pushToast('Seans bırakıldı, kayıtlar kalır')
    navigate('/')
  }

  return (
    <Screen
      title={session?.title ?? 'Serbest antrenman'}
      subtitle={<span className="tabular-nums">{progressText}</span>}
      action={
        <>
          <IconButton icon={Info} aria-label="Seans kuralları" onClick={() => setRulesOpen(true)} />
          <IconButton icon={X} aria-label="Seanstan çık" onClick={() => setExitOpen(true)} />
        </>
      }
      footer={
        <>
          {active.rest && <RestTimerPanel rest={active.rest} />}
          <Button size="lg" fullWidth variant={finishIsPrimary ? 'primary' : 'secondary'} onClick={finish}>
            Seansı bitir
          </Button>
        </>
      }
    >
      {names.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz hareket yok"
          hint="İlk hareketini ekle."
          action={
            <Button variant="secondary" icon={Plus} onClick={() => setAddOpen(true)}>
              Hareket ekle
            </Button>
          }
        />
      ) : (
        <>
          <ol className="flex flex-col gap-3">
            {groups.map((group) => {
              const members = groupMembers(group)
              const items = members.map((ex, i) => (
                <Fragment key={ex.name}>
                  {i > 0 && <hr className="border-border" />}
                  <ExerciseItem
                    exercise={ex}
                    sets={setsByName.get(ex.name) ?? []}
                    summary={summaries.get(ex.name)!}
                    expanded={ex.index === active.currentIndex}
                    onExpand={() => setSessionIndex(ex.index)}
                    onLog={(set) => logSet(ex.name, set)}
                    onReplaceSets={(sets) => writeSets(ex.name, sets)}
                    logIsPrimary={!finishIsPrimary}
                  />
                </Fragment>
              ))
              if (group.kind === 'single') {
                return (
                  <li key={group.exercise.name} className="overflow-hidden rounded-lg border border-border bg-card">
                    {items}
                  </li>
                )
              }
              const rounds = supersetRounds(members, (n) => workingDoneIn(setsByName.get(n)))
              return (
                <li
                  key={members.map((m) => m.name).join('+')}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <p className="flex items-center justify-between px-4 pt-3 text-xs font-semibold tracking-wider text-volt uppercase">
                    <span>Superset</span>
                    <span className="tabular-nums">{`${rounds.done}/${rounds.total} tur`}</span>
                  </p>
                  {items}
                </li>
              )
            })}
          </ol>
          <Button variant="secondary" icon={Plus} onClick={() => setAddOpen(true)}>
            Hareket ekle
          </Button>
        </>
      )}

      <AddExerciseSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sessionNames={names}
        onPick={addExercise}
      />

      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)} title="Seans kuralları">
        <Card>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
            {plan.sessionRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </Card>
      </Sheet>

      <ConfirmDialog
        open={exitOpen}
        title="Seanstan çık"
        message={
          <>
            <span className="block">Bitirince antrenman sayılır.</span>
            <Button variant="secondary" fullWidth className="mt-4" onClick={leave}>
              Bırak · Kayıtlar kalır
            </Button>
          </>
        }
        confirmLabel="Seansı bitir"
        onConfirm={finish}
        onCancel={() => setExitOpen(false)}
      />
    </Screen>
  )
}
