import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TodayScreen } from '@/screens/TodayScreen'
import { WeeklyScreen } from '@/screens/WeeklyScreen'
import { useStore } from '@/store'
import { toLocalISODate } from '@/lib/dates'
import { checkA11y } from '@/test/axe'

const MONDAY = '2026-08-10T09:00:00'
const FRIDAY = '2026-08-14T09:00:00'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/weekly" element={<WeeklyScreen />} />
        <Route path="/log" element={<p>log screen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Section titles in DOM order, without the collapsed-state summary line. */
const sectionNames = () =>
  screen
    .getAllByRole('heading', { level: 2 })
    .map((h) => (h.querySelector('span > span') ?? h).textContent?.trim())

const summaryOf = (sectionId: string) =>
  document.querySelector(`[data-section="${sectionId}"] span > span + span`)?.textContent

describe('TodayScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(MONDAY))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('orders the sections workout → checklist → reference content', () => {
    renderScreen()
    expect(sectionNames()).toEqual([
      'Strength · Upper A',
      'Daily Checklist',
      'Targets',
      'Meals',
      'Morning Mobility',
      'Post-Workout Stretch',
    ])
  })

  it('puts the checklist above every collapsible section in the DOM', () => {
    renderScreen()
    const checklist = document.querySelector('[data-section="checklist"]')!
    const targets = document.querySelector('[data-section="targets"]')!
    expect(checklist.compareDocumentPosition(targets) & Node.DOCUMENT_POSITION_FOLLOWING).
      toBeTruthy()
  })

  it('renders the full checklist, uncollapsed', () => {
    renderScreen()
    expect(screen.getAllByRole('switch')).toHaveLength(8)
    expect(screen.getByText('Workout done')).toBeInTheDocument()
  })

  it('collapses the reference sections and unmounts their content by default', () => {
    renderScreen()
    for (const name of ['Targets', 'Meals', 'Morning Mobility', 'Post-Workout Stretch']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    }
    expect(screen.queryByText('Calories')).not.toBeInTheDocument()
    expect(screen.queryByText('Chicken Potato Bowl')).not.toBeInTheDocument()
    expect(screen.queryByText('Cat-Cow')).not.toBeInTheDocument()
  })

  it('shows glanceable summaries while collapsed', () => {
    renderScreen()
    expect(summaryOf('workout')).toBe('40 min · 7 exercises · 0/7 logged')
    expect(summaryOf('targets')).toBe('2200–2300 kcal · 200–220 g protein')
    expect(summaryOf('meals')).toBe('3 meals · ~1920 kcal')
    expect(summaryOf('mobility')).toBe('5 min · 5 moves')
    expect(summaryOf('stretch')).toBe('5 min · 5 moves')
  })

  it('reveals reference content on demand', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderScreen()

    await user.click(screen.getByRole('button', { name: /meals/i }))
    expect(screen.getByText('Chicken Potato Bowl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /meals/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('drops the stretch section and one checklist item on football days', () => {
    vi.setSystemTime(new Date(FRIDAY))
    renderScreen()

    expect(screen.getAllByRole('switch')).toHaveLength(7)
    expect(screen.queryByText('Post-workout stretch')).not.toBeInTheDocument()
    expect(sectionNames()).toEqual([
      'Football · Halisaha',
      'Daily Checklist',
      'Targets',
      'Meals',
      'Morning Mobility',
    ])
  })

  it('does not persist collapse state across a tab round-trip', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = renderScreen()

    await user.click(screen.getByRole('button', { name: /meals/i }))
    expect(screen.getByText('Chicken Potato Bowl')).toBeInTheDocument()

    // Leaving Today unmounts the screen; coming back starts from the curated defaults.
    unmount()
    renderScreen()
    expect(screen.queryByText('Chicken Potato Bowl')).not.toBeInTheDocument()
    expect(localStorage.getItem('cengo-cut') ?? '').not.toContain('meals')
  })

  it('still writes checklist toggles through to the persisted store', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderScreen()

    await user.click(screen.getByRole('switch', { name: /10k\+ steps/i }))

    const today = toLocalISODate()
    expect(useStore.getState().checklist[today]?.items.steps10000Plus).toBe(true)
    expect(localStorage.getItem('cengo-cut')).toContain('steps10000Plus')
  })

  it('shows the benchmark CTA only until a benchmark exists', () => {
    const { unmount } = renderScreen()
    expect(screen.getByRole('button', { name: 'Log 5K' })).toBeInTheDocument()
    unmount()

    useStore.getState().logBenchmarkRun({ date: toLocalISODate(), timeSec: 1500, distanceKm: 5 })
    renderScreen()
    expect(screen.queryByRole('button', { name: 'Log 5K' })).not.toBeInTheDocument()
  })

  it('keeps the checklist progress visible in the sticky header', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderScreen()

    const header = screen.getByRole('banner')
    expect(header).toHaveTextContent('0/8')
    await user.click(screen.getByRole('switch', { name: /no alcohol/i }))
    expect(header).toHaveTextContent('1/8')
  })

  it('has no axe violations, collapsed or fully expanded', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = renderScreen()
    expect(await checkA11y(container)).toHaveNoViolations()

    for (const name of [/strength/i, /targets/i, /meals/i, /morning mobility/i, /stretch/i]) {
      await user.click(screen.getByRole('button', { name }))
    }
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
