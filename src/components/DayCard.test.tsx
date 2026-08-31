import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  /** D8 collapses the legacy weekly template behind one section, closed on every visit. */
  async function openLegacySection(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /Strength & Football Week/i }))
    return within(document.querySelector('[data-section="legacy-plan"]') as HTMLElement)
  }

  it('opens today by default and keeps aria wiring intact', async () => {
    const user = userEvent.setup()
    renderWeekly()
    const legacy = await openLegacySection(user)

    const monday = legacy.getByRole('button', { name: /mon/i })
    expect(monday).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(monday.getAttribute('aria-controls')!)).not.toBeNull()
    expect(legacy.getByText('Incline Dumbbell Press')).toBeInTheDocument()
  })

  it('collapses and expands days', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWeekly()
    const legacy = await openLegacySection(user)

    await user.click(legacy.getByRole('button', { name: /mon/i }))
    expect(legacy.queryByText('Incline Dumbbell Press')).not.toBeInTheDocument()

    await user.click(legacy.getByRole('button', { name: /wed/i }))
    expect(legacy.getByRole('button', { name: /wed/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('has no axe violations', async () => {
    const { container } = renderWeekly()
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
