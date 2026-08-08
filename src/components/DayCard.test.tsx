import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { WeeklyScreen } from '@/screens/WeeklyScreen'
import { checkA11y } from '@/test/axe'

describe('WeeklyScreen / DayCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-10T09:00:00')) // Monday
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const renderWeekly = () =>
    render(
      <MemoryRouter>
        <WeeklyScreen />
      </MemoryRouter>,
    )

  it('opens today by default and keeps aria wiring intact', () => {
    renderWeekly()
    const monday = screen.getByRole('button', { name: /mon/i })
    expect(monday).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(monday.getAttribute('aria-controls')!)).not.toBeNull()
    expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument()
  })

  it('collapses and expands days', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWeekly()

    await user.click(screen.getByRole('button', { name: /mon/i }))
    expect(screen.queryByText('Incline Dumbbell Press')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /wed/i }))
    expect(screen.getByRole('button', { name: /wed/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('has no axe violations', async () => {
    const { container } = renderWeekly()
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
