import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionScreen } from '@/screens/SessionScreen'
import { SessionPickerSheet } from '@/components/session/SessionPickerSheet'
import { toLocalISODate } from '@/lib/dates'
import { plan, sessionById, sessionExercises } from '@/lib/plan'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'
import type { SessionId } from '@/types/plan'
import type { StrengthLogEntry } from '@/types/userData'

const DATE = '2026-11-17'
const s = () => useStore.getState()
const namesOf = (id: SessionId) => sessionExercises(sessionById(id)!).map((e) => e.name)
// push: Bench Press · Incline Dumbbell Press · Shoulder Press · [Lateral Raise, Rope Pushdown] · Machine Chest Press
const PUSH = namesOf('push')
const idx = (name: string) => PUSH.indexOf(name)

/** The production log of 2026-11-16: single-set entries without a sessionId. */
const PRODUCTION_LOG: StrengthLogEntry[] = [
  ['Incline Dumbbell Press', 30, 7, 8],
  ['Pull Up / Lat Pulldown', 60, 10, 9],
  ['Machine Chest Press', 40, 10, 7],
  ['Machine Chest Press', 40, 12, 7],
  ['Seated Cable Row', 50, 10, 9],
  ['Lateral Raise', 10, 20, 8],
  ['Cable Curl', 25, 12, 8],
  ['Rope Pushdown', 35, 12, 7],
].map(([exerciseName, weightKg, reps, rpe], i) => ({
  id: `prod-${i}`,
  date: '2026-11-16',
  exerciseName: exerciseName as string,
  sets: [{ weightKg: weightKg as number, reps: reps as number, rpe: rpe as number }],
  createdAt: `2026-11-16T07:0${i}:00.000Z`,
}))

function startPush(): string {
  return s().startSession(DATE, 'push', PUSH)
}

function renderApp(path = '/session', home = <p>Bugün ekranı</p>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={home} />
        <Route path="/session" element={<SessionScreen />} />
        <Route path="/exercises/:name" element={<p>Hareket detayı</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const sessionSets = (id: string, name: string) =>
  s().strengthLog.find((e) => e.sessionId === id && e.exerciseName === name)?.sets ?? []
const lastToast = () => useToast.getState().toasts.at(-1)?.text

describe('SessionScreen without a running session', () => {
  it('shows the session picker inline and starts the chosen plan session', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.getByRole('heading', { level: 1, name: 'Antrenman' })).toBeInTheDocument()
    for (const session of plan.sessions) {
      // Titles are plain text ("Omuz + kol"), not regex source.
      const startsWithTitle = (name: string) => name.startsWith(session.title) && name.includes('hareket')
      expect(screen.getByRole('button', { name: startsWithTitle })).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: /^Push.*hareket/ }))

    const active = s().activeSession
    expect(active).toMatchObject({ planSessionId: 'push', exerciseNames: PUSH, date: toLocalISODate() })
    expect(screen.getByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
  })

  it('starts a free session with no exercises', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /^Serbest antrenman/ }))

    expect(s().activeSession).toMatchObject({ planSessionId: 'free', exerciseNames: [] })
    expect(screen.getByRole('heading', { level: 1, name: 'Serbest antrenman' })).toBeInTheDocument()
  })
})

describe('starting while a session runs', () => {
  it('resumes the running session instead of starting a second one', async () => {
    const user = userEvent.setup()
    const id = s().startSession(DATE, 'pull', namesOf('pull'))
    renderApp('/', <SessionPickerSheet open onClose={() => {}} suggested="push" />)

    await user.click(screen.getByRole('button', { name: /^Push.*hareket/ }))

    expect(s().activeSession).toMatchObject({ id, planSessionId: 'pull' })
    expect(screen.getByRole('heading', { level: 1, name: 'Pull' })).toBeInTheDocument()
  })
})

