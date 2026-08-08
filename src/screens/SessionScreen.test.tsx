import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SessionScreen } from '@/screens/SessionScreen'
import { useStore } from '@/store'
import { plan } from '@/lib/plan'
import { scheduleForDay } from '@/lib/derive'

const DATE = '2026-08-03' // a Monday
const monday = scheduleForDay(plan, 'Monday')
if (monday.type !== 'strength') throw new Error('fixture expects Monday to be a strength day')
const NAMES = monday.exercises.map((e) => e.name)
const FIRST = NAMES[0]!
const SECOND = NAMES[1]!
const LAST = NAMES[NAMES.length - 1]!

const s = () => useStore.getState()

function startSession(): string {
  return s().startSession(DATE, 'Monday', NAMES)
}

function renderSession() {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <SessionScreen />
    </MemoryRouter>,
  )
}

const setList = () => screen.getByRole('list')
const weightInput = () => screen.getByRole('spinbutton')

beforeEach(() => {
  s().resetAll()
})

describe('SessionScreen', () => {
  it('falls back to an empty state without an active session', () => {
    renderSession()
    expect(screen.getByText('No active workout')).toBeInTheDocument()
  })

  it('renders the first exercise and the session progress', () => {
    startSession()
    renderSession()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(FIRST)
    expect(screen.getByText(`Upper A · 1/${NAMES.length}`)).toBeInTheDocument()
    expect(screen.getByText(`0 of ${NAMES.length} done`)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('adds a set to the list and writes it to the store', async () => {
    const user = userEvent.setup()
    const id = startSession()
    renderSession()

    await user.type(weightInput(), '40')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(within(setList()).getByText('40kg × 8')).toBeInTheDocument()

    const entry = s().strengthLog.find((e) => e.sessionId === id && e.exerciseName === FIRST)
    expect(entry?.sets).toHaveLength(1)
    expect(entry?.sets[0]).toMatchObject({ weightKg: 40, reps: 8, kind: 'warmup' })
  })

  it('logs a working set once the prescribed warmups are in', async () => {
    const user = userEvent.setup()
    const id = startSession()
    renderSession()

    // Incline Dumbbell Press prescribes 2 warmups, so the editor starts on warmup.
    await user.type(weightInput(), '30')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    await user.clear(weightInput())
    await user.type(weightInput(), '35')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    await user.clear(weightInput())
    await user.type(weightInput(), '50')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    const sets = s().strengthLog.find((e) => e.sessionId === id)?.sets ?? []
    expect(sets.map((x) => x.kind)).toEqual(['warmup', 'warmup', 'working'])
    expect(screen.getByText('2/2 warmup')).toBeInTheDocument()
    expect(screen.getByText('1/1 × 6-10')).toBeInTheDocument()
  })

  it('deletes a set', async () => {
    const user = userEvent.setup()
    startSession()
    renderSession()

    await user.type(weightInput(), '40')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    expect(within(setList()).getByText('40kg × 8')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete set W1' }))

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(s().strengthLog).toHaveLength(0)
  })

  it('advances to the next exercise on save & next', async () => {
    const user = userEvent.setup()
    startSession()
    renderSession()

    await user.type(weightInput(), '40')
    await user.click(screen.getByRole('button', { name: /save & next/i }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(SECOND)
    expect(s().activeSession?.currentIndex).toBe(1)
    expect(s().strengthLog[0]?.exerciseName).toBe(FIRST)
  })

  it('skips an exercise when the editor is empty', async () => {
    const user = userEvent.setup()
    startSession()
    renderSession()

    await user.click(screen.getByRole('button', { name: /save & next/i }))

    expect(s().activeSession?.currentIndex).toBe(1)
    expect(s().strengthLog).toHaveLength(0)
  })

  it('hides Previous on the first exercise and goes back from the second', async () => {
    const user = userEvent.setup()
    startSession()
    renderSession()

    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save & next/i }))
    await user.click(screen.getByRole('button', { name: /previous/i }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(FIRST)
  })

  it('finishes the session on the last exercise', async () => {
    const user = userEvent.setup()
    startSession()
    s().setSessionIndex(NAMES.length - 1)
    renderSession()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(LAST)

    await user.click(screen.getByRole('button', { name: /finish workout/i }))

    expect(s().activeSession).toBeUndefined()
  })

  it('resumes a half-finished exercise with its saved sets', () => {
    const id = startSession()
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: FIRST,
      sets: [
        { weightKg: 30, reps: 10, kind: 'warmup' },
        { weightKg: 55, reps: 8, rpe: 9, kind: 'working' },
      ],
    })

    renderSession()

    expect(within(setList()).getByText('30kg × 10')).toBeInTheDocument()
    expect(within(setList()).getByText('55kg × 8')).toBeInTheDocument()
    expect(within(setList()).getByText('RPE 9')).toBeInTheDocument()
  })

  it('suggests the working load from history, not from the warmups just logged', async () => {
    const user = userEvent.setup()
    // A real working set from a previous week.
    s().addStrengthEntry({
      date: '2026-07-27',
      exerciseName: FIRST,
      sets: [{ weightKg: 80, reps: 6, kind: 'working' }],
    })
    startSession()
    renderSession()

    // Seeded as a warmup at 60% of the 80kg history.
    expect(weightInput()).toHaveValue(47.5)

    // Two warmups in — the editor flips to working and must offer history, not 47.5.
    await user.click(screen.getByRole('button', { name: /add set/i }))
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(weightInput()).toHaveValue(80)
    expect(screen.getByText('last 80kg')).toBeInTheDocument()
  })

  it('keeps history suggestions clean after an abandoned warmup-only session', () => {
    s().addStrengthEntry({
      date: '2026-07-27',
      exerciseName: FIRST,
      sets: [{ weightKg: 80, reps: 6, kind: 'working' }],
    })
    const dead = startSession()
    s().upsertSessionSets({
      sessionId: dead,
      date: DATE,
      exerciseName: FIRST,
      sets: [{ weightKg: 20, reps: 12, kind: 'warmup' }],
    })
    s().discardSession()

    startSession()
    renderSession()

    expect(screen.getByText('last 80kg')).toBeInTheDocument()
    expect(weightInput()).toHaveValue(47.5)
  })

  it('does not complete the workout until it is finished with a working set', async () => {
    const user = userEvent.setup()
    startSession()
    renderSession()

    await user.type(weightInput(), '30')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    // A warmup is on record but the workout is neither finished nor complete.
    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()

    act(() => {
      s().setSessionIndex(NAMES.length - 1)
    })
    await user.click(screen.getByRole('button', { name: /finish workout/i }))

    expect(s().activeSession).toBeUndefined()
    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()
  })

  it('completes the workout when finished with a working set', async () => {
    const user = userEvent.setup()
    startSession()
    s().setSessionIndex(NAMES.length - 1)
    renderSession()

    await user.type(weightInput(), '25')
    await user.click(screen.getByRole('button', { name: /finish workout/i }))

    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
  })

  it('discards the session from the session screen while keeping logged sets', async () => {
    const user = userEvent.setup()
    const id = startSession()
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: FIRST,
      sets: [{ weightKg: 55, reps: 8, kind: 'working' }],
    })
    renderSession()

    await user.click(screen.getByRole('button', { name: /discard workout/i }))

    expect(s().activeSession).toBeUndefined()
    expect(s().strengthLog).toHaveLength(1)
    expect(s().strengthLog[0]?.sets).toHaveLength(1)
  })

  it('flags sets logged today outside the session', () => {
    const id = startSession()
    s().addStrengthEntry({ date: DATE, exerciseName: FIRST, sets: [{ weightKg: 45, reps: 12 }] })
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: FIRST,
      sets: [{ weightKg: 55, reps: 8, kind: 'working' }],
    })

    renderSession()

    expect(screen.getByText(/1 more set logged today outside this workout/i)).toBeInTheDocument()
  })
})

