import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LogScreen } from '@/screens/LogScreen'
import { checkA11y } from '@/test/axe'
import { plan } from '@/lib/plan'
import { ToastHost } from '@/components/ToastHost'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'

function renderLog(route = '/log') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<div>today screen</div>} />
        <Route path="/log" element={<LogScreen />} />
      </Routes>
      <ToastHost />
    </MemoryRouter>,
  )
}

const picker = () => screen.getByRole('button', { name: /exercise/i })
const search = () => screen.getByRole('combobox', { name: /search/i })
const state = () => useStore.getState()

describe('LogScreen — strength exercise picker', () => {
  beforeEach(() => {
    useStore.setState({ benchmark: undefined, runLog: [], strengthLog: [], checklist: {} })
    useToast.setState({ toasts: [] })
    localStorage.clear()
  })

  it('searches the catalog, selects an exercise, closes, and logs it', async () => {
    const user = userEvent.setup()
    renderLog()

    await user.click(picker())
    await user.type(search(), 'hammer')
    await user.click(screen.getByRole('option', { name: 'Hammer Curl' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(picker()).toHaveTextContent('Hammer Curl')

    await user.type(screen.getByLabelText(/^Weight/), '20')
    await user.click(screen.getByRole('button', { name: /Save set/ }))

    expect(state().strengthLog).toHaveLength(1)
    expect(state().strengthLog[0]?.exerciseName).toBe('Hammer Curl')
  })

  it('lists the whole plan catalog once, grouped by region', async () => {
    const user = userEvent.setup()
    renderLog()
    await user.click(picker())

    const catalog = [
      ...new Set(
        plan.weeklySchedule.flatMap((d) =>
          d.type === 'strength' ? d.exercises.map((e) => e.name) : [],
        ),
      ),
    ]
    const listed = screen.getAllByRole('option').map((o) => o.textContent)
    expect(listed).toHaveLength(catalog.length)
    expect([...listed].sort()).toEqual([...catalog].sort())
    expect(screen.queryByRole('group', { name: 'Other' })).not.toBeInTheDocument()
  })

  it('prefills the weight from the last logged set of the newly picked exercise', async () => {
    const user = userEvent.setup()
    useStore.getState().addStrengthEntry({
      date: '2026-08-01',
      exerciseName: 'Leg Press',
      sets: [{ weightKg: 140, reps: 8, rpe: 9 }],
    })
    renderLog()

    expect(screen.getByLabelText(/^Weight/)).toHaveValue(null)

    await user.click(picker())
    await user.click(screen.getByRole('option', { name: 'Leg Press' }))

    expect(screen.getByLabelText(/^Weight/)).toHaveValue(140)
  })

  it('keeps an unknown preset exercise instead of replacing it', async () => {
    const user = userEvent.setup()
    renderLog('/log?exercise=Bulgarian%20Split%20Squat')

    expect(picker()).toHaveTextContent('Bulgarian Split Squat')

    await user.type(screen.getByLabelText(/^Weight/), '40')
    await user.click(screen.getByRole('button', { name: /Save set/ }))

    expect(state().strengthLog[0]?.exerciseName).toBe('Bulgarian Split Squat')
  })

  it('honours a known preset exercise and its last weight', () => {
    useStore.getState().addStrengthEntry({
      date: '2026-08-01',
      exerciseName: 'Shoulder Press',
      sets: [{ weightKg: 30, reps: 8, rpe: 9 }],
    })
    renderLog('/log?exercise=Shoulder%20Press')

    expect(picker()).toHaveTextContent('Shoulder Press')
    expect(screen.getByLabelText(/^Weight/)).toHaveValue(30)
  })

  it('has no axe violations with the picker open', async () => {
    const user = userEvent.setup()
    const { container } = renderLog()
    await user.click(picker())
    await user.type(screen.getByRole('combobox', { name: /search/i }), 'curl')

    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
