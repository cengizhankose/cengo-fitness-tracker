import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { sessionById, sessionExercises } from '@/lib/plan'
import { useStore } from '@/store'
import { useActivitiesStore } from '@/store/activities'
import type { StrengthLogEntry } from '@/types/userData'
import { PlanScreen } from './PlanScreen'

const startSession = vi.hoisted(() => vi.fn())
vi.mock('@/components/session/useStartSession', () => ({
  useStartSession: () => startSession,
}))

function setToday(y: number, monthIndex: number, d: number) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(y, monthIndex, d, 9, 0, 0))
}

function renderPlan() {
  render(
    <MemoryRouter initialEntries={['/plan']}>
      <Routes>
        <Route path="/plan" element={<PlanScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  return userEvent.setup()
}

function dayRow(dayLabel: string) {
  const days = screen.getByRole('list', { name: 'Günler' })
  return within(days).getByRole('listitem', { name: new RegExp(`^${dayLabel} `) })
}

/** Single-set entries without sessionId, exactly as the old Log screen wrote them. */
function entry(id: string, exerciseName: string, weightKg: number, reps: number, rpe: number): StrengthLogEntry {
  return {
    id,
    date: '2026-11-16',
    exerciseName,
    sets: [{ weightKg, reps, rpe }],
    createdAt: `2026-11-16T07:${id.padStart(2, '0')}:00.000Z`,
  }
}

beforeEach(() => {
  startSession.mockReset()
  useActivitiesStore.setState({ activities: {} })
})

describe('PlanScreen week', () => {
  it('renders the weekly template of plan week 1', () => {
    setToday(2026, 10, 19)
    renderPlan()

    const thursday = dayRow('Perşembe')
    expect(within(thursday).getByRole('button', { name: /Üst vücut superset/ })).toBeInTheDocument()
    expect(within(thursday).getByText('Kolay koşu')).toBeInTheDocument()
    expect(within(thursday).getByText('20 dk')).toBeInTheDocument()

    const saturday = dayRow('Cumartesi')
    expect(within(saturday).getByRole('button', { name: /Üst vücut superset/ })).toBeInTheDocument()
    expect(within(saturday).getByText('Kolay koşu')).toBeInTheDocument()
    expect(within(saturday).getByText('30 dk')).toBeInTheDocument()
    expect(within(saturday).getAllByText('Opsiyonel')).toHaveLength(2)

    const sunday = dayRow('Pazar')
    expect(within(sunday).getByText('Grup koşusu')).toBeInTheDocument()
    expect(within(sunday).getByText('8 km')).toBeInTheDocument()

    expect(dayRow('Perşembe')).toHaveAttribute('aria-current', 'date')

    const nutrition = screen.getByRole('link', { name: /Beslenme ve takviye/ })
    expect(nutrition).toHaveAttribute('href', '/nutrition')
    expect(nutrition).toHaveTextContent('2.400 kcal · 190 g protein')
    expect(dayRow('Pazartesi')).not.toHaveAttribute('aria-current')
  })

  it('holds the Sunday long run at 12–14 km from plan week 5', () => {
    setToday(2026, 11, 14)
    renderPlan()

    expect(screen.getByText(/Hafta 5/)).toBeInTheDocument()
    expect(within(dayRow('Pazar')).getByText('12–14 km')).toBeInTheDocument()
  })

  it('marks a day done once a working set is logged on it', () => {
    setToday(2026, 10, 17)
    useStore.setState({ strengthLog: [entry('1', 'Incline Dumbbell Press', 30, 7, 8)] })
    renderPlan()

    expect(within(dayRow('Pazartesi')).getByText('Yapıldı')).toBeInTheDocument()
    expect(within(dayRow('Salı')).queryByText('Yapıldı')).not.toBeInTheDocument()
  })
})

describe('PlanScreen session sheet', () => {
  it('shows every exercise in order with the plan start load before any history', async () => {
    setToday(2026, 10, 16)
    const user = renderPlan()

    await user.click(within(dayRow('Salı')).getByRole('button', { name: /Push/ }))
    const dialog = screen.getByRole('dialog', { name: 'Push' })

    const names = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(names).toEqual(sessionExercises(sessionById('push')!).map((e) => e.name))

    const superset = within(dialog).getByRole('list', { name: 'Superset' })
    expect(within(superset).getByRole('listitem', { name: 'Lateral Raise' })).toBeInTheDocument()
    expect(within(superset).getByRole('listitem', { name: 'Rope Pushdown' })).toBeInTheDocument()

    const bench = within(dialog).getByRole('listitem', { name: 'Bench Press' })
    expect(within(bench).getByText('1 × 5')).toBeInTheDocument()
    expect(within(bench).getByText('80 kg × 5')).toBeInTheDocument()
    expect(within(bench).queryByText(/RPE/)).not.toBeInTheDocument()
  })

  it('targets the last logged load and shows its RPE once history exists', async () => {
    setToday(2026, 10, 17)
    useStore.setState({
      strengthLog: [
        entry('1', 'Bench Press', 82.5, 5, 9),
        entry('2', 'Machine Chest Press', 40, 10, 7),
        entry('3', 'Machine Chest Press', 40, 12, 7),
      ],
    })
    const user = renderPlan()

    await user.click(within(dayRow('Salı')).getByRole('button', { name: /Push/ }))
    const dialog = screen.getByRole('dialog', { name: 'Push' })

    const bench = within(dialog).getByRole('listitem', { name: 'Bench Press' })
    // RPE 9 → hold: target and last time are both the logged load.
    expect(within(bench).getAllByText('82,5 kg × 5')).toHaveLength(2)
    expect(within(bench).getByText('RPE 9')).toBeInTheDocument()
    expect(within(bench).queryByText('80 kg × 5')).not.toBeInTheDocument()

    // Both same-day entries merge; 12 reps at RPE 7 reached the target → +2,5 kg.
    const chestPress = within(dialog).getByRole('listitem', { name: 'Machine Chest Press' })
    expect(within(chestPress).getByText('42,5 kg × 12')).toBeInTheDocument()
    expect(within(chestPress).getByText('40 kg × 12')).toBeInTheDocument()
    expect(within(chestPress).getByText('RPE 7')).toBeInTheDocument()
  })

  it('starts the opened plan session, whatever the day', async () => {
    setToday(2026, 10, 16)
    const user = renderPlan()

    await user.click(within(dayRow('Çarşamba')).getByRole('button', { name: /Bacak/ }))
    await user.click(screen.getByRole('button', { name: 'Bu seansı başlat' }))

    expect(startSession).toHaveBeenCalledTimes(1)
    expect(startSession).toHaveBeenCalledWith('legs')
  })
})