describe('SessionScreen with a running session', () => {
  it('saves a set with weight, reps and RPE under the running session', async () => {
    const user = userEvent.setup()
    const id = startPush()
    renderApp()

    expect(row('Bench Press')).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('radio', { name: 'RPE 9, zor' }))
    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))

    const entry = s().strengthLog.find((e) => e.sessionId === id)
    expect(entry).toMatchObject({ date: DATE, exerciseName: 'Bench Press' })
    expect(entry?.sets).toEqual([expect.objectContaining({ weightKg: 80, reps: 5, rpe: 9, kind: 'working' })])
    expect(lastToast()).toMatch(/Kaydedildi/)

    // 1 × 5 is complete: the row collapses to what was logged and the next exercise opens.
    expect(row('Bench Press')).toHaveAttribute('aria-expanded', 'false')
    expect(row('Bench Press')).toHaveAccessibleName(/80 kg × 5 · RPE 9.*tamam/)
    expect(row('Incline Dumbbell Press')).toHaveAttribute('aria-expanded', 'true')
    expect(s().activeSession?.currentIndex).toBe(1)
    expect(screen.getByText('1/6 hareket')).toBeInTheDocument()
  })

  it('prefills the plan start load before any history exists', () => {
    startPush()
    renderApp()

    expect(screen.getByLabelText('Ağırlık')).toHaveValue('80')
    expect(screen.getByLabelText('Tekrar')).toHaveValue('5')
    expect(screen.getByText('Hedef 1 × 5 · 80 kg')).toBeInTheDocument()
    expect(screen.getByText('Şimdiki yükün')).toBeInTheDocument()
  })

  it('prefills from last time and suggests a step up when it was easy', () => {
    useStore.setState({ strengthLog: PRODUCTION_LOG })
    startPush()
    s().setSessionIndex(idx('Machine Chest Press'))
    renderApp()

    // Last top set 40 × 12 at RPE 7 reached the 12-rep target → +2.5 kg.
    expect(screen.getByLabelText('Ağırlık')).toHaveValue('42,5')
    expect(screen.getByLabelText('Tekrar')).toHaveValue('12')
    expect(screen.getByText('Geçen sefer kolaydı, +2,5 kg dene')).toBeInTheDocument()
    expect(screen.getByText('Pzt 16 Kas · 40 kg × 12 · RPE 7')).toBeInTheDocument()
    // Collapsed rows show their own target from last time: 30 × 7 at RPE 8 missed 8 reps → hold.
    expect(row('Incline Dumbbell Press')).toHaveAccessibleName(/Hedef 1 × 8 · 30 kg/)
  })

  it('logs a warmup set without marking the exercise done', async () => {
    const user = userEvent.setup()
    const id = startPush()
    renderApp()

    await user.click(screen.getByRole('checkbox', { name: /Isınma seti/ }))
    expect(screen.getByLabelText('Ağırlık')).toHaveValue('47,5')
    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))

    expect(sessionSets(id, 'Bench Press')).toEqual([
      expect.objectContaining({ weightKg: 47.5, reps: 5, kind: 'warmup' }),
    ])
    expect(s().activeSession?.currentIndex).toBe(0)
    expect(row('Bench Press')).toHaveAttribute('aria-expanded', 'true')
    expect(row('Bench Press')).not.toHaveAccessibleName(/tamam/)
    expect(screen.getByText('0/6 hareket')).toBeInTheDocument()
    // The next set is a working set again, prefilled with the working load.
    expect(screen.getByLabelText('Ağırlık')).toHaveValue('80')
  })

  it('alternates between superset exercises until all rounds are done', async () => {
    const user = userEvent.setup()
    const id = startPush()
    s().setSessionIndex(idx('Lateral Raise'))
    renderApp()
    const save = () => user.click(screen.getByRole('button', { name: 'Seti kaydet' }))

    expect(screen.getByText('0/2 tur')).toBeInTheDocument()
    await save()
    expect(s().activeSession?.currentIndex).toBe(idx('Rope Pushdown'))
    await save()
    expect(s().activeSession?.currentIndex).toBe(idx('Lateral Raise'))
    expect(screen.getByText('1/2 tur')).toBeInTheDocument()
    await save()
    expect(s().activeSession?.currentIndex).toBe(idx('Rope Pushdown'))
    await save()
    expect(s().activeSession?.currentIndex).toBe(idx('Machine Chest Press'))
    expect(screen.getByText('2/2 tur')).toBeInTheDocument()

    expect(sessionSets(id, 'Lateral Raise')).toEqual([
      expect.objectContaining({ weightKg: 10, reps: 15 }),
      expect.objectContaining({ weightKg: 10, reps: 15 }),
    ])
    expect(sessionSets(id, 'Rope Pushdown')).toHaveLength(2)
  })

  it('adds a catalog exercise and expands it', async () => {
    const user = userEvent.setup()
    startPush()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Hareket ekle' }))
    const sheet = screen.getByRole('dialog', { name: 'Hareket ekle' })
    await user.type(within(sheet).getByLabelText('Hareket ara'), 'squat')
    await user.click(within(sheet).getByRole('button', { name: /^Squat/ }))

    expect(s().activeSession?.exerciseNames).toEqual([...PUSH, 'Squat'])
    expect(s().activeSession?.currentIndex).toBe(PUSH.length)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(row('Squat')).toHaveAttribute('aria-expanded', 'true')
  })

  it('adds a new exercise typed by the user, logged in kg', async () => {
    const user = userEvent.setup()
    const id = startPush()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Hareket ekle' }))
    await user.type(screen.getByLabelText('Hareket ara'), 'Cable Fly')
    await user.click(screen.getByRole('button', { name: /Cable Fly” ekle/ }))
    await user.type(screen.getByLabelText('Ağırlık'), '20')
    await user.type(screen.getByLabelText('Tekrar'), '12')
    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))

    expect(s().activeSession?.exerciseNames.at(-1)).toBe('Cable Fly')
    expect(sessionSets(id, 'Cable Fly')).toEqual([expect.objectContaining({ weightKg: 20, reps: 12 })])
  })

  it('edits and removes a logged set', async () => {
    const user = userEvent.setup()
    const id = startPush()
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench Press',
      sets: [{ weightKg: 50, reps: 5, kind: 'warmup' }],
    })
    renderApp()

    const list = screen.getByRole('list', { name: 'Bu seansın setleri' })
    await user.click(within(list).getByRole('button', { name: /50 kg × 5/ }))
    const editor = screen.getByRole('dialog', { name: '1. seti düzenle' })
    await user.click(within(editor).getByRole('button', { name: 'Tekrar artır' }))
    await user.click(within(editor).getByRole('button', { name: 'Kaydet' }))
    expect(sessionSets(id, 'Bench Press')).toEqual([
      expect.objectContaining({ weightKg: 50, reps: 6, kind: 'warmup' }),
    ])

    await user.click(within(screen.getByRole('list', { name: 'Bu seansın setleri' })).getByRole('button', { name: /50 kg × 6/ }))
    await user.click(screen.getByRole('button', { name: 'Sil' }))
    await user.click(screen.getByRole('button', { name: 'Sil' }))
    expect(s().strengthLog.filter((e) => e.sessionId === id)).toHaveLength(0)
  })

  it('restores logged sets and the open exercise from the store after a reload', () => {
    const id = startPush()
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench Press',
      sets: [{ weightKg: 82.5, reps: 5, rpe: 8, kind: 'working' }],
    })
    s().setSessionIndex(idx('Shoulder Press'))
    renderApp()

    expect(row('Bench Press')).toHaveAccessibleName(/82,5 kg × 5 · RPE 8.*tamam/)
    expect(row('Shoulder Press')).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps one primary action: "Seti kaydet" until the plan is done, then "Seansı bitir"', async () => {
    const user = userEvent.setup()
    const id = startPush()
    for (const ex of sessionExercises(sessionById('push')!)) {
      if (ex.name === 'Machine Chest Press') continue
      s().upsertSessionSets({
        sessionId: id,
        date: DATE,
        exerciseName: ex.name,
        sets: Array.from({ length: ex.sets }, () => ({ weightKg: 20, reps: 10, kind: 'working' as const })),
      })
    }
    s().setSessionIndex(idx('Machine Chest Press'))
    renderApp()

    const saveButton = () => screen.getByRole('button', { name: 'Seti kaydet' })
    const finishButton = () => screen.getByRole('button', { name: 'Seansı bitir' })
    expect(screen.getByText('5/6 hareket')).toBeInTheDocument()
    expect(saveButton()).toHaveClass('bg-volt')
    expect(finishButton()).not.toHaveClass('bg-volt')

    await user.click(saveButton())
    expect(screen.getByText('6/6 hareket')).toBeInTheDocument()
    expect(finishButton()).toHaveClass('bg-volt')
    expect(saveButton()).not.toHaveClass('bg-volt')
  })

  it('keeps "Seansı bitir" secondary in a free session while an exercise is open', () => {
    s().startSession(DATE, 'free', ['Bench Press'])
    renderApp()

    expect(row('Bench Press')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Seti kaydet' })).toHaveClass('bg-volt')
    expect(screen.getByRole('button', { name: 'Seansı bitir' })).not.toHaveClass('bg-volt')
  })

  it('finishes a session with working sets as a counted workout', async () => {
    const user = userEvent.setup()
    startPush()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))
    await user.click(screen.getByRole('button', { name: 'Seansı bitir' }))

    expect(s().activeSession).toBeUndefined()
    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
    expect(lastToast()).toBe('Antrenman kaydedildi')
    expect(screen.getByText('Bugün ekranı')).toBeInTheDocument()
  })

  it('closes a session without working sets without counting it', async () => {
    const user = userEvent.setup()
    startPush()
    renderApp()

    await user.click(screen.getByRole('checkbox', { name: /Isınma seti/ }))
    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))
    await user.click(screen.getByRole('button', { name: 'Seansı bitir' }))

    expect(s().activeSession).toBeUndefined()
    expect(s().checklist[DATE]?.items.completedWorkout).not.toBe(true)
    expect(lastToast()).toBe('Kayıt yok, seans kapatıldı')
    expect(screen.getByText('Bugün ekranı')).toBeInTheDocument()
  })

  it('leaves a session from the close dialog and keeps its sets', async () => {
    const user = userEvent.setup()
    const id = startPush()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))
    await user.click(screen.getByRole('button', { name: 'Seanstan çık' }))
    await user.click(screen.getByRole('button', { name: 'Bırak · Kayıtlar kalır' }))

    expect(s().activeSession).toBeUndefined()
    expect(sessionSets(id, 'Bench Press')).toHaveLength(1)
    expect(s().checklist[DATE]?.items.completedWorkout).not.toBe(true)
  })
})

