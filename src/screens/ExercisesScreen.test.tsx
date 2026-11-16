import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { realStrengthLog } from '@/components/exercise/__fixtures__/realStrengthLog'
import { useStore } from '@/store'
import { ExercisesScreen } from './ExercisesScreen'

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/exercises']}>
      <ExercisesScreen />
    </MemoryRouter>,
  )
}

const row = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) })
const queryRow = (name: string) => screen.queryByRole('link', { name: new RegExp(`^${name}`) })

describe('ExercisesScreen', () => {
  beforeEach(() => {
    useStore.setState({ strengthLog: realStrengthLog() })
  })

  it('lists Machine Chest Press once with its last top set and effort', () => {
    renderList()
    const rows = screen.getAllByRole('link', { name: /^Machine Chest Press/ })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('40 kg × 12 · RPE 7 · 16 Kas')
    expect(rows[0]).toHaveAttribute('href', `/exercises/${encodeURIComponent('Machine Chest Press')}`)
  })

  it('shows the aliased "Pull Up / Lat Pulldown" history under Lat Pulldown in Sırt', () => {
    renderList()
    expect(queryRow('Pull Up / Lat Pulldown')).toBeNull()
    const back = screen.getByRole('region', { name: 'Sırt' })
    const lat = within(back).getByRole('link', { name: /^Lat Pulldown/ })
    expect(lat).toHaveTextContent('60 kg × 10 · RPE 9')
  })

  it('lists plan exercises without history, after the logged ones of their region', () => {
    renderList()
    expect(row('Bench Press')).toHaveTextContent('Henüz kayıt yok')
    const chest = within(screen.getByRole('region', { name: 'Göğüs' }))
      .getAllByRole('link')
      .map((l) => l.textContent ?? '')
    const index = (name: string) => chest.findIndex((t) => t.startsWith(name))
    expect(index('Incline Dumbbell Press')).toBeLessThan(index('Bench Press'))
    expect(index('Machine Chest Press')).toBeLessThan(index('Bench Press'))
    expect(index('Bench Press')).toBeLessThan(index('Push Up'))
  })

  it('filters by search text, ignoring case', async () => {
    const user = userEvent.setup()
    renderList()
    await user.type(screen.getByLabelText('Hareket ara'), 'BENCH')
    expect(row('Bench Press')).toBeInTheDocument()
    expect(queryRow('Squat')).toBeNull()
    expect(queryRow('Machine Chest Press')).toBeNull()

    await user.clear(screen.getByLabelText('Hareket ara'))
    await user.type(screen.getByLabelText('Hareket ara'), 'zzz')
    expect(screen.getByText('Sonuç yok')).toBeInTheDocument()
  })

  it('filters by region and only offers regions that have exercises', async () => {
    const user = userEvent.setup()
    renderList()
    const chips = screen.getByRole('radiogroup', { name: 'Bölge' })
    expect(within(chips).queryByRole('radio', { name: /Diğer/ })).toBeNull()

    await user.click(within(chips).getByRole('radio', { name: /Bacak/ }))
    expect(row('Squat')).toBeInTheDocument()
    expect(queryRow('Bench Press')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Göğüs' })).toBeNull()

    await user.click(within(chips).getByRole('radio', { name: /Tümü/ }))
    expect(row('Bench Press')).toBeInTheDocument()
  })

  it('puts exercises logged outside the plan in Diğer', () => {
    useStore.setState({
      strengthLog: [
        ...realStrengthLog(),
        {
          id: 'x1',
          date: '2026-11-17',
          exerciseName: 'Dips',
          sets: [{ weightKg: 0, reps: 10, rpe: 8 }],
          createdAt: '2026-11-17T06:00:00.000Z',
        },
      ],
    })
    renderList()
    const other = screen.getByRole('region', { name: 'Diğer' })
    expect(within(other).getByRole('link', { name: /^Dips/ })).toHaveTextContent('0 kg × 10 · RPE 8')
  })
})
