import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { WeeklyScreen } from '@/screens/WeeklyScreen'
import { useStore } from '@/store'
import { checkA11y } from '@/test/axe'

const TUESDAY_IN_PLAN = '2026-09-08T09:00:00'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/weekly']}>
      <Routes>
        <Route path="/weekly" element={<WeeklyScreen />} />
        <Route path="/log" element={<p>log screen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WeeklyScreen — dated tracker + legacy hierarchy', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(TUESDAY_IN_PLAN))
    useStore.setState({ runLog: [], marathonStatus: {}, checklist: {} })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retitles the header to Plan with a marathon subtitle and countdown badge', () => {
    renderScreen()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Plan')
    expect(screen.getAllByText(/Istanbul Marathon/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/days/).length).toBeGreaterThan(0)
  })

  it('renders the tracker above the legacy section in DOM order', () => {
    renderScreen()
    const week1 = screen.getByRole('button', { name: /Week 2/ })
    const legacy = screen.getByRole('button', { name: /Strength & Football Week/ })
    expect(
      week1.compareDocumentPosition(legacy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('the legacy section is collapsed on mount, carrying the {pct}% week summary', () => {
    renderScreen()
    expect(screen.queryByText('Upper A')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /Strength & Football Week/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveTextContent(/%\s*week/)
  })

  it('opening the legacy section reveals the 7 DayCards with today expanded', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: /Strength & Football Week/ }))
    expect(screen.getAllByText('Tue').length).toBeGreaterThan(0)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('has exactly one h1, with week sections and the legacy section as sibling h2s', () => {
    renderScreen()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const h2s = screen.getAllByRole('heading', { level: 2 })
    const texts = h2s.map((h) => h.textContent ?? '')
    expect(texts.some((t) => /Week 1/.test(t))).toBe(true)
    expect(texts.some((t) => /Strength & Football Week/.test(t))).toBe(true)
  })

  it('is axe clean', async () => {
    const { container } = renderScreen()
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
