import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'
import { plan } from '@/lib/plan'
import { useStore } from '@/store'
import { toLocalISODate } from '@/lib/dates'
import type { DayName } from '@/types/plan'

const MONDAY = '2026-08-10T09:00:00'
const FRIDAY = '2026-08-14T09:00:00'
const SUNDAY = '2026-08-09T09:00:00'

function dayOf(name: DayName) {
  const day = plan.weeklySchedule.find((d) => d.day === name)
  if (!day) throw new Error(`missing ${name}`)
  return day
}

function exercisesOf(name: DayName) {
  const day = dayOf(name)
  return day.type === 'strength' ? day.exercises : []
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{`${loc.pathname}${loc.search}`}</div>
}

function Harness({ name, initialOpen = false }: { name: DayName; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={<TodayWorkoutCard day={dayOf(name)} open={open} onOpenChange={setOpen} />}
        />
        <Route path="/log" element={<p>log screen</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  )
}

function logStrength(exerciseName: string) {
  useStore.getState().addStrengthEntry({
    date: toLocalISODate(),
    exerciseName,
    sets: [{ weightKg: 40, reps: 8 }],
  })
}

describe('TodayWorkoutCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('summarises a strength day without logs', () => {
    vi.setSystemTime(new Date(MONDAY))
    render(<Harness name="Monday" />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Strength · Upper A')
    expect(screen.getByText('40 min · 7 exercises · 0/7 logged')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^strength/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText('Incline Dumbbell Press')).not.toBeInTheDocument()
  })

  it('counts logged exercises in the summary', () => {
    vi.setSystemTime(new Date(MONDAY))
    logStrength('Incline Dumbbell Press')
    logStrength('Lateral Raise')
    render(<Harness name="Monday" />)

    expect(screen.getByText('40 min · 7 exercises · 2/7 logged')).toBeInTheDocument()
  })

  it('keeps every per-exercise + Log button and its deep link when expanded', async () => {
    vi.setSystemTime(new Date(MONDAY))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness name="Monday" initialOpen />)

    // The card-level CTA is named after its target exercise, so a bare "Log" name
    // matches exactly the seven ExerciseRow buttons.
    const logButtons = screen.getAllByRole('button', { name: 'Log' })
    expect(logButtons).toHaveLength(7)

    await user.click(logButtons[0]!)
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/log?type=strength&exercise=Incline%20Dumbbell%20Press',
    )
  })

  it('points the header CTA at the first unlogged exercise', async () => {
    vi.setSystemTime(new Date(MONDAY))
    logStrength('Incline Dumbbell Press')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness name="Monday" />)

    await user.click(screen.getByRole('button', { name: 'Log Pull Up / Lat Pulldown' }))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/log?type=strength&exercise=Pull%20Up%20%2F%20Lat%20Pulldown',
    )
  })

  it('marks the CTA as logged once every exercise is done', () => {
    vi.setSystemTime(new Date(MONDAY))
    for (const ex of exercisesOf('Monday')) logStrength(ex.name)
    render(<Harness name="Monday" />)

    expect(screen.getByRole('button', { name: 'All exercises logged' })).toHaveTextContent('Logged')
  })

  it('renders the football day as a plain card with no disclosure', () => {
    vi.setSystemTime(new Date(FRIDAY))
    render(<Harness name="Friday" />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Football · Halisaha')
    expect(screen.getByText('No extra training')).toBeInTheDocument()
    expect(document.querySelector('[aria-expanded]')).toBeNull()
  })

  it('shows the current week distance on the Sunday long run', () => {
    vi.setSystemTime(new Date(SUNDAY))
    // Programme started Mon 27 Jul → this Sunday is 13 days in, i.e. week 2 (8, 10, …).
    useStore.setState({ settings: { programStartDate: '2026-07-27' } })
    render(<Harness name="Sunday" />)

    expect(screen.getByText('10 km · week 2/12 · Zone 2')).toBeInTheDocument()
  })

  it('offers a single-tap run log on run days', async () => {
    vi.setSystemTime(new Date('2026-08-11T09:00:00')) // Tuesday
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness name="Tuesday" />)

    expect(screen.getByText('45 min · 6 km · Easy conversational pace')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log run' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/log?type=run')
  })
})