describe('SessionScreen recovery from plan changes', () => {
  it('skips an exercise that was renamed out of the plan', () => {
    s().startSession(DATE, 'Monday', ['Ghost Press', FIRST, 'Ghost Row'])
    renderSession()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(FIRST)
    expect(screen.getByText('Upper A · 1/1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finish workout/i })).toBeInTheDocument()
  })

  it('clamps to the last surviving exercise when the cursor points past it', () => {
    s().startSession(DATE, 'Monday', [FIRST, 'Ghost Row', 'Ghost Fly'])
    s().setSessionIndex(2)
    renderSession()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(FIRST)
  })

  it('offers a discard action when no exercise survives the plan change', () => {
    s().startSession(DATE, 'Monday', ['Ghost Press', 'Ghost Row'])
    renderSession()

    expect(screen.getByText('Workout plan changed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard workout' })).toBeInTheDocument()
  })

  it('offers a discard action when the day is no longer a strength day', () => {
    s().startSession(DATE, 'Tuesday', [FIRST])
    renderSession()

    expect(screen.getByText('Workout plan changed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard workout' })).toBeInTheDocument()
  })

  it('recovery discard clears only the cursor and keeps persisted sets', async () => {
    const user = userEvent.setup()
    const id = s().startSession(DATE, 'Monday', ['Ghost Press'])
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Ghost Press',
      sets: [{ weightKg: 40, reps: 10, kind: 'working' }],
    })
    renderSession()

    await user.click(screen.getByRole('button', { name: 'Discard workout' }))

    expect(s().activeSession).toBeUndefined()
    expect(s().strengthLog).toHaveLength(1)
    expect(s().strengthLog[0]?.exerciseName).toBe('Ghost Press')
    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()
  })
})