describe('rest timer', () => {
  const timer = () => screen.getByRole('timer', { name: 'Kalan dinlenme' })
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
  function fakeClock() {
    // Only the clock and timers (faking setImmediate stalls fake-indexeddb), and moving with
    // real time: Testing Library's async wrapper waits on a setTimeout(0) under user-event.
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  }

  it('starts right after a logged set, counts down, moves by 15 s and skips', async () => {
    const user = fakeClock()
    startPush()
    renderApp()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))
    expect(timer()).toHaveTextContent('2:00')

    await advance(30_000)
    expect(timer()).toHaveTextContent('1:30')
    await user.click(screen.getByRole('button', { name: '15 saniye uzat' }))
    expect(timer()).toHaveTextContent('1:45')
    await user.click(screen.getByRole('button', { name: '15 saniye kısalt' }))
    await user.click(screen.getByRole('button', { name: '15 saniye kısalt' }))
    expect(timer()).toHaveTextContent('1:15')

    await user.click(screen.getByRole('button', { name: 'Atla' }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(s().activeSession?.rest).toBeUndefined()
  })

  it('gives a warmup one minute, says when rest is over and closes itself', async () => {
    const user = fakeClock()
    startPush()
    renderApp()

    await user.click(screen.getByRole('checkbox', { name: /Isınma seti/ }))
    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))
    expect(timer()).toHaveTextContent('1:00')

    await advance(60_000)
    expect(timer()).toHaveTextContent('0:00')
    expect(screen.getByText('Dinlenme bitti')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '15 saniye uzat' })).not.toBeInTheDocument()

    await advance(5_000)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('restarts with each new set and survives a reload of the screen', async () => {
    const user = fakeClock()
    startPush()
    const { unmount } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))
    await advance(90_000)
    expect(timer()).toHaveTextContent('0:30')

    unmount()
    renderApp()
    expect(timer()).toHaveTextContent('0:30')
    await user.click(screen.getByRole('button', { name: 'Seti kaydet' }))
    expect(timer()).toHaveTextContent('2:00')
  })
})
