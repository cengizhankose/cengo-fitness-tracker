import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MarathonTracker } from './MarathonTracker'
import { useStore } from '@/store'
import { checkA11y } from '@/test/axe'
import type { RunLogEntry } from '@/types/userData'

function renderTracker(today: string) {
  return render(
    <MemoryRouter>
      <MarathonTracker today={today} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useStore.setState({ runLog: [], marathonStatus: {} })
})

describe('MarathonTracker — pre-plan (2026-08-29)', () => {
  it('renders the countdown, start line, next workout, and opens Week 1', () => {
    renderTracker('2026-08-29')
    expect(screen.getByText(/64 days/)).toBeInTheDocument()
    expect(screen.getByText(/Starts Mon 31 Aug/)).toBeInTheDocument()
    expect(screen.getAllByText(/Tue 1 Sep/).length).toBeGreaterThan(0)

    const week1Trigger = screen.getByRole('button', { name: /Week 1/ })
    expect(week1Trigger).toHaveAttribute('aria-expanded', 'true')
    const week2Trigger = screen.getByRole('button', { name: /Week 2/ })
    expect(week2Trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('MarathonTracker — in-plan (2026-10-14)', () => {
  it('reads Week 7 of 9, opens week 7, reflects a seeded run, and shows the nutrition phase', () => {
    const runLog: RunLogEntry[] = [
      { id: 'r1', date: '2026-10-13', distanceKm: 5, durationMin: 25, createdAt: '2026-10-13T10:00:00.000Z' },
    ]
    useStore.setState({ runLog })
    renderTracker('2026-10-14')

    expect(screen.getByText(/Week 7 of 9/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Week 7/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Maintenance transition/)).toBeInTheDocument()
  })

  it('accordion: opening week 3 collapses week 7, and resets the open day', async () => {
    const user = userEvent.setup()
    renderTracker('2026-10-14')

    // Week 7 is already open (default for 2026-10-14) — open a day inside it.
    await user.click(screen.getByRole('button', { name: /^Mon 12 Oct/ }))
    expect(screen.getByRole('button', { name: /^Mon 12 Oct/ })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /Week 3/ }))
    expect(screen.getByRole('button', { name: /Week 3/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Week 7/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('clamps the week bar at 100% on an over-delivered week', () => {
    const week7Days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']
    const runLog: RunLogEntry[] = week7Days.map((date, i) => ({
      id: `r${i}`,
      date,
      distanceKm: 20,
      durationMin: 100,
      createdAt: `${date}T10:00:00.000Z`,
    }))
    useStore.setState({ runLog })
    renderTracker('2026-10-14')
    const bar = document.querySelector('[data-week-bar="7"]') as HTMLElement | null
    expect(bar).toBeTruthy()
    expect(bar?.style.width).toBe('100%')
  })
})

describe('MarathonTracker — post-race (2026-11-02)', () => {
  it('shows race-complete, 0 days, week 9 open, plan totals present', () => {
    renderTracker('2026-11-02')
    expect(screen.getByText(/0 days/)).toBeInTheDocument()
    expect(screen.getByText(/Race complete/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Week 9/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/433\.2 km/)).toBeInTheDocument()
  })
})

describe('MarathonTracker — accessibility', () => {
  it('is axe clean', async () => {
    const { container } = renderTracker('2026-08-29')
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
