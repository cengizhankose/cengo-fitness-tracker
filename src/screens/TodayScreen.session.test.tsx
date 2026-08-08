import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TodayScreen } from '@/screens/TodayScreen'
import { SessionScreen } from '@/screens/SessionScreen'
import { useStore } from '@/store'
import { plan } from '@/lib/plan'
import { scheduleForDay } from '@/lib/derive'

const MONDAY = new Date(2026, 7, 3, 10, 0, 0) // Mon 3 Aug 2026 — an "Upper A" strength day
const TODAY = '2026-08-03'
const LAST_WEEK = '2026-07-27'

const monday = scheduleForDay(plan, 'Monday')
if (monday.type !== 'strength') throw new Error('fixture expects Monday to be a strength day')
const NAMES = monday.exercises.map((e) => e.name)
const FIRST = NAMES[0]!

const s = () => useStore.getState()

/** Today plus a real /session route, so a resume actually lands on SessionScreen. */
function renderToday() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/session" element={<SessionScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

const startButton = () => screen.queryByRole('button', { name: /start workout/i })
const resumeButton = () => screen.getByRole('button', { name: /^resume unfinished workout/i })
const discardButton = () => screen.getByRole('button', { name: /^discard unfinished workout/i })

beforeEach(() => {
  s().resetAll()
  // Only Date is faked — real timers keep userEvent and the toast timeout working.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MONDAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TodayScreen workout entry point', () => {
  it('offers Start workout on a strength day with no session', () => {
    renderToday()

    expect(startButton()).toBeInTheDocument()
    expect(screen.queryByText('Unfinished workout')).not.toBeInTheDocument()
  })

  it('starts a session and navigates to it', async () => {
    const user = userEvent.setup()
    renderToday()

    await user.click(startButton()!)

    expect(s().activeSession).toMatchObject({ date: TODAY, dayName: 'Monday' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(FIRST)
  })
})

describe('TodayScreen unfinished-workout banner', () => {
  it("shows the banner for today's own session instead of a second start button", () => {
    s().startSession(TODAY, 'Monday', NAMES)
    renderToday()

    expect(screen.getByText('Unfinished workout')).toBeInTheDocument()
    expect(screen.getByText(`0 of ${NAMES.length} exercises done`)).toBeInTheDocument()
    expect(startButton()).not.toBeInTheDocument()
  })

  it('reports progress in the banner', () => {
    const id = s().startSession(TODAY, 'Monday', NAMES)
    s().upsertSessionSets({
      sessionId: id,
      date: TODAY,
      exerciseName: FIRST,
      sets: [{ weightKg: 60, reps: 8, kind: 'working' }],
    })
    renderToday()

    expect(screen.getByText(`1 of ${NAMES.length} exercises done`)).toBeInTheDocument()
  })

  it('surfaces a session left over from an earlier date', () => {
    s().startSession(LAST_WEEK, 'Monday', NAMES)
    renderToday()

    expect(screen.getByText('Unfinished workout')).toBeInTheDocument()
    expect(screen.getByText(/Mon 27 Jul/)).toBeInTheDocument()
    expect(resumeButton()).toBeInTheDocument()
    expect(discardButton()).toBeInTheDocument()
  })

  it('surfaces a session whose day is no longer a strength day', () => {
    // Tuesday is a run day — this cursor can never be reached via the strength CTA.
    s().startSession(LAST_WEEK, 'Tuesday', NAMES)
    renderToday()

    expect(screen.getByText('Unfinished workout')).toBeInTheDocument()
    expect(resumeButton()).toBeInTheDocument()
    expect(discardButton()).toBeInTheDocument()
  })

  it('never lets a new workout silently replace an open cursor', () => {
    const id = s().startSession(LAST_WEEK, 'Monday', NAMES)
    renderToday()

    expect(startButton()).not.toBeInTheDocument()
    expect(s().activeSession?.id).toBe(id)
  })

  it('resumes a stale-date session onto the session screen', async () => {
    const user = userEvent.setup()
    s().startSession(LAST_WEEK, 'Monday', NAMES)
    renderToday()

    await user.click(resumeButton())

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(FIRST)
    expect(s().activeSession?.date).toBe(LAST_WEEK)
  })

  it('resumes a non-strength-day session onto the SessionScreen recovery state', async () => {
    const user = userEvent.setup()
    s().startSession(LAST_WEEK, 'Tuesday', NAMES)
    renderToday()

    await user.click(resumeButton())

    expect(screen.getByText('Workout plan changed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard workout' })).toBeInTheDocument()
  })

  it('discards a stale session, keeping logged sets, and restores Start workout', async () => {
    const user = userEvent.setup()
    const id = s().startSession(LAST_WEEK, 'Monday', NAMES)
    s().upsertSessionSets({
      sessionId: id,
      date: LAST_WEEK,
      exerciseName: FIRST,
      sets: [{ weightKg: 60, reps: 8, kind: 'working' }],
    })
    renderToday()

    await user.click(discardButton())

    expect(s().activeSession).toBeUndefined()
    expect(s().strengthLog).toHaveLength(1)
    expect(s().strengthLog[0]?.sets).toHaveLength(1)
    expect(s().checklist[LAST_WEEK]?.items.completedWorkout).toBeUndefined()
    expect(screen.queryByText('Unfinished workout')).not.toBeInTheDocument()
    expect(startButton()).toBeInTheDocument()
  })

  it('discards a non-strength-day session from Today', async () => {
    const user = userEvent.setup()
    s().startSession(LAST_WEEK, 'Tuesday', NAMES)
    renderToday()

    await user.click(discardButton())

    expect(s().activeSession).toBeUndefined()
    expect(screen.queryByText('Unfinished workout')).not.toBeInTheDocument()
  })
})
